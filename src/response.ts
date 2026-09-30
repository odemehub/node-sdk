/**
 * What the gateway answers with, read out of its snake_case body into
 * camelCase objects. A field the gateway left out reads as an empty string,
 * or as null where the answer may genuinely not carry it.
 */

type Body = Record<string, unknown>;

/**
 * The data a response object is built from: its fields, without its methods.
 */
type Fields<T> = { [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K] };

function object(value: unknown): Body {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Body) : {};
}

function list(value: unknown): unknown[] {
    if (Array.isArray(value)) {
        return value;
    }

    return value !== null && typeof value === 'object' ? Object.values(value) : [];
}

function string(value: unknown): string {
    return value === undefined || value === null ? '' : String(value);
}

function optionalString(value: unknown): string | null {
    return value === undefined || value === null ? null : String(value);
}

/**
 * A field the gateway left empty reads as nothing rather than as an empty
 * string, so there is one way of asking whether it was said.
 */
function said(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
}

function boolean(value: unknown): boolean {
    return Boolean(value) && value !== '0';
}

function integer(value: unknown): number {
    return Math.trunc(Number(value)) || 0;
}

/**
 * How a request went, as every answer opens: whether it worked and, only
 * when it did not, what went wrong.
 */
export class Result {
    declare readonly successful: boolean;
    declare readonly message: string | null;

    constructor(fields: Fields<Result>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): Result {
        const result = object(body.result);

        return new Result({
            successful: boolean(result.successful),
            message: said(result.message),
        });
    }
}

/**
 * What reached the card, for a payment the merchant's conversion rules
 * charged in another money than it was asked in.
 */
export class Conversion {
    /** What was taken from the card. */
    declare readonly amount: string;
    /** The money it was taken in, e.g. TRY. */
    declare readonly currency: string;
    /** What a unit of the asked-for money was charged as, with any margin on top. */
    declare readonly rate: string;

    constructor(fields: Fields<Conversion>) {
        Object.assign(this, fields);
    }

    static fromBody(conversion: Body): Conversion {
        return new Conversion({
            amount: string(conversion.amount),
            currency: string(conversion.currency),
            rate: string(conversion.rate),
        });
    }
}

/**
 * A card a customer let the merchant keep.
 */
export class SavedCard {
    /** The card's token in the gateway, which names it again later. */
    declare readonly token: string;
    /** The account the card is kept at; it can only be charged there. */
    declare readonly paymentProviderToken: string | null;
    declare readonly holderName: string;
    /** The network the card belongs to, e.g. visa, as far as it is known. */
    declare readonly scheme: string | null;
    /** The head of the number: eight digits, or six for a number shorter than sixteen digits. */
    declare readonly firstDigits: string;
    declare readonly lastFourDigit: string;
    declare readonly expiryMonth: string;
    declare readonly expiryYear: string;
    /** Whether this is the card the customer pays with unless they say otherwise. */
    declare readonly isDefault: boolean;
    declare readonly createdAt: string | null;

    constructor(fields: Fields<SavedCard>) {
        Object.assign(this, fields);
    }

    static fromBody(card: Body): SavedCard {
        return new SavedCard({
            token: string(card.token),
            paymentProviderToken: optionalString(card.payment_provider_token),
            holderName: string(card.holder_name),
            scheme: optionalString(card.scheme),
            firstDigits: string(card.first_digits),
            lastFourDigit: string(card.last_four_digit),
            expiryMonth: string(card.expiry_month),
            expiryYear: string(card.expiry_year),
            isDefault: boolean(card.is_default),
            createdAt: optionalString(card.created_at),
        });
    }
}

/**
 * The outcome of a payment, as the gateway reports it — whether it answers
 * straight away or posts the outcome back once the customer is home from
 * their bank. The two are the same shape, so a merchant reads them the same
 * way: how it went, which payment it was, and whose.
 *
 * A payment that was turned down is an outcome like any other and arrives
 * here; only answers that were never a payment outcome are raised as errors.
 */
export class Payment {
    declare readonly result: Result;
    /** The payment's token in the gateway, which names it again for a refund. */
    declare readonly transactionToken: string;
    /** The channel the payment came in on. */
    declare readonly channelToken: string;
    /** The reference the payment is known by in the calling system. */
    declare readonly channelReference: string;
    /** The merchant's own key for the customer the payment was made for. */
    declare readonly customerChannelReference: string;
    /**
     * The card the payment kept, for a payment that asked for one to be
     * kept. It is null while nothing was kept: because the payment did not
     * go through, because the provider handed nothing back, or because the
     * payment never asked.
     */
    declare readonly savedCard: SavedCard | null;
    /**
     * What reached the card, for a payment the merchant's conversion rules
     * charged in another money than it was asked in; null for a payment
     * charged as it was asked.
     */
    declare readonly conversion: Conversion | null;

