import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * How a merchant and the gateway vouch for each other's bodies. A body
 * travels as plain JSON and, next to it in the `X-Signature` header, an
 * HMAC-SHA256 of that exact text under the merchant's secret. The secret
 * itself never travels; a body whose signature does not match was not
 * written by the holder of the secret, or was changed on the way.
 *
 * This is the same calculation the application makes in its own
 * `Services\Gateway\Signer`. Nothing is layered on top, so a body can be
 * signed and checked by hand:
 *
 *     createHmac('sha256', apiSecret).update(body).digest('hex')
 *
 * Test vector: with the secret `secret_test` the body `{"a":1}` is signed
 * `6d0c951564cdd2b6b70e75b214293a8cd2542815ba54fe91c7f6ce105bc3d592`.
 */
export class Signature {
    static readonly ALGORITHM = 'sha256';

    /**
     * The header both the request and the answer carry the signature in.
     */
    static readonly HEADER = 'X-Signature';

    constructor(private readonly apiSecret: string) {}

    /**
     * The signature that vouches for a body: HMAC-SHA256 over the exact
     * text, written as lowercase hex.
     */
    sign(body: string | Uint8Array): string {
        return createHmac(Signature.ALGORITHM, this.apiSecret).update(body).digest('hex');
    }

    /**
     * Whether a signature vouches for a body.
     */
    verify(body: string | Uint8Array, signature: string | null | undefined): boolean {
        if (typeof signature !== 'string') {
            return false;
        }

        const expected = Buffer.from(this.sign(body));
        const given = Buffer.from(signature);

        return expected.length === given.length && timingSafeEqual(expected, given);
    }
}
