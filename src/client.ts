import * as body from './body.js';
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
import type * as Request from './request.js';
import * as Response from './response.js';
import { Signature } from './signature.js';

/**
 * The address the gateway is reached at and the credentials it is reached
 * with. A credential pair belongs to a single team, and the team is part of
 * the address, so a pair only ever opens its own team's endpoints.
 */
export interface Options {
    /** The address the application is served from, e.g. https://app.odemehub.com. */
    baseUrl: string;
    /** The team the payments are made on behalf of: the ten-digit workspace id the Entegrasyon page shows. */
    team: string;
    apiKey: string;
    apiSecret: string;
    /** How long a request may take, in milliseconds. Left out, a minute. */
    timeout?: number;
    /** The fetch the requests go through. Left out, Node's own. */
    fetch?: typeof fetch;
}

/**
 * The gateway, as the merchant's application talks to it. Every request
 * leaves signed with the team's secret and every answer is checked against
 * it, so both sides can tell the other is really who it says it is.
 *
 * There is one method per endpoint, named after it: `create-order` is
 * `createOrder()`, `retrieve-saved-cards` is `retrieveSavedCards()`.
 */
export class Client {
    /**
     * The header the API key travels in.
     */
    static readonly API_KEY_HEADER = 'X-Api-Key';

    private readonly signature: Signature;

    private readonly fetch: typeof fetch;

    constructor(private readonly options: Options) {
        this.signature = new Signature(options.apiSecret);
        this.fetch = options.fetch ?? globalThis.fetch;
    }

    /**
     * Start a payment the customer confirms with their bank. A successful
     * answer is not a settled payment: the customer still has to be sent to
     * the address it comes back with, and `retrievePayments` says what
     * became of it once they are back.
     */
    async securePayment(payment: Request.SecurePayment): Promise<Response.SecurePayment> {
        return Response.SecurePayment.fromBody(await this.send(body.securePayment(payment)));
    }

    /**
     * Charge a payment straight to the card. A successful answer is a
     * settled payment.
     */
    async regularPayment(payment: Request.RegularPayment): Promise<Response.RegularPayment> {
        return Response.RegularPayment.fromBody(await this.send(body.regularPayment(payment)));
    }

    /**
     * Give money back out of a payment the provider has settled, whole or
     * in part.
     */
    async refundPayment(refund: Request.RefundPayment): Promise<Response.GiveBack> {
        return Response.GiveBack.fromBody(await this.send(body.refundPayment(refund)));
    }

    /**
     * Take back the whole of a payment the provider has not settled yet.
     */
    async cancelPayment(cancel: Request.CancelPayment): Promise<Response.GiveBack> {
        return Response.GiveBack.fromBody(await this.send(body.cancelPayment(cancel)));
    }

    /**
     * Payments as they stand — by token, every attempt under one of the
     * merchant's own references, or the ones made between two days; the
     * last seven days when nothing is named.
     */
    async retrievePayments(payments: Request.RetrievePayments = {}): Promise<Response.PaymentList> {
        return Response.PaymentList.fromBody(await this.send(body.retrievePayments(payments)));
    }

    /**
     * Ask what is known about a card from the head of its number, and how
     * the amount may be paid off on it. Nothing is charged and nothing is
     * written down.
     */
    async retrieveBin(retrieveBin: Request.RetrieveBin): Promise<Response.Bin> {
        return Response.Bin.fromBody(await this.send(body.retrieveBin(retrieveBin)));
    }

    /**
     * Open an order to be paid on the gateway's own page. Every call opens
     * a new order under a new token, even under a reference already sent;
     * keep the token the answer carries.
     */
    async createOrder(order: Request.CreateOrder): Promise<Response.OrderDetails> {
        return Response.OrderDetails.fromBody(await this.send(body.createOrder(order)));
    }

    /**
     * Orders as they stand, each with its customer.
     */
    async retrieveOrders(orders: Request.RetrieveOrders = {}): Promise<Response.OrderList> {
        return Response.OrderList.fromBody(await this.send(body.retrieveOrders(orders)));
    }

    /**
     * Change an open order. Only what is sent is written.
     */
    async updateOrder(order: Request.UpdateOrder): Promise<Response.OrderDetails> {
        return Response.OrderDetails.fromBody(await this.send(body.updateOrder(order)));
    }

    /**
     * Open a payment link. Every call opens a new link under a new token,
     * even under a reference already sent; keep the token the answer
     * carries. The address that comes back is the link itself.
     */
    async createPaymentLink(paymentLink: Request.CreatePaymentLink): Promise<Response.PaymentLinkDetails> {
        return Response.PaymentLinkDetails.fromBody(await this.send(body.createPaymentLink(paymentLink)));
    }

    /**
     * Payment links as they stand, each with the latest fifty payment
     * attempts made on it and how many there have been in all.
     */
    async retrievePaymentLinks(paymentLinks: Request.RetrievePaymentLinks = {}): Promise<Response.PaymentLinkList> {
        return Response.PaymentLinkList.fromBody(await this.send(body.retrievePaymentLinks(paymentLinks)));
    }

    /**
     * Change a payment link: its lines or what the payer may pay, its
     * money, its last day, whether it takes payments. Only what is sent is
     * written.
     */
    async updatePaymentLink(paymentLink: Request.UpdatePaymentLink): Promise<Response.PaymentLinkDetails> {
        return Response.PaymentLinkDetails.fromBody(await this.send(body.updatePaymentLink(paymentLink)));
    }