    constructor(fields: Fields<Payment>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): Payment {
        return new Payment(Payment.parts(body));
    }

    /**
     * The pieces every payment outcome is read out of, so a kind of payment
     * that says more can add to them rather than read the body again.
     */
    protected static parts(body: Body): Fields<Payment> {
        const transaction = object(body.transaction);
        const customer = object(body.customer);

        return {
            result: Result.fromBody(body),
            transactionToken: string(transaction.token),
            channelToken: string(transaction.channel_token),
            channelReference: string(transaction.channel_reference),
            customerChannelReference: string(customer.channel_reference),
            savedCard: body.saved_card ? SavedCard.fromBody(object(body.saved_card)) : null,
            conversion: body.conversion ? Conversion.fromBody(object(body.conversion)) : null,
        };
    }
}

/**
 * A 3D payment that has been started. A successful answer is not a settled
 * payment: the customer still has to be sent to `redirectUrl`.
 */
export class SecurePayment extends Payment {
    /** Where the customer has to be sent. Always there when the payment started. */
    declare readonly redirectUrl: string | null;

    constructor(fields: Fields<SecurePayment>) {
        super(fields);
    }

    static override fromBody(body: Body): SecurePayment {
        return new SecurePayment({
            ...Payment.parts(body),
            redirectUrl: said(object(body.result).redirect_url),
        });
    }
}

/**
 * A payment charged straight to the card. A successful answer is a settled
 * payment.
 */
export class RegularPayment extends Payment {
    static override fromBody(body: Body): RegularPayment {
        return new RegularPayment(Payment.parts(body));
    }
}

/**
 * Money given back out of a payment: a cancellation or a refund.
 */
export class GiveBack extends Payment {
    /** Which of the two it was: a cancellation or a refund. */
    declare readonly type: string;
    /** How much actually went back, whether or not it was asked for by name. */
    declare readonly amount: string | null;

    constructor(fields: Fields<GiveBack>) {
        super(fields);
    }

    static override fromBody(body: Body): GiveBack {
        const refund = object(body.refund);

        return new GiveBack({
            ...Payment.parts(body),
            type: string(refund.type),
            amount: optionalString(refund.amount),
        });
    }
}

/**
 * An order opened to be paid on the gateway's own page.
 */
export class OrderPayment {
    declare readonly result: Result;
    /** The order's token in the gateway. */
    declare readonly token: string;
    /** The channel the order was opened on. */
    declare readonly channelToken: string;
    /** The number the order is known by in the calling system. */
    declare readonly channelReference: string;
    /** What the order comes to, added up from its lines by the gateway. */
    declare readonly amount: string;
    declare readonly currency: string;
    /** Where the order stands: open until it is paid. */
    declare readonly status: string;
    /** Where the customer has to be sent to pay. */
    declare readonly checkoutUrl: string;
    /** The merchant's own key for the customer the order is for. */
    declare readonly customerChannelReference: string;

    constructor(fields: Fields<OrderPayment>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): OrderPayment {
        const order = object(body.order);

        return new OrderPayment({
            result: Result.fromBody(body),
            token: string(order.token),
            channelToken: string(order.channel_token),
            channelReference: string(order.channel_reference),
            amount: string(order.amount),
            currency: string(order.currency),
            status: string(order.status),
            checkoutUrl: string(order.checkout_url),
            customerChannelReference: string(object(body.customer).channel_reference),
        });
    }
}

/**
 * A product in the merchant's catalogue at the gateway.
 */
export class Product {
    declare readonly result: Result;
    /** The channel the product is sold on. */
    declare readonly channelToken: string;
    /** The key the product is known by in the calling system. */
    declare readonly channelReference: string;
    declare readonly name: string;
    /** The address of the picture the checkout shows it with, if it has one. */
    declare readonly image: string | null;
    /** simple or recurring. */
    declare readonly type: string;
    /** The price of one, as digits with the kurus behind a point. */
    declare readonly amount: string;
    declare readonly currency: string;
    /** The tax included in the price, as a percentage. */
    declare readonly taxRate: string;
    /** monthly or annually for a recurring product; null for a simple one. */
    declare readonly period: string | null;
    /** Whether it is on sale. */
    declare readonly isActive: boolean;

