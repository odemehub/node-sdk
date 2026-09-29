import * as body from './body.js';
import type { Body, Message } from './body.js';
import {
    AuthenticationError,
    SignatureError,
    TransportError,
    UnexpectedResponseError,
    ValidationError,
} from './errors.js';
import type * as Request from './request.js';
import * as Response from './response.js';
import { Signature } from './signature.js';

/**
 * The address the gateway is reached at, the credentials it is reached with
 * and the channel the caller speaks for. A credential pair belongs to a
 * single team, and the team is part of the address, so a pair only ever
 * opens its own team's endpoints.
 */
export interface Options {
    /** The address the application is served from, e.g. https://odeme.gurmehub.com. */
    baseUrl: string;
    /** The team the payments are made on behalf of, as the Entegrasyon page names it. */
    team: string;
    /**
     * The channel every request speaks for: the shop, the marketplace or the
     * branch the customer reached the merchant through, by the token the
     * team's own Kanallar page gives it. A merchant selling on more than one
     * channel may still name another on a single request.
     */
    channelToken: string;
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
     * answer is not a settled payment: the customer is still to be sent to
     * the address it comes back with.
     */
    async securePayment(payment: Request.SecurePayment): Promise<Response.SecurePayment> {
        return Response.SecurePayment.fromBody(await this.send(body.securePayment(payment, this.options.channelToken)));
    }

    /**
     * Charge a payment straight to the card. A successful answer is a
     * settled payment.
     */
    async regularPayment(payment: Request.RegularPayment): Promise<Response.RegularPayment> {
        return Response.RegularPayment.fromBody(await this.send(body.regularPayment(payment, this.options.channelToken)));
    }

    /**
     * Open an order to be paid on the gateway's own page, and get back the
     * address to send the customer to.
     */
    async orderPayment(orderPayment: Request.OrderPayment): Promise<Response.OrderPayment> {
        return Response.OrderPayment.fromBody(await this.send(body.orderPayment(orderPayment, this.options.channelToken)));
    }

    /**
     * Open a subscription. The customer is sent to the address it comes back
     * with and pays there, and the periods after that are taken from the
     * card they pay with.
     */
    async subscriptionPayment(subscription: Request.SubscriptionPayment): Promise<Response.Subscription> {
        return Response.Subscription.fromBody(await this.send(body.subscriptionPayment(subscription, this.options.channelToken)));
    }

    /**
     * Give money back out of a payment the provider has settled, whole or in
     * part. A refund that names no amount gives back everything the payment
     * has left in it.
     */
    async refundPayment(refund: Request.RefundPayment): Promise<Response.GiveBack> {
        return Response.GiveBack.fromBody(await this.send(body.refundPayment(refund)));
    }

    /**
     * Take back the whole of a payment the provider has not settled yet.
     * Anything less than the whole of it goes back as a refund instead.
     */
    async cancelPayment(cancel: Request.CancelPayment): Promise<Response.GiveBack> {
        return Response.GiveBack.fromBody(await this.send(body.cancelPayment(cancel)));
    }

    /**
     * How a payment went. A customer sent to their bank comes back to the
     * merchant with the payment's token and a hint at how it went; the hint
     * is worth nothing on its own, and this call says what really became of it.
     */
    async retrievePayment(payment: Request.RetrievePayment): Promise<Response.Payment> {
        return Response.Payment.fromBody(await this.send(body.retrievePayment(payment)));
    }

    /**
     * Ask what the gateway's provider knows about a card by the head of its
     * number, and how an amount may be paid off on it. Nothing is charged and
     * nothing is written down.
     */
    async retrieveBin(retrieveBin: Request.RetrieveBin): Promise<Response.Bin> {
        return Response.Bin.fromBody(await this.send(body.retrieveBin(retrieveBin)));
    }

    /**
     * Save a product in the merchant's catalogue at the gateway, or change
     * the one already saved under the same key on the same channel. Order
     * lines and subscriptions name products by key.
     */
    async saveProduct(product: Request.SaveProduct): Promise<Response.Product> {
        return Response.Product.fromBody(await this.send(body.saveProduct(product, this.options.channelToken)));
    }

    /**
     * Where a subscription stands: what it is for, the period it is on and
     * whether that period has been paid for.
     */
    async retrieveSubscription(subscription: Request.RetrieveSubscription): Promise<Response.Subscription> {
        return Response.Subscription.fromBody(await this.send(body.retrieveSubscription(subscription)));
    }

