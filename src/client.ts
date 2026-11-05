import { SignedClient } from './base.js';
import * as body from './body.js';
import { SignatureError } from './errors.js';
import type * as Request from './request.js';
import * as Response from './response.js';

/**
 * The address the gateway is reached at and the credentials it is reached
 * with. A credential pair belongs to a single team, and the team is part of
 * the address, so a pair only ever opens its own team's endpoints.
 */
export interface Options {
    /** The address the application is served from, e.g. https://sandbox.odemehub.com while building and https://app.odemehub.com once live. */
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
export class Client extends SignedClient {
    constructor(private readonly options: Options) {
        super(options);
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
     * The banks whose accounts may be added, each with the credentials it
     * asks for.
     */
    async retrieveBanks(): Promise<Response.BankList> {
        return Response.BankList.fromBody(await this.send(body.retrieveBanks()));
    }

    /**
     * Add a bank account whose movements are to be read. The bank is asked
     * first; credentials it turns down add nothing, and the answer says why
     * rather than raising.
     */
    async createBankAccount(bankAccount: Request.CreateBankAccount): Promise<Response.BankAccountDetails> {
        return Response.BankAccountDetails.fromBody(await this.send(body.createBankAccount(bankAccount)));
    }

    /**
     * Bank accounts as they stand — by token, or every account of the
     * team's when none is named.
     */
    async retrieveBankAccounts(bankAccounts: Request.RetrieveBankAccounts = {}): Promise<Response.BankAccountList> {
        return Response.BankAccountList.fromBody(await this.send(body.retrieveBankAccounts(bankAccounts)));
    }

    /**
     * Rename a bank account or replace its credentials. Only what is sent is
     * written; new credentials are tried against the bank first.
     */
    async updateBankAccount(bankAccount: Request.UpdateBankAccount): Promise<Response.BankAccountDetails> {
        return Response.BankAccountDetails.fromBody(await this.send(body.updateBankAccount(bankAccount)));
    }

    /**
     * Remove a bank account and every movement read off it.
     */
    async deleteBankAccount(bankAccount: Request.DeleteBankAccount): Promise<Response.DeletedBankAccount> {
        return Response.DeletedBankAccount.fromBody(await this.send(body.deleteBankAccount(bankAccount)));
    }

    /**
     * Movements on bank accounts, by the accounts' tokens, over seven days
     * at most, a page at a time. They are read from what the gateway keeps,
     * which it reads from the bank within the hour.
     */
    async retrieveBankTransactions(bankTransactions: Request.RetrieveBankTransactions): Promise<Response.BankTransactionList> {
        return Response.BankTransactionList.fromBody(await this.send(body.retrieveBankTransactions(bankTransactions)));
    }

    /**
     * The providers a payment account may be added for, each with the
     * settings it asks for. Like every method down to `createLogo()`, this
     * only works on a team a partner opened; any other team gets a
     * `ForbiddenError`.
     */
    async retrieveProviders(): Promise<Response.ProviderList> {
        return Response.ProviderList.fromBody(await this.send(body.retrieveProviders()));
    }

    /**
     * Add a payment account. The provider is not asked whether it takes the
     * settings; the first payment through the account finds out.
     */
    async createPaymentProvider(paymentProvider: Request.CreatePaymentProvider): Promise<Response.PaymentProviderDetails> {
        return Response.PaymentProviderDetails.fromBody(await this.send(body.createPaymentProvider(paymentProvider)));
    }

    /**
     * Payment accounts as they stand — by token, or every account of the
     * team's when none is named. Their settings are never shown.
     */
    async retrievePaymentProviders(paymentProviders: Request.RetrievePaymentProviders = {}): Promise<Response.PaymentProviderList> {
        return Response.PaymentProviderList.fromBody(await this.send(body.retrievePaymentProviders(paymentProviders)));
    }

    /**
     * Rename a payment account, replace its settings or make it the
     * default. Only what is sent is written.
     */
    async updatePaymentProvider(paymentProvider: Request.UpdatePaymentProvider): Promise<Response.PaymentProviderDetails> {
        return Response.PaymentProviderDetails.fromBody(await this.send(body.updatePaymentProvider(paymentProvider)));
    }

    /**
     * Remove a payment account.
     */
    async deletePaymentProvider(paymentProvider: Request.DeletePaymentProvider): Promise<Response.DeletedPaymentProvider> {
        return Response.DeletedPaymentProvider.fromBody(await this.send(body.deletePaymentProvider(paymentProvider)));
    }

    /**
     * Put down an address the gateway posts the team's webhooks to.
     */
    async createWebhookEndpoint(webhookEndpoint: Request.CreateWebhookEndpoint): Promise<Response.WebhookEndpointDetails> {
        return Response.WebhookEndpointDetails.fromBody(await this.send(body.createWebhookEndpoint(webhookEndpoint)));
    }

    /**
     * Webhook addresses as they stand — by token, or every address of the
     * team's when none is named.
     */
    async retrieveWebhookEndpoints(webhookEndpoints: Request.RetrieveWebhookEndpoints = {}): Promise<Response.WebhookEndpointList> {
        return Response.WebhookEndpointList.fromBody(await this.send(body.retrieveWebhookEndpoints(webhookEndpoints)));
    }

    /**
     * Change a webhook address, its events, or switch it on or off. Only
     * what is sent is written.
     */
    async updateWebhookEndpoint(webhookEndpoint: Request.UpdateWebhookEndpoint): Promise<Response.WebhookEndpointDetails> {
        return Response.WebhookEndpointDetails.fromBody(await this.send(body.updateWebhookEndpoint(webhookEndpoint)));
    }

    /**
     * Take a webhook address away.
     */
    async deleteWebhookEndpoint(webhookEndpoint: Request.DeleteWebhookEndpoint): Promise<Response.DeletedWebhookEndpoint> {
        return Response.DeletedWebhookEndpoint.fromBody(await this.send(body.deleteWebhookEndpoint(webhookEndpoint)));
    }

    /**
     * Rename the team, or give it another clock. Only what is sent is
     * written.
     */
    async updateTeam(team: Request.UpdateTeam): Promise<Response.TeamDetails> {
        return Response.TeamDetails.fromBody(await this.send(body.updateTeam(team)));
    }

    /**
     * How the team's checkout page is dressed.
     */
    async retrieveCheckoutDesign(): Promise<Response.CheckoutDesignDetails> {
        return Response.CheckoutDesignDetails.fromBody(await this.send(body.retrieveCheckoutDesign()));
    }

    /**
     * Change how the team's checkout page is dressed. Only what is sent is
     * written; every payer sees it from the next page they open.
     */
    async updateCheckoutDesign(checkoutDesign: Request.UpdateCheckoutDesign): Promise<Response.CheckoutDesignDetails> {
        return Response.CheckoutDesignDetails.fromBody(await this.send(body.updateCheckoutDesign(checkoutDesign)));
    }

    /**
     * Keep a logo for the team. The address that comes back is what
     * `updateCheckoutDesign()` names it by.
     */
    async createLogo(logo: Request.CreateLogo): Promise<Response.LogoDetails> {
        return Response.LogoDetails.fromBody(await this.send(body.createLogo(logo)));
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
     * The path of a gateway endpoint for this team, as it is signed: with
     * its leading slash and nothing in front of it.
     */
    protected path(endpoint: string): string {
        return `/api/${this.options.team}/gateway/${endpoint}`;
    }
}