    constructor(fields: Fields<Product>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): Product {
        const product = object(body.product);

        return new Product({
            result: Result.fromBody(body),
            channelToken: string(product.channel_token),
            channelReference: string(product.channel_reference),
            name: string(product.name),
            image: optionalString(product.image),
            type: string(product.type),
            amount: string(product.amount),
            currency: string(product.currency),
            taxRate: string(product.tax_rate),
            period: optionalString(product.period),
            isActive: boolean(product.is_active),
        });
    }
}

/**
 * One way an amount may be paid off on a card.
 */
export class Installment {
    declare readonly number: number;
    /** What is charged each month, as digits with the kurus behind a point. */
    declare readonly amount: string;
    /** What the card is charged in all, the same way. */
    declare readonly total: string;

    constructor(fields: Fields<Installment>) {
        Object.assign(this, fields);
    }

    static fromBody(installment: Body): Installment {
        return new Installment({
            number: integer(installment.number),
            amount: string(installment.amount),
            total: string(installment.total),
        });
    }
}

/**
 * What the gateway's provider knows about a card by the head of its number,
 * and how an amount may be paid off on it.
 */
export class Bin {
    declare readonly result: Result;
    /** The digits the question was asked with. */
    declare readonly bin: string;
    /** The institution that issued the card. */
    declare readonly issuerName: string | null;
    declare readonly issuerCode: string | null;
    /** The scheme the card is issued on, e.g. visa, as the issuer reports it. */
    declare readonly scheme: string | null;
    /** Whether the money is lent, drawn from an account or loaded beforehand: credit, debit or prepaid. */
    declare readonly type: string | null;
    /** The programme the card is sold under, such as Bonus or Maximum. */
    declare readonly program: string | null;
    /** Whether the card belongs to a company rather than to a person. */
    declare readonly isCommercial: boolean | null;
    /** The ways the amount may be paid off, a single payment first. */
    declare readonly installments: Installment[];

    constructor(fields: Fields<Bin>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): Bin {
        const card = object(body.card);

        return new Bin({
            result: Result.fromBody(body),
            bin: string(card.bin),
            issuerName: optionalString(card.issuer_name),
            issuerCode: optionalString(card.issuer_code),
            scheme: optionalString(card.scheme),
            type: optionalString(card.type),
            program: optionalString(card.program),
            isCommercial: card.is_commercial === undefined || card.is_commercial === null ? null : boolean(card.is_commercial),
            installments: list(body.installments).map((installment) => Installment.fromBody(object(installment))),
        });
    }
}

/**
 * A card kept, made the default or let go of.
 */
export class KeptCard {
    declare readonly result: Result;
    /** The card as it now stands, or null when there was none to keep. */
    declare readonly savedCard: SavedCard | null;
    /** The merchant's own key for the customer the card belongs to. */
    declare readonly customerChannelReference: string;

    constructor(fields: Fields<KeptCard>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): KeptCard {
        return new KeptCard({
            result: Result.fromBody(body),
            savedCard: body.saved_card ? SavedCard.fromBody(object(body.saved_card)) : null,
            customerChannelReference: string(object(body.customer).channel_reference),
        });
    }
}

/**
 * The cards a customer let the merchant keep, the default one first.
 */
export class KeptCards {
    declare readonly result: Result;
    declare readonly savedCards: SavedCard[];
    /** The merchant's own key for the customer the cards belong to. */
    declare readonly customerChannelReference: string;

    constructor(fields: Fields<KeptCards>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): KeptCards {
        return new KeptCards({
            result: Result.fromBody(body),
            savedCards: list(body.saved_cards).map((card) => SavedCard.fromBody(object(card))),
            customerChannelReference: string(object(body.customer).channel_reference),
        });
    }
}

/**
 * One line of what a subscription is for.
 */
export class SubscriptionItem {
    /** The merchant's own key for the product. */
    declare readonly channelReference: string;
    declare readonly name: string;
    /** The picture shown for the line: the one named when the subscription was opened, or else the product's. */
    declare readonly image: string | null;
    declare readonly quantity: number;
    /** The price of one, as digits with the kurus behind a point. */
    declare readonly unitAmount: string;
    /** The tax included in the price, as a percentage. */
    declare readonly taxRate: string | null;

    constructor(fields: Fields<SubscriptionItem>) {
        Object.assign(this, fields);
    }

    static fromBody(item: Body): SubscriptionItem {
        return new SubscriptionItem({
            channelReference: string(item.channel_reference),
            name: string(item.name),
            image: optionalString(item.image),
            quantity: integer(item.quantity),
            unitAmount: string(item.unit_amount),
            taxRate: optionalString(item.tax_rate),
        });
    }
}

/**
 * A subscription as it stands: what it is for, the period it is on and
 * whether that period has been paid for.
 */
