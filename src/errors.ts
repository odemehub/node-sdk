/**
 * Base class for everything this client raises, so a caller that does not
 * care which way a payment failed can catch one thing.
 */
export class OdemehubError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = new.target.name;
    }
}

/**
 * The gateway did not accept the credentials: either the API key is not the
 * one issued to the team in the address, or the request was not signed with
 * the matching secret.
 */
export class AuthenticationError extends OdemehubError {}

/**
 * The answer did not carry the signature it should have. It was not signed
 * with the secret this client holds, so it cannot be shown to have come from
 * the gateway and must not be acted on.
 */
export class SignatureError extends OdemehubError {}

/**
 * The gateway could not be reached at all. Whether the payment was made is
 * unknown; the payment record on the gateway says what actually happened.
 */
export class TransportError extends OdemehubError {}

/**
 * The gateway answered with something that is neither a payment outcome nor
 * a refusal this client knows how to read.
 */
export class UnexpectedResponseError extends OdemehubError {
    constructor(
        message: string,
        readonly status: number,
        options?: { cause?: unknown },
    ) {
        super(message, options);
    }
}

/**
 * The request reached the gateway and was signed correctly, but its contents
 * were refused. No payment was attempted.
 */
export class ValidationError extends OdemehubError {
    constructor(
        message: string,
        /** The refused fields, each with the reasons it was refused. */
        readonly errors: Record<string, string[]> = {},
    ) {
        super(message);
    }
}
