import type { Body, Message } from './body.js';
import {
    AuthenticationError,
    ForbiddenError,
    NotFoundError,
    RateLimitError,
    SignatureError,
    TransportError,
    UnexpectedResponseError,
    ValidationError,
} from './errors.js';
import { Signature } from './signature.js';

/**
 * Where a client reaches the application and the credentials it reaches it
 * with. The team's gateway and the partner's own endpoints are reached the
 * same way; only the address in front of the endpoint differs.
 */
export interface Connection {
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    timeout?: number;
    fetch?: typeof fetch;
}

/**
 * What every client does the same way: sign a request, hand it over and
 * read the answer back, checking its signature against the same secret.
 * A client only says where its endpoints live.
 */
export abstract class SignedClient {
    /**
     * The header the API key travels in.
     */
    static readonly API_KEY_HEADER = 'X-Api-Key';

    protected readonly signature: Signature;

    protected readonly fetch: typeof fetch;

    constructor(private readonly connection: Connection) {
        this.signature = new Signature(connection.apiSecret);
        this.fetch = connection.fetch ?? globalThis.fetch;
    }

    /**
     * The path of an endpoint, as it is signed: with its leading slash and
     * nothing in front of it.
     */
    protected abstract path(endpoint: string): string;

    /**
     * Sign what is being asked for, hand it over and read the answer back.
     * The body is signed exactly as it is sent, character for character,
     * so it is written once and used for both.
     */
    protected async send(message: Message): Promise<Body> {
        const path = this.path(message.path);
        const payload = JSON.stringify(message.body);
        const headers: Record<string, string> = {
            [SignedClient.API_KEY_HEADER]: this.connection.apiKey,
            ...this.signature.headers('POST', path, payload),
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };

        let response: globalThis.Response;
        let text: string;

        try {
            response = await this.fetch(this.url(path), {
                method: 'POST',
                headers,
                body: payload,
                signal: AbortSignal.timeout(this.connection.timeout ?? 60_000),
            });
            text = await response.text();
        } catch (error) {
            throw new TransportError(`Ödeme geçidine ulaşılamadı: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        }

        return this.read(response, text, 'POST', path);
    }

    /**
     * The full address of a path.
     */
    private url(path: string): string {
        return `${this.connection.baseUrl.replace(/\/+$/, '')}${path}`;
    }

    /**
     * Read the answer. An outcome is answered with 200 and signed, however
     * the payment itself turned out: a payment the provider declined is an
     * outcome like any other and comes back rather than being raised. The
     * signature is checked over the method and path of the request and the
     * answer's own moment and body.
     *
     * Anything else is a refusal — the request never became a payment — and
     * the status says which kind. The gateway signs some of those too, but a
     * signature does not make a refusal an outcome, so the status is read
     * first.
     */
    private read(response: globalThis.Response, payload: string, method: string, path: string): Body {
        const status = response.status;

        if (status === 200) {
            const verified = this.signature.verifyMessage(
                method,
                path,
                payload,
                response.headers.get(Signature.TIMESTAMP_HEADER),
                response.headers.get(Signature.HEADER),
            );

            if (!verified) {
                throw new SignatureError('Yanıtın imzası doğrulanamadı; yanıt ödeme geçidinden gelmemiş olabilir.');
            }

            return this.decode(payload, status);
        }

        const [message, errors] = this.refusal(payload);

        switch (status) {
            case 401:
                throw new AuthenticationError(message);
            case 403:
                throw new ForbiddenError(message);
            case 404:
                throw new NotFoundError(message);
            case 422:
                throw new ValidationError(message, errors);
            case 429:
                throw new RateLimitError(message, retryAfter(response.headers.get('Retry-After')));
            default:
                throw new UnexpectedResponseError(message, status);
        }
    }

    /**
     * What a refusal says. The gateway answers in the one shape it answers
     * everything in, so what went wrong and which fields it is about are
     * found under `result`.
     */
    private refusal(payload: string): [string, Record<string, string[]>] {
        const body = this.parse(payload);
        const result = isObject(body?.result) ? body.result : {};

        const message = typeof result.message === 'string'
            ? result.message
            : typeof body?.message === 'string' ? body.message : 'Ödeme geçidi isteği reddetti.';

        const errors = isObject(result.errors)
            ? result.errors
            : isObject(body?.errors) ? body.errors : {};

        return [message, errors as Record<string, string[]>];
    }

    /**
     * Read a body the signature has already vouched for.
     */
    protected decode(payload: string, status: number): Body {
        const body = this.parse(payload);

        if (body === null) {
            throw new UnexpectedResponseError(`Ödeme geçidi ${status} durumuyla okunamayan bir yanıt döndü.`, status);
        }

        return body;
    }

    private parse(payload: string): Body | null {
        try {
            const body: unknown = JSON.parse(payload);

            return isObject(body) ? body : null;
        } catch {
            return null;
        }
    }
}

function isObject(value: unknown): value is Body {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * How long the gateway asked to wait before trying again, in seconds.
 */
function retryAfter(value: string | null): number | null {
    return value !== null && /^[0-9]+$/.test(value) ? Number(value) : null;
}