export class Subscription {
    declare readonly result: Result;
    /** The subscription's token in the gateway; name it to ask after it later. */
    declare readonly token: string;
    /** The channel the subscription was opened on. */
    declare readonly channelToken: string;
    /** The key the subscription is known by in the calling system. */
    declare readonly channelReference: string;
    /** What is subscribed to. */
    declare readonly items: SubscriptionItem[];
    /** Where it stands: pending, active, past_due or cancelled. */
    declare readonly status: string;
    /** How often a period comes round: monthly or annually. */
    declare readonly period: string;
    /** What the period it is on costs, with the kurus behind a point. */
    declare readonly amount: string;
    declare readonly currency: string;
    /** When the period it is on began, once it has been paid for. */
    declare readonly startsAt: string | null;
    /** When the period it is on runs out, which is when the next is charged. */
    declare readonly endsAt: string | null;
    /** When the period it is on was paid for, if it has been. */
    declare readonly paidAt: string | null;
    /** The day it was called off on, if it has been. */
    declare readonly cancelledAt: string | null;
    /** Where the customer pays the period it is on, while that is still owed. */
    declare readonly checkoutUrl: string | null;
    /** Whether it was paid for in the test environment; null until the first payment. */
    declare readonly isTest: boolean | null;
    /** The merchant's own key for the customer, answered when the subscription is opened. */
    declare readonly customerChannelReference: string | null;

    constructor(fields: Fields<Subscription>) {
        Object.assign(this, fields);
    }

    /**
     * Whether the subscription is being paid for: a customer who has been
     * through the checkout and whose card has not since been turned away.
     */
    isActive(): boolean {
        return this.status === 'active';
    }

    /**
     * Whether the first period has yet to be paid for. A subscription stays
     * here until the customer has been through the checkout.
     */
    isPending(): boolean {
        return this.status === 'pending';
    }

    /**
     * Whether a period has been left unpaid: the card was tried and turned
     * away every time, and the customer has been asked to pay it themselves
     * at `checkoutUrl`.
     */
    isPastDue(): boolean {
        return this.status === 'past_due';
    }

    /**
     * Whether it is over. A subscription that has been called off but is
     * still serving days that were paid for is not over yet — read
     * `cancelledAt` for that.
     */
    isCancelled(): boolean {
        return this.status === 'cancelled';
    }

    static fromBody(body: Body): Subscription {
        const subscription = object(body.subscription);

        return new Subscription({
            result: Result.fromBody(body),
            token: string(subscription.token),
            channelToken: string(subscription.channel_token),
            channelReference: string(subscription.channel_reference),
            items: list(subscription.items).map((item) => SubscriptionItem.fromBody(object(item))),
            status: string(subscription.status),
            period: string(subscription.period),
            amount: string(subscription.amount),
            currency: string(subscription.currency),
            startsAt: said(subscription.starts_at),
            endsAt: said(subscription.ends_at),
            paidAt: said(subscription.paid_at),
            cancelledAt: said(subscription.cancelled_at),
            checkoutUrl: said(subscription.checkout_url),
            isTest: subscription.is_test === undefined || subscription.is_test === null ? null : boolean(subscription.is_test),
            customerChannelReference: said(object(body.customer).channel_reference),
        });
    }
}

/**
 * Word the gateway sent about a subscription: the state it has reached and
 * the subscription as it stands now.
 */
export class SubscriptionWebhook {
    /** The state reached: active, past_due, cancelled or ended. */
    declare readonly event: string;
    /** The subscription as it stands now. */
    declare readonly subscription: Subscription;

    constructor(fields: Fields<SubscriptionWebhook>) {
        Object.assign(this, fields);
    }

    /**
     * Whether the subscription is being paid for: the customer has just paid
     * a period, whether the first or a later one.
     */
    isActive(): boolean {
        return this.event === 'active';
    }

    /**
     * Whether a period was left unpaid. The card was tried and turned away
     * every time, and the customer has been asked to pay it themselves at
     * the subscription's `checkoutUrl`.
     */
    isPastDue(): boolean {
        return this.event === 'past_due';
    }

    /**
     * Whether the subscription has been called off. Nothing more will be
     * charged, but the customer is served until `endsAt`.
     */
    isCancelled(): boolean {
        return this.event === 'cancelled';
    }

    /**
     * Whether it is over: the days that were paid for have run out and the
     * customer's access can be closed.
     */
    isEnded(): boolean {
        return this.event === 'ended';
    }

    static fromBody(body: Body): SubscriptionWebhook {
        return new SubscriptionWebhook({
            event: string(body.event),
            subscription: Subscription.fromBody(body),
        });
    }
}
