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
 * The gateway did not accept the credentials: the API key is not the one
 * issued to the team in the address, the request was not signed with the
 * matching secret, or its moment of signing lies too far from now.
 */
export class AuthenticationError extends OdemehubError {}

/**
 * The credentials were accepted, but the team may not do this: it cannot
 * take payments for now (an unpaid balance, its plan), or its plan does not
 * include the feature the endpoint belongs to.
 */
export class ForbiddenError extends OdemehubError {}

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
 * The gateway answered with something that is neither an outcome nor a
 * refusal this client has a name for; the status says what it was.
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
 * The record the request names — by its token, or by the merchant's own
 * reference for it — is not one of the team's.
 */
export class NotFoundError extends OdemehubError {}

/**
 * The team has sent more requests in the last minute than the gateway
 * takes. Nothing was done; try again once `retryAfter` seconds have passed.
 */
export class RateLimitError extends OdemehubError {
    constructor(
        message: string,
        /** How long the gateway asked to wait before trying again, in seconds; null when it did not say. */
        readonly retryAfter: number | null = null,
    ) {
        super(message);
    }
}

/**
 * The request reached the gateway and was signed correctly, but its contents
 * were refused. No payment was attempted.
 */
export class ValidationError extends OdemehubError {
    constructor(
        message: string,
        /** The refused fields, each with the reasons it was refused, by their dotted names: `transaction.amount`, `order.items.0.name`. */
        readonly errors: Record<string, string[]> = {},
    ) {
        super(message);
    }
}
