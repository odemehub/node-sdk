import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * How a merchant and the gateway vouch for each other's messages. A body
 * travels as plain JSON and, next to it, two headers: the moment it was
 * signed in Unix seconds (`X-Timestamp`) and an HMAC-SHA256 under the
 * merchant's secret over that moment, the method, the path and the exact
 * text of the body, joined with newlines (`X-Signature`). The secret
 * itself never travels; a message whose signature does not match was not
 * written by the holder of the secret, or was changed on the way, and one
 * signed more than a few minutes ago is not taken.
 *
 * This is the same calculation the application makes in its own
 * `ApiCredential`. Nothing is layered on top, so a message can be signed
 * and checked by hand:
 *
 *     createHmac('sha256', apiSecret)
 *         .update(`${timestamp}\n${method}\n${path}\n${body}`)
 *         .digest('hex')
 *
 * Test vector: with the secret `secret_test`, at `1700000000`, `POST` to
 * `/api/1000000001/gateway/regular-payment` with the body `{"a":1}` signs as
 * `4d6225c9dd46837418b40dd8140d76a24cd7520d81ff3b280bf98da8da6a8771`.
 */
export class Signature {
    static readonly ALGORITHM = 'sha256';

    /**
     * The header a request, its answer and a webhook carry the signature in.
     */
    static readonly HEADER = 'X-Signature';

    /**
     * The header a request, its answer and a webhook carry the moment of signing in.
     */
    static readonly TIMESTAMP_HEADER = 'X-Timestamp';

    /**
     * How far from now, either way, a signature's moment may lie and still
     * be taken, in seconds. The gateway allows the same.
     */
    static readonly TIMESTAMP_TOLERANCE = 300;

    constructor(private readonly apiSecret: string) {}

    /**
     * The signature that vouches for a message: HMAC-SHA256 over the moment,
     * the method, the path and the body, written as lowercase hex.
     */
    signMessage(method: string, path: string, body: string, timestamp: number): string {
        return createHmac(Signature.ALGORITHM, this.apiSecret)
            .update(Signature.signedText(method, path, body, timestamp))
            .digest('hex');
    }

    /**
     * Whether a signature vouches for a message, and was made recently
     * enough to be taken.
     *
     * @param timestamp The `X-Timestamp` header, as it arrived.
     * @param signature The `X-Signature` header, as it arrived.
     */
    verifyMessage(method: string, path: string, body: string, timestamp: string | null | undefined, signature: string | null | undefined): boolean {
        if (typeof timestamp !== 'string' || !/^[0-9]+$/.test(timestamp) || Math.abs(now() - Number(timestamp)) > Signature.TIMESTAMP_TOLERANCE) {
            return false;
        }

        return typeof signature === 'string' && equals(this.signMessage(method, path, body, Number(timestamp)), signature);
    }

    /**
     * The two headers that vouch for a message going out, made for now.
     */
    headers(method: string, path: string, body: string): Record<string, string> {
        const timestamp = now();

        return {
            [Signature.TIMESTAMP_HEADER]: String(timestamp),
            [Signature.HEADER]: this.signMessage(method, path, body, timestamp),
        };
    }

    /**
     * What the signature is taken over.
     */
    static signedText(method: string, path: string, body: string, timestamp: number): string {
        return [String(timestamp), method.toUpperCase(), path, body].join('\n');
    }

}

function now(): number {
    return Math.floor(Date.now() / 1000);
}

function equals(expected: string, given: string): boolean {
    const left = Buffer.from(expected);
    const right = Buffer.from(given);

    return left.length === right.length && timingSafeEqual(left, right);
}