    /**
     * Call a subscription off. Nothing is given back: the customer keeps the
     * days they already paid for and is served to the end of them, and
     * nothing is charged after that.
     */
    async cancelSubscription(subscription: Request.CancelSubscription): Promise<Response.Subscription> {
        return Response.Subscription.fromBody(await this.send(body.cancelSubscription(subscription)));
    }

    /**
     * Keep a card for a customer without making a payment on it.
     */
    async saveCard(saveCard: Request.SaveCard): Promise<Response.KeptCard> {
        return Response.KeptCard.fromBody(await this.send(body.saveCard(saveCard, this.options.channelToken)));
    }

    /**
     * The cards a customer let the merchant keep, the default one first.
     */
    async savedCards(savedCards: Request.SavedCards): Promise<Response.KeptCards> {
        return Response.KeptCards.fromBody(await this.send(body.savedCards(savedCards, this.options.channelToken)));
    }

    /**
     * Make one of a customer's kept cards the one they pay with unless they
     * say otherwise.
     */
    async defaultSavedCard(defaultSavedCard: Request.DefaultSavedCard): Promise<Response.KeptCard> {
        return Response.KeptCard.fromBody(await this.send(body.defaultSavedCard(defaultSavedCard, this.options.channelToken)));
    }

    /**
     * Let go of one of a customer's kept cards, at the provider and here.
     */
    async deleteSavedCard(deleteSavedCard: Request.DeleteSavedCard): Promise<Response.KeptCard> {
        return Response.KeptCard.fromBody(await this.send(body.deleteSavedCard(deleteSavedCard, this.options.channelToken)));
    }

    /**
     * Read the word the gateway sent about a subscription: posted to the
     * address the subscription was opened with, as plain JSON signed in the
     * `X-Signature` header. Hand it the body exactly as it arrived, byte for
     * byte, together with the header; nothing in it is to be believed until
     * the signature holds.
     *
     * With Express, read the body raw for this route, e.g.
     * `express.raw({ type: 'application/json' })`, and hand over `req.body`.
     *
     * @throws {SignatureError} when the signature does not hold.
     */
    subscriptionWebhook(payload: string | Uint8Array, signature: string | null | undefined): Response.SubscriptionWebhook {
        if (!this.signature.verify(payload, signature)) {
            throw new SignatureError('Bildirimin imzası doğrulanamadı; bildirim ödeme geçidinden gelmemiş olabilir.');
        }

        const text = typeof payload === 'string' ? payload : Buffer.from(payload).toString('utf8');

        return Response.SubscriptionWebhook.fromBody(this.decode(text, 0));
    }

    /**
     * Sign what is being asked for, hand it to the gateway and read the
     * answer back. The body is signed exactly as it is sent, character for
     * character, so it is written once and used for both.
     */
    private async send(message: Message): Promise<Body> {
        const payload = JSON.stringify(message.body);
        let response: globalThis.Response;
        let text: string;

        try {
            response = await this.fetch(this.url(message.path), {
                method: 'POST',
                headers: {
                    [Client.API_KEY_HEADER]: this.options.apiKey,
                    [Signature.HEADER]: this.signature.sign(payload),
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: payload,
                signal: AbortSignal.timeout(this.options.timeout ?? 60_000),
            });
            text = await response.text();
        } catch (error) {
            throw new TransportError(`Ödeme geçidine ulaşılamadı: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        }

        return this.read(response.status, text, response.headers.get(Signature.HEADER));
    }

    /**
     * The full address of a gateway endpoint for this team.
     */
    private url(path: string): string {
        return `${this.options.baseUrl.replace(/\/+$/, '')}/api/${this.options.team}/gateway/${path}`;
    }

    /**
     * Read the answer. An outcome is answered with 200 and signed, however
     * the payment itself turned out: a payment the provider declined is an
     * outcome like any other and comes back rather than being raised.
     *
     * Anything else is a refusal — the request never became a payment — and
     * the status says which kind. The gateway signs some of those too, but a
     * signature does not make a refusal an outcome, so the status is read
     * first.
     */
    private read(status: number, payload: string, signature: string | null): Body {
        if (status === 200) {
            if (!this.signature.verify(payload, signature === '' ? null : signature)) {
                throw new SignatureError('Yanıtın imzası doğrulanamadı; yanıt ödeme geçidinden gelmemiş olabilir.');
            }

            return this.decode(payload, status);
        }

        const [message, errors] = this.refusal(payload);

        if (status === 401) {
            throw new AuthenticationError(message);
        }

        if (status === 422) {
            throw new ValidationError(message, errors);
        }

        throw new UnexpectedResponseError(message, status);
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
