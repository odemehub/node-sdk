/**
 * What the gateway answers with, read out of its snake_case body into
 * camelCase objects. A field the gateway left out reads as an empty string,
 * or as null where the answer may genuinely not carry it.
 */

import type {
    CardScheme,
    CardType,
    Currency,
    Known,
    OrderStatus,
    PaymentStatus,
    Period,
    RefundType,
    SecurityType,
    SubscriptionStatus,
    TransactionStatus,
    WebhookEvent,
} from './enums.js';

type Body = Record<string, unknown>;

/**
 * The data a response object is built from: its fields, without its methods.
 */
type Fields<T> = { [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K] };

function object(value: unknown): Body {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Body) : {};
}

/**
 * An object the answer may carry or leave as null.
 */
function optionalObject(value: unknown): Body | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Body) : null;
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

function optionalBoolean(value: unknown): boolean | null {
    return value === undefined || value === null ? null : boolean(value);
}

function integer(value: unknown): number {
    return Math.trunc(Number(value)) || 0;
}

function optionalInteger(value: unknown): number | null {
    return value === undefined || value === null ? null : integer(value);
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
    declare readonly currency: Known<Currency>;
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
 * Where a bill or goods go, as it was written: the fields given, and null
 * for the ones nobody gave. The company fields are only ever in a billing
 * address.
 */
export class Address {
    declare readonly firstname: string | null;
    declare readonly lastname: string | null;
    declare readonly email: string | null;
    declare readonly phone: string | null;
    declare readonly address: string | null;
    declare readonly district: string | null;
    declare readonly province: string | null;
    declare readonly country: string | null;
    declare readonly companyTitle: string | null;
    declare readonly taxNumber: string | null;
    declare readonly taxOffice: string | null;

    constructor(fields: Fields<Address>) {
        Object.assign(this, fields);
    }

    static fromBody(address: Body): Address {
        return new Address({
            firstname: said(address.firstname),
            lastname: said(address.lastname),
            email: said(address.email),
            phone: said(address.phone),
            address: said(address.address),
            district: said(address.district),
            province: said(address.province),
            country: said(address.country),
            companyTitle: said(address.company_title),
            taxNumber: said(address.tax_number),
            taxOffice: said(address.tax_office),
        });
    }
}

/**
 * The customer a payment was made for, as the payment froze them: it stays
 * as it was however the thing paid for moves on.
 */
export class PaymentCustomer {
    /** The merchant's own key for them; null for a payer the merchant never named. */
    declare readonly reference: string | null;
    declare readonly billingAddress: Address;

    constructor(fields: Fields<PaymentCustomer>) {
        Object.assign(this, fields);
    }

    static fromBody(customer: Body): PaymentCustomer {
        return new PaymentCustomer({
            reference: said(customer.reference),
            billingAddress: Address.fromBody(object(customer.billing_address)),
        });
    }
}

/**
 * The customer an order or a subscription is for, as it was written: the
 * merchant's key for them — or the one the gateway made up for a payer
 * nobody named — where the bill goes, and where the goods go when somebody
 * said.
 */
export class NamedCustomer {
    declare readonly reference: string;
    declare readonly billingAddress: Address;
    declare readonly shippingAddress: Address | null;

    constructor(fields: Fields<NamedCustomer>) {
        Object.assign(this, fields);
    }

    /** Whether the gateway made the key up, for a payer nobody named. */
    isGuest(): boolean {
        return this.reference.startsWith('guest-');
    }

    static fromBody(customer: Body): NamedCustomer {
        const shipping = optionalObject(customer.shipping_address);

        return new NamedCustomer({
            reference: string(customer.reference),
            billingAddress: Address.fromBody(object(customer.billing_address)),
            shippingAddress: shipping === null ? null : Address.fromBody(shipping),
        });
    }
}

/**
 * The customer a kept card belongs to, by the key the merchant keeps them
 * under, which is what the card is found by again.
 */
export class SavedCardCustomer {
    declare readonly reference: string;

    constructor(fields: Fields<SavedCardCustomer>) {
        Object.assign(this, fields);
    }

    static fromBody(customer: Body): SavedCardCustomer {
        return new SavedCardCustomer({
            reference: string(customer.reference),
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
    declare readonly scheme: Known<CardScheme> | null;
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
            createdAt: said(card.created_at),
        });
    }
}

/**
 * Which payment it is: its token, the channel it came in on, the
 * merchant's own reference for it, and what became of its money.
 */
export class TransactionReference {
    /** The payment's token in the gateway, which names it again to ask after or give back. */
    declare readonly token: string;
    declare readonly channelToken: string;
    /** The reference the payment was made under in the calling system. */
    declare readonly channelReference: string;
    /** What became of the money: paid, cancelled, refunded, partially refunded. */
    declare readonly paymentStatus: Known<PaymentStatus> | null;

    constructor(fields: Fields<TransactionReference>) {
        Object.assign(this, fields);
    }

    static fromBody(transaction: Body): TransactionReference {
        return new TransactionReference({
            token: string(transaction.token),
            channelToken: string(transaction.channel_token),
            channelReference: string(transaction.channel_reference),
            paymentStatus: said(transaction.payment_status),
        });
    }
}

/**
 * Whether a payment attempt is over, one way or the other. An attempt the
 * provider never answered (`timeout`) is not, and needs looking into; a
 * state this SDK does not know is not taken to be over either.
 */
function isFinished(status: string | null): boolean {
    return status === 'successful' || status === 'failed' || status === 'expired';
}

/**
 * A payment as the gateway's own answers say it: which payment it is, and
 * where it stands. Where it stands is said twice on purpose — the
 * attempt's own state, and what became of the money, which can move on to
 * refunded long after the attempt is over. A payment made at an order, a
 * payment link or a subscription names it, so a webhook about one of them
 * can be checked against the payment it names.
 */
export class PaymentTransaction {
    /** The payment's token in the gateway, which names it again to ask after or give back. */
    declare readonly token: string;
    /** The channel the payment came in on. */
    declare readonly channelToken: string;
    /** The reference the payment was made under in the calling system. */
    declare readonly channelReference: string;
    /** The attempt's state. */
    declare readonly status: Known<TransactionStatus> | null;
    /** What became of the money. */
    declare readonly paymentStatus: Known<PaymentStatus> | null;
    /** How it was made: secure (confirmed at the bank) or regular. */
    declare readonly securityType: Known<SecurityType> | null;
    /** What the card was charged, with the kurus behind a point. */
    declare readonly amount: string | null;
    /** What was being sold, before anything added for instalments. */
    declare readonly baseAmount: string | null;
    declare readonly currency: Known<Currency> | null;
    declare readonly installmentNumber: number | null;
    /** Whether it was made in the test environment. */
    declare readonly isTest: boolean | null;
    declare readonly createdAt: string | null;
    /** The order the payment was made at, when it was made at one. */
    declare readonly orderToken: string | null;
    /** The payment link the payment was made on, when it was made on one. */
    declare readonly paymentLinkToken: string | null;
    /** The subscription whose renewal the payment paid, when it paid one. */
    declare readonly subscriptionToken: string | null;

    constructor(fields: Fields<PaymentTransaction>) {
        Object.assign(this, fields);
    }

    /** Whether the attempt went through. */
    isSuccessful(): boolean {
        return this.status === 'successful';
    }

    /** Whether the attempt is over, one way or the other. */
    isFinished(): boolean {
        return isFinished(this.status);
    }

    static fromBody(transaction: Body): PaymentTransaction {
        return new PaymentTransaction({
            token: string(transaction.token),
            channelToken: string(transaction.channel_token),
            channelReference: string(transaction.channel_reference),
            status: said(transaction.status),
            paymentStatus: said(transaction.payment_status),
            securityType: said(transaction.security_type),
            amount: said(transaction.amount),
            baseAmount: said(transaction.base_amount),
            currency: said(transaction.currency),
            installmentNumber: optionalInteger(transaction.installment_number),
            isTest: optionalBoolean(transaction.is_test),
            createdAt: said(transaction.created_at),
            orderToken: said(optionalObject(transaction.order)?.token),
            paymentLinkToken: said(optionalObject(transaction.payment_link)?.token),
            subscriptionToken: said(optionalObject(transaction.subscription)?.token),
        });
    }
}

/**
 * The outcome of a payment, as the gateway reports it — whether it answers
 * straight away, is asked after, or posts the outcome back once the
 * customer is home from their bank: how it went, which payment it was, and
 * whose.
 *
 * A payment that was turned down is an outcome like any other and arrives
 * here; only answers that were never a payment outcome are raised as errors.
 */
export class Payment {
    declare readonly result: Result;
    /** The payment itself: which one it is and where it stands. */
    declare readonly transaction: PaymentTransaction;
    /** Who it was made for, as the payment froze them. */
    declare readonly customer: PaymentCustomer | null;
    /**
     * What reached the card, for a payment the merchant's conversion rules
     * charged in another money than it was asked in; null for a payment
     * charged as it was asked.
     */
    declare readonly conversion: Conversion | null;
    /**
     * The card the payment kept, for a payment that asked for one to be
     * kept. It is null while nothing was kept: because the payment did not
     * go through, because the provider handed nothing back, because a 3D
     * payment has not been finished yet, or because the payment never asked.
     */
    declare readonly savedCard: SavedCard | null;

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
        const customer = optionalObject(body.customer);
        const conversion = optionalObject(body.conversion);
        const savedCard = optionalObject(body.saved_card);

        return {
            result: Result.fromBody(body),
            transaction: PaymentTransaction.fromBody(object(body.transaction)),
            customer: customer === null ? null : PaymentCustomer.fromBody(customer),
            conversion: conversion === null ? null : Conversion.fromBody(conversion),
            savedCard: savedCard === null ? null : SavedCard.fromBody(savedCard),
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
 * What was given back out of a payment.
 */
export class Refund {
    /** Which of the two it was: cancel or refund. */
    declare readonly type: Known<RefundType>;
    /** How much actually went back, whether or not it was asked for by name. */
    declare readonly amount: string;

    constructor(fields: Fields<Refund>) {
        Object.assign(this, fields);
    }

    static fromBody(refund: Body): Refund {
        return new Refund({
            type: string(refund.type),
            amount: string(refund.amount),
        });
    }
}

/**
 * Money given back out of a payment: a cancellation or a refund, with the
 * payment it came out of as it stands now.
 */
export class GiveBack extends Payment {
    /** What went back; null only on an answer that did not say. */
    declare readonly refund: Refund | null;

    constructor(fields: Fields<GiveBack>) {
        super(fields);
    }

    static override fromBody(body: Body): GiveBack {
        return new GiveBack({
            ...Payment.parts(body),
            refund: optionalObject(body.refund) === null ? null : Refund.fromBody(object(body.refund)),
        });
    }
}

/**
 * A word the gateway sent about something of the merchant's: an order
 * paid, a link paid, a subscription's state changed, a payment finished,
 * money given back. It goes to the addresses set for the thing's channel
 * under Webhook in the panel, as plain JSON signed the way every answer is.
 *
 * It is a notification, never the answer. It names the thing by token —
 * and the payment beside it when money moved — and nothing else; ask the
 * gateway what became of it (`retrieveOrder`, `retrievePaymentLink`,
 * `retrieveSubscription`, `retrievePayment`) and act on that. A word may
 * arrive more than once; the id tells the copies apart.
 */
export class Webhook {
    /** The word's own token, the same on every delivery of it. */
    declare readonly id: string;
    declare readonly event: Known<WebhookEvent>;
    declare readonly createdAt: string | null;
    /** The order, for the `order.*` events. */
    declare readonly orderToken: string | null;
    /** The payment link, for the `payment_link.*` events. */
    declare readonly paymentLinkToken: string | null;
    /** The subscription, for the `subscription.*` events. */
    declare readonly subscriptionToken: string | null;
    /** The payment: for the `transaction.*` events, and beside the thing wherever money moved at it. */
    declare readonly transactionToken: string | null;

    constructor(fields: Fields<Webhook>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): Webhook {
        return new Webhook({
            id: string(body.id),
            event: string(body.event),
            createdAt: said(body.created_at),
            orderToken: said(optionalObject(body.order)?.token),
            paymentLinkToken: said(optionalObject(body.payment_link)?.token),
            subscriptionToken: said(optionalObject(body.subscription)?.token),
            transactionToken: said(optionalObject(body.transaction)?.token),
        });
    }
}

/**
 * One payment attempt, as the gateway lists it: enough to tell the
 * attempts apart and see where each got to, and what it was paying for.
 */
export class Transaction {
    /** The payment's token in the gateway, which names it again to ask after or give back. */
    declare readonly token: string;
    /** The channel the payment came in on. */
    declare readonly channelToken: string;
    /** The reference the payment was made under in the calling system. */
    declare readonly channelReference: string;
    /** The attempt's state. */
    declare readonly status: Known<TransactionStatus>;
    /** What became of the money. */
    declare readonly paymentStatus: Known<PaymentStatus>;
    /** How it was made: secure (confirmed at the bank) or regular. */
    declare readonly securityType: Known<SecurityType>;
    /** What the card was charged, with the kurus behind a point. */
    declare readonly amount: string;
    /** What was being sold, before anything added for instalments. */
    declare readonly baseAmount: string;
    declare readonly currency: Known<Currency>;
    declare readonly installmentNumber: number;
    /** Whether it was made in the test environment. */
    declare readonly isTest: boolean;
    /** What the provider called the refusal, for an attempt that failed. */
    declare readonly errorCode: string | null;
    /** Why it failed, written for a person. */
    declare readonly errorMessage: string | null;
    declare readonly createdAt: string | null;
    /** Who it was made for, as the payment froze them. */
    declare readonly customer: PaymentCustomer | null;
    /** What reached the card when it was charged in another money; null when charged as asked. */
    declare readonly conversion: Conversion | null;
    /** The token of the order this attempt was at, when it was at one. */
    declare readonly orderToken: string | null;
    /** The token of the payment link this attempt was at, when it was at one. */
    declare readonly paymentLinkToken: string | null;
    /** The token of the subscription this attempt paid a renewal of, when it did. */
    declare readonly subscriptionToken: string | null;

    constructor(fields: Fields<Transaction>) {
        Object.assign(this, fields);
    }

    /** Whether the attempt went through. */
    isSuccessful(): boolean {
        return this.status === 'successful';
    }

    /** Whether the attempt is over, one way or the other. */
    isFinished(): boolean {
        return isFinished(this.status);
    }

    static fromBody(transaction: Body): Transaction {
        const customer = optionalObject(transaction.customer);
        const conversion = optionalObject(transaction.conversion);

        return new Transaction({
            token: string(transaction.token),
            channelToken: string(transaction.channel_token),
            channelReference: string(transaction.channel_reference),
            status: string(transaction.status),
            paymentStatus: string(transaction.payment_status),
            securityType: string(transaction.security_type),
            amount: string(transaction.amount),
            baseAmount: string(transaction.base_amount),
            currency: string(transaction.currency),
            installmentNumber: integer(transaction.installment_number) || 1,
            isTest: boolean(transaction.is_test),
            errorCode: said(transaction.error_code),
            errorMessage: said(transaction.error_message),
            createdAt: said(transaction.created_at),
            customer: customer === null ? null : PaymentCustomer.fromBody(customer),
            conversion: conversion === null ? null : Conversion.fromBody(conversion),
            orderToken: said(object(transaction.order).token),
            paymentLinkToken: said(object(transaction.payment_link).token),
            subscriptionToken: said(object(transaction.subscription).token),
        });
    }
}

/**
 * Every payment attempt made on a channel within a stretch of days, oldest
 * first, the ones the bank turned away included.
 */
export class PaymentList {
    declare readonly result: Result;
    /** The first day listed, `YYYY-MM-DD` in the team's own time. */
    declare readonly createdFrom: string;
    /** The last day listed, the same way. */
    declare readonly createdTo: string;
    declare readonly payments: Transaction[];

    constructor(fields: Fields<PaymentList>) {
        Object.assign(this, fields);
    }

    /** The attempts that went through. */
    successful(): Transaction[] {
        return this.payments.filter((payment) => payment.isSuccessful());
    }

    static fromBody(body: Body): PaymentList {
        return new PaymentList({
            result: Result.fromBody(body),
            createdFrom: string(body.created_from),
            createdTo: string(body.created_to),
            payments: list(body.payments).map((payment) => Transaction.fromBody(object(payment))),
        });
    }
}

/**
 * One line of what an order, a subscription or a payment link is made up
 * of, as it was written down.
 */
export class Item {
    /** The merchant's own key for what is on the line, if it gave one. */
    declare readonly channelReference: string | null;
    declare readonly name: string;
    /** The picture the line is shown with, if any. */
    declare readonly image: string | null;
    declare readonly quantity: number;
    /** The price of one, tax included, as digits with the kurus behind a point. */
    declare readonly unitAmount: string;
    /** The tax inside the price, as a percentage. */
    declare readonly taxRate: string | null;

    constructor(fields: Fields<Item>) {
        Object.assign(this, fields);
    }

    static fromBody(item: Body): Item {
        return new Item({
            channelReference: said(item.channel_reference),
            name: string(item.name),
            image: said(item.image),
            quantity: integer(item.quantity),
            unitAmount: string(item.unit_amount),
            taxRate: optionalString(item.tax_rate),
        });
    }
}

/**
 * One way the goods may be sent, as the merchant offered it.
 */
export class ShippingMethod {
    declare readonly handle: string;
    declare readonly title: string;
    /** What it costs, tax included. */
    declare readonly amount: string;
    /** The tax inside the amount, as a percentage. */
    declare readonly taxRate: string;

    constructor(fields: Fields<ShippingMethod>) {
        Object.assign(this, fields);
    }

    static fromBody(method: Body): ShippingMethod {
        return new ShippingMethod({
            handle: string(method.handle),
            title: string(method.title),
            amount: string(method.amount),
            taxRate: string(method.tax_rate),
        });
    }
}

/**
 * An order as the gateway keeps it: what is being paid for, what it comes
 * to, where it stands, whose it is and — once it is paid — the payment that
 * paid it. The same shape comes back whether the order has just been
 * opened, changed, asked after or listed, or the gateway is telling the
 * merchant it was paid.
 */
export class Order {
    /** The order's token in the gateway; name it to ask after it or change it. */
    declare readonly token: string;
    /** The channel the order was opened on. */
    declare readonly channelToken: string;
    /** The reference the order is known by in the calling system. */
    declare readonly channelReference: string;
    declare readonly description: string | null;
    /** The account the order is paid through; null where the team's Gate rules and default account decide. */
    declare readonly paymentProviderToken: string | null;
    /** Where the order stands: open until it is paid, then paid. */
    declare readonly status: Known<OrderStatus>;
    declare readonly items: Item[];
    /** The ways the goods may be sent, as offered. */
    declare readonly shippingMethods: ShippingMethod[];
    /** The way the payer picked; null until they have, or when none was offered. */
    declare readonly shippingMethod: ShippingMethod | null;
    /** What the lines come to before tax. */
    declare readonly subtotal: string;
    /** What the way picked costs before tax. */
    declare readonly shippingAmount: string;
    /** The tax of the lines and the way picked together. */
    declare readonly taxAmount: string;
    /** What the order comes to: the lines and the way picked, added up by the gateway. */
    declare readonly amount: string;
    declare readonly currency: Known<Currency>;
    /** Whether it was paid in the test environment; null until it is paid. */
    declare readonly isTest: boolean | null;
    declare readonly createdAt: string | null;
    /** Where the customer pays, while the order can be paid; null otherwise. */
    declare readonly checkoutUrl: string | null;
    /** The payment that paid the order, which names it again for a refund; null while it is open. */
    declare readonly transaction: TransactionReference | null;
    /** Who the order is for; null while nobody has said. */
    declare readonly customer: NamedCustomer | null;

    constructor(fields: Fields<Order>) {
        Object.assign(this, fields);
    }

    /** Whether the order has been paid. */
    isPaid(): boolean {
        return this.status === 'paid';
    }

    /**
     * Read an order out of a body that carries it under `order`, with its
     * customer beside it under `customer`.
     */
    static fromBody(body: Body): Order {
        return Order.read(object(body.order), body.customer);
    }

    /**
     * Read an order out of a list, where each carries its own customer.
     */
    static fromSummary(order: Body): Order {
        return Order.read(order, order.customer);
    }

    private static read(order: Body, customer: unknown): Order {
        const shippingMethod = optionalObject(order.shipping_method);
        const transaction = optionalObject(order.transaction);
        const namedCustomer = optionalObject(customer);

        return new Order({
            token: string(order.token),
            channelToken: string(order.channel_token),
            channelReference: string(order.channel_reference),
            description: said(order.description),
            paymentProviderToken: said(order.payment_provider_token),
            status: string(order.status),
            items: list(order.items).map((item) => Item.fromBody(object(item))),
            shippingMethods: list(order.shipping_methods).map((method) => ShippingMethod.fromBody(object(method))),
            shippingMethod: shippingMethod === null ? null : ShippingMethod.fromBody(shippingMethod),
            subtotal: string(order.subtotal),
            shippingAmount: string(order.shipping_amount),
            taxAmount: string(order.tax_amount),
            amount: string(order.amount),
            currency: string(order.currency),
            isTest: optionalBoolean(order.is_test),
            createdAt: said(order.created_at),
            checkoutUrl: said(order.checkout_url),
            transaction: transaction === null ? null : TransactionReference.fromBody(transaction),
            customer: namedCustomer === null ? null : NamedCustomer.fromBody(namedCustomer),
        });
    }
}

/**
 * The answer about one order — opened, changed or asked after — as the
 * gateway answers it: the order and, beside it, who it is for.
 */
export class OrderDetails {
    declare readonly result: Result;
    /** The order, with its customer on it too, the way a listed one carries it. */
    declare readonly order: Order;
    /** Who the order is for; null while nobody has said. */
    declare readonly customer: NamedCustomer | null;

    constructor(fields: Fields<OrderDetails>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): OrderDetails {
        const order = Order.fromBody(body);

        return new OrderDetails({
            result: Result.fromBody(body),
            order,
            customer: order.customer,
        });
    }
}

/**
 * Every order opened on a channel within a stretch of days, oldest first.
 */
export class OrderList {
    declare readonly result: Result;
    /** The first day listed, `YYYY-MM-DD` in the team's own time. */
    declare readonly createdFrom: string;
    /** The last day listed, the same way. */
    declare readonly createdTo: string;
    declare readonly orders: Order[];

    constructor(fields: Fields<OrderList>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): OrderList {
        return new OrderList({
            result: Result.fromBody(body),
            createdFrom: string(body.created_from),
            createdTo: string(body.created_to),
            orders: list(body.orders).map((order) => Order.fromSummary(object(order))),
        });
    }
}

/**
 * A payment link as it stands: what it sells, what it comes to now,
 * whether it takes payments and until when, and the address it is paid at.
 */
export class PaymentLink {
    /** The link's token in the gateway; name it to ask after it or change it. */
    declare readonly token: string;
    /** The channel the link sells on; null for the team's own ödemehub channel. */
    declare readonly channelToken: string | null;
    /** The reference the link is known by in the calling system; LINK1, LINK2… when none was given. */
    declare readonly channelReference: string;
    declare readonly description: string | null;
    /** The account the link is paid through; null where the team's Gate rules and default account decide. */
    declare readonly paymentProviderToken: string | null;
    declare readonly items: Item[];
    /** What the lines come to before tax. */
    declare readonly subtotal: string;
    declare readonly taxAmount: string;
    /** What one payment on the link comes to. */
    declare readonly amount: string;
    declare readonly currency: Known<Currency>;
    /** Whether it takes payments now: switched on, and its last day not gone by. */
    declare readonly isActive: boolean;
    /** Whether its payments are taken in the test environment now. */
    declare readonly isTest: boolean;
    /** The last moment it takes payments, in UTC; null for a link that never runs out. */
    declare readonly expiresAt: string | null;
    /** The link itself, while it can be paid; null otherwise. */
    declare readonly checkoutUrl: string | null;
    declare readonly createdAt: string | null;

    constructor(fields: Fields<PaymentLink>) {
        Object.assign(this, fields);
    }

    static fromBody(link: Body): PaymentLink {
        return new PaymentLink({
            token: string(link.token),
            channelToken: said(link.channel_token),
            channelReference: string(link.channel_reference),
            description: said(link.description),
            paymentProviderToken: said(link.payment_provider_token),
            items: list(link.items).map((item) => Item.fromBody(object(item))),
            subtotal: string(link.subtotal),
            taxAmount: string(link.tax_amount),
            amount: string(link.amount),
            currency: string(link.currency),
            isActive: boolean(link.is_active),
            isTest: boolean(link.is_test),
            expiresAt: said(link.expires_at),
            checkoutUrl: said(link.checkout_url),
            createdAt: said(link.created_at),
        });
    }
}

/**
 * The answer about one payment link: opened, changed or asked after.
 */
export class PaymentLinkDetails {
    declare readonly result: Result;
    declare readonly paymentLink: PaymentLink;
    /** The latest attempts made on the link, at most fifty, newest first. Filled by `retrievePaymentLink` only; empty on every other answer. */
    declare readonly transactions: Transaction[];
    /** How many attempts have been made on the link in all, however many are listed; null on every answer but `retrievePaymentLink`. */
    declare readonly transactionsCount: number | null;

    constructor(fields: Fields<PaymentLinkDetails>) {
        Object.assign(this, fields);
    }

    /** The listed attempts that went through. */
    successful(): Transaction[] {
        return this.transactions.filter((transaction) => transaction.isSuccessful());
    }

    static fromBody(body: Body): PaymentLinkDetails {
        const link = object(body.payment_link);

        return new PaymentLinkDetails({
            result: Result.fromBody(body),
            paymentLink: PaymentLink.fromBody(link),
            transactions: list(link.transactions).map((transaction) => Transaction.fromBody(object(transaction))),
            transactionsCount: optionalInteger(link.transactions_count),
        });
    }
}

/**
 * Every payment link opened on a channel within a stretch of days, oldest
 * first.
 */
export class PaymentLinkList {
    declare readonly result: Result;
    /** The first day listed, `YYYY-MM-DD` in the team's own time. */
    declare readonly createdFrom: string;
    /** The last day listed, the same way. */
    declare readonly createdTo: string;
    declare readonly paymentLinks: PaymentLink[];

    constructor(fields: Fields<PaymentLinkList>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): PaymentLinkList {
        return new PaymentLinkList({
            result: Result.fromBody(body),
            createdFrom: string(body.created_from),
            createdTo: string(body.created_to),
            paymentLinks: list(body.payment_links).map((link) => PaymentLink.fromBody(object(link))),
        });
    }
}

/**
 * The renewal a subscription is on: the stretch it covers, what it costs
 * and whether it has been paid.
 */
export class Renewal {
    declare readonly token: string;
    /** What the renewal costs, with the kurus behind a point. */
    declare readonly amount: string;
    declare readonly currency: Known<Currency>;
    /** When the stretch began, once it has been paid for. */
    declare readonly startsAt: string | null;
    /** When the stretch runs out. */
    declare readonly endsAt: string | null;
    /** When it was paid for, if it has been. */
    declare readonly paidAt: string | null;

    constructor(fields: Fields<Renewal>) {
        Object.assign(this, fields);
    }

    /** Whether the renewal has been paid for. */
    isPaid(): boolean {
        return this.paidAt !== null;
    }

    static fromBody(renewal: Body): Renewal {
        return new Renewal({
            token: string(renewal.token),
            amount: string(renewal.amount),
            currency: string(renewal.currency),
            startsAt: said(renewal.starts_at),
            endsAt: said(renewal.ends_at),
            paidAt: said(renewal.paid_at),
        });
    }
}

/**
 * A subscription as it stands: what it is written as — the way an order
 * is — how often it renews, where it stands, the renewal it is on, when the
 * next payment falls due, and whose it is.
 */
export class Subscription {
    /** The subscription's token in the gateway; name it to ask after it or change it. */
    declare readonly token: string;
    /** The channel the subscription was opened on. */
    declare readonly channelToken: string;
    /** The reference the subscription is known by in the calling system. */
    declare readonly channelReference: string;
    declare readonly description: string | null;
    /** The account the renewals are taken at; null where the team's Gate rules and default account decided. */
    declare readonly paymentProviderToken: string | null;
    /** Where it stands: pending, active, past_due, cancelled or completed. */
    declare readonly status: Known<SubscriptionStatus>;
    /** How often it renews: daily, weekly, monthly or annually. */
    declare readonly period: Known<Period>;
    /** How many renewals are paid in all; null for one that runs until it is called off. */
    declare readonly renewalLimit: number | null;
    /** How many renewals have been paid so far. */
    declare readonly renewalsPaid: number;
    declare readonly items: Item[];
    /** The ways the goods may be sent, as offered. */
    declare readonly shippingMethods: ShippingMethod[];
    /** The way the payer picked; null until they have, or when none was offered. */
    declare readonly shippingMethod: ShippingMethod | null;
    declare readonly subtotal: string;
    declare readonly shippingAmount: string;
    declare readonly taxAmount: string;
    /** What a renewal comes to: the lines and the way picked. */
    declare readonly amount: string;
    declare readonly currency: Known<Currency>;
    /** Whether it was paid for in the test environment; null until the first payment. */
    declare readonly isTest: boolean | null;
    /** The renewal it is on. */
    declare readonly renewal: Renewal;
    /** When the next renewal is charged; null when none is. */
    declare readonly nextPaymentAt: string | null;
    /** The moment it was called off, if it has been. */
    declare readonly cancelledAt: string | null;
    declare readonly createdAt: string | null;
    /** Where the customer pays the renewal it is on, while that is still owed. */
    declare readonly checkoutUrl: string | null;
    /** Who it is for; null while nobody has said. */
    declare readonly customer: NamedCustomer | null;

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
     * Whether the first renewal has yet to be paid for. A subscription stays
     * here until the customer has been through the checkout.
     */
    isPending(): boolean {
        return this.status === 'pending';
    }

    /**
     * Whether a renewal has been left unpaid: the card was tried and turned
     * away every time, and the customer has been asked to pay it themselves
     * at `checkoutUrl`.
     */
    isPastDue(): boolean {
        return this.status === 'past_due';
    }

    /**
     * Whether it is over after being called off. A subscription that has
     * been called off but is still serving days that were paid for is not
     * over yet — read `cancelledAt` for that.
     */
    isCancelled(): boolean {
        return this.status === 'cancelled';
    }

    /** Whether every renewal of its limit has been paid, so it is over. */
    isCompleted(): boolean {
        return this.status === 'completed';
    }

    /**
     * Read a subscription out of a body that carries it under
     * `subscription`, with its customer beside it under `customer`.
     */
    static fromBody(body: Body): Subscription {
        return Subscription.read(object(body.subscription), body.customer);
    }

    /**
     * Read a subscription out of a list, where each carries its own customer.
     */
    static fromSummary(subscription: Body): Subscription {
        return Subscription.read(subscription, subscription.customer);
    }

    private static read(subscription: Body, customer: unknown): Subscription {
        const shippingMethod = optionalObject(subscription.shipping_method);
        const namedCustomer = optionalObject(customer);

        return new Subscription({
            token: string(subscription.token),
            channelToken: string(subscription.channel_token),
            channelReference: string(subscription.channel_reference),
            description: said(subscription.description),
            paymentProviderToken: said(subscription.payment_provider_token),
            status: string(subscription.status),
            period: string(subscription.period),
            renewalLimit: optionalInteger(subscription.renewal_limit),
            renewalsPaid: integer(subscription.renewals_paid),
            items: list(subscription.items).map((item) => Item.fromBody(object(item))),
            shippingMethods: list(subscription.shipping_methods).map((method) => ShippingMethod.fromBody(object(method))),
            shippingMethod: shippingMethod === null ? null : ShippingMethod.fromBody(shippingMethod),
            subtotal: string(subscription.subtotal),
            shippingAmount: string(subscription.shipping_amount),
            taxAmount: string(subscription.tax_amount),
            amount: string(subscription.amount),
            currency: string(subscription.currency),
            isTest: optionalBoolean(subscription.is_test),
            renewal: Renewal.fromBody(object(subscription.renewal)),
            nextPaymentAt: said(subscription.next_payment_at),
            cancelledAt: said(subscription.cancelled_at),
            createdAt: said(subscription.created_at),
            checkoutUrl: said(subscription.checkout_url),
            customer: namedCustomer === null ? null : NamedCustomer.fromBody(namedCustomer),
        });
    }
}

/**
 * The answer about one subscription: opened, changed, called off or asked
 * after.
 */
export class SubscriptionDetails {
    declare readonly result: Result;
    /** The subscription, with its customer on it too, the way a listed one carries it. */
    declare readonly subscription: Subscription;
    /** Who it is for; null while nobody has said. */
    declare readonly customer: NamedCustomer | null;

    constructor(fields: Fields<SubscriptionDetails>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): SubscriptionDetails {
        const subscription = Subscription.fromBody(body);

        return new SubscriptionDetails({
            result: Result.fromBody(body),
            subscription,
            customer: subscription.customer,
        });
    }
}

/**
 * Every subscription opened on a channel within a stretch of days, oldest
 * first.
 */
export class SubscriptionList {
    declare readonly result: Result;
    /** The first day listed, `YYYY-MM-DD` in the team's own time. */
    declare readonly createdFrom: string;
    /** The last day listed, the same way. */
    declare readonly createdTo: string;
    declare readonly subscriptions: Subscription[];

    constructor(fields: Fields<SubscriptionList>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): SubscriptionList {
        return new SubscriptionList({
            result: Result.fromBody(body),
            createdFrom: string(body.created_from),
            createdTo: string(body.created_to),
            subscriptions: list(body.subscriptions).map((subscription) => Subscription.fromSummary(object(subscription))),
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
    declare readonly scheme: Known<CardScheme> | null;
    /** Whether the money is lent, drawn from an account or loaded beforehand: credit, debit or prepaid. */
    declare readonly type: Known<CardType> | null;
    /** The programme the card is sold under, such as Bonus or Maximum. */
    declare readonly program: string | null;
    /** Whether the card belongs to a company rather than to a person. */
    declare readonly isCommercial: boolean | null;
    /** The ways the amount may be paid off, a single payment first; empty for any money but the lira. */
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
            isCommercial: optionalBoolean(card.is_commercial),
            installments: list(body.installments).map((installment) => Installment.fromBody(object(installment))),
        });
    }
}

/**
 * The answer about one kept card: kept, asked after or made the default.
 */
export class SavedCardDetails {
    declare readonly result: Result;
    /** The card as it now stands, or null when keeping it did not go through. */
    declare readonly savedCard: SavedCard | null;
    /** The customer the card belongs to. */
    declare readonly customer: SavedCardCustomer;

    constructor(fields: Fields<SavedCardDetails>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): SavedCardDetails {
        const savedCard = optionalObject(body.saved_card);

        return new SavedCardDetails({
            result: Result.fromBody(body),
            savedCard: savedCard === null ? null : SavedCard.fromBody(savedCard),
            customer: SavedCardCustomer.fromBody(object(body.customer)),
        });
    }
}

/**
 * The cards kept for a customer, the default one first.
 */
export class SavedCardList {
    declare readonly result: Result;
    declare readonly savedCards: SavedCard[];
    /** The customer the cards belong to, as they were named. */
    declare readonly customer: SavedCardCustomer;

    constructor(fields: Fields<SavedCardList>) {
        Object.assign(this, fields);
    }

    /** The card the customer pays with unless they say otherwise, if they have one. */
    default(): SavedCard | null {
        return this.savedCards.find((card) => card.isDefault) ?? null;
    }

    static fromBody(body: Body): SavedCardList {
        return new SavedCardList({
            result: Result.fromBody(body),
            savedCards: list(body.saved_cards).map((card) => SavedCard.fromBody(object(card))),
            customer: SavedCardCustomer.fromBody(object(body.customer)),
        });
    }
}

/**
 * A kept card let go of — or, when the provider would not, kept, and the
 * result says why.
 */
export class DeletedSavedCard {
    declare readonly result: Result;
    /** The token of the card asked about. */
    declare readonly savedCardToken: string;
    /** The customer the card belonged to. */
    declare readonly customer: SavedCardCustomer;

    constructor(fields: Fields<DeletedSavedCard>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): DeletedSavedCard {
        return new DeletedSavedCard({
            result: Result.fromBody(body),
            savedCardToken: string(object(body.saved_card).token),
            customer: SavedCardCustomer.fromBody(object(body.customer)),
        });
    }
}