    /**
     * Payments made at the team's links, each with what was paid, the link
     * it was paid at, who paid as they billed themselves and — once it is
     * paid — the payment that paid it.
     */
    async retrieveLinkPayments(linkPayments: Request.RetrieveLinkPayments = {}): Promise<Response.LinkPaymentList> {
        return Response.LinkPaymentList.fromBody(await this.send(body.retrieveLinkPayments(linkPayments)));
    }

    /**
     * Open a subscription, its first renewal to be paid on the gateway's own
     * page and the rest taken from the card kept then. Every call opens a
     * new subscription under a new token, even under a reference already
     * sent; keep the token the answer carries.
     */
    async createSubscription(subscription: Request.CreateSubscription): Promise<Response.SubscriptionDetails> {
        return Response.SubscriptionDetails.fromBody(await this.send(body.createSubscription(subscription)));
    }

    /**
     * Subscriptions as they stand, each with its customer and the renewal it
     * is on.
     */
    async retrieveSubscriptions(subscriptions: Request.RetrieveSubscriptions = {}): Promise<Response.SubscriptionList> {
        return Response.SubscriptionList.fromBody(await this.send(body.retrieveSubscriptions(subscriptions)));
    }

    /**
     * Change a subscription, or call it off with the status `cancelled`.
     * Only what is sent is written.
     */
    async updateSubscription(subscription: Request.UpdateSubscription): Promise<Response.SubscriptionDetails> {
        return Response.SubscriptionDetails.fromBody(await this.send(body.updateSubscription(subscription)));
    }

    /**
     * Keep a card for a customer without making a payment on it.
     */
    async createSavedCard(savedCard: Request.CreateSavedCard): Promise<Response.SavedCardDetails> {
        return Response.SavedCardDetails.fromBody(await this.send(body.createSavedCard(savedCard)));
    }

    /**
     * Kept cards — by token, every card of a customer by their reference, or
     * the ones kept between two days — each with its customer, the default
     * first.
     */
    async retrieveSavedCards(savedCards: Request.RetrieveSavedCards = {}): Promise<Response.SavedCardList> {
        return Response.SavedCardList.fromBody(await this.send(body.retrieveSavedCards(savedCards)));
    }

    /**
     * Make a kept card the one its customer pays with by default.
     */
    async updateSavedCard(savedCard: Request.UpdateSavedCard): Promise<Response.SavedCardDetails> {
        return Response.SavedCardDetails.fromBody(await this.send(body.updateSavedCard(savedCard)));
    }

    /**
     * Let go of a kept card, at the provider and with the gateway.
     */
    async deleteSavedCard(savedCard: Request.DeleteSavedCard): Promise<Response.DeletedSavedCard> {
        return Response.DeletedSavedCard.fromBody(await this.send(body.deleteSavedCard(savedCard)));
    }

    /**
     * Read a word the gateway posted to one of the merchant's webhook
     * addresses. Hand it the request exactly as it arrived — the method,
     * the path of the address it came to (without the query string), the
     * raw body byte for byte and the two headers — and nothing in it is
     * believed until the signature is checked against the secret.
     *
     * With Express, read the body raw for this route, e.g.
     * `express.raw({ type: 'application/json' })`, and hand over `req.body`.
     *
     * The word only names what it is about; ask the gateway what became of
     * it before acting on it. Answer with any 2xx once the word is taken;
     * the gateway tries again, up to five times, until it hears one.
     *
     * @throws {SignatureError} when the signature does not hold.
     */
    webhook(method: string, path: string, payload: string | Uint8Array, timestamp: string | null | undefined, signature: string | null | undefined): Response.Webhook {
        const text = typeof payload === 'string' ? payload : Buffer.from(payload).toString('utf8');

        if (!this.verifyWebhook(method, path, text, timestamp, signature)) {
            throw new SignatureError('Bildirimin imzası doğrulanamadı; bildirim ödeme geçidinden gelmemiş olabilir.');
        }

        return Response.Webhook.fromBody(this.decode(text, 0));
    }

    /**
     * Whether a word that arrived at a webhook address was signed by the
     * gateway with this team's secret, recently enough to be taken. The
     * path is the address's own, with its leading slash and without the
     * query string; the body is the raw text, byte for byte.
     */
    verifyWebhook(method: string, path: string, payload: string | Uint8Array, timestamp: string | null | undefined, signature: string | null | undefined): boolean {
        const text = typeof payload === 'string' ? payload : Buffer.from(payload).toString('utf8');

        return this.signature.verifyMessage(method, path, text, timestamp, signature);
    }

    /**
     * Sign what is being asked for, hand it to the gateway and read the
     * answer back. The body is signed exactly as it is sent, character for
     * character, so it is written once and used for both.
     */
    private async send(message: Message): Promise<Body> {
        const path = this.path(message.path);
        const payload = JSON.stringify(message.body);
        const headers: Record<string, string> = {
            [Client.API_KEY_HEADER]: this.options.apiKey,
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
                signal: AbortSignal.timeout(this.options.timeout ?? 60_000),
            });
            text = await response.text();
        } catch (error) {
            throw new TransportError(`Ödeme geçidine ulaşılamadı: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        }

        return this.read(response, text, 'POST', path);
    }

    /**
     * The path of a gateway endpoint for this team, as it is signed: with
     * its leading slash and nothing in front of it.
     */
    private path(endpoint: string): string {
        return `/api/${this.options.team}/gateway/${endpoint}`;
    }

    /**
     * The full address of a gateway path.
     */
    private url(path: string): string {
        return `${this.options.baseUrl.replace(/\/+$/, '')}${path}`;
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
    private decode(payload: string, status: number): Body {
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
