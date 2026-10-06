/**
 * What the gateway answers with, read out of its snake_case body into
 * camelCase objects. A field the gateway left out reads as an empty string,
 * or as null where the answer may genuinely not carry it.
 */

import type {
    AmountType,
    CardScheme,
    CardType,
    Currency,
    CurrencyType,
    Known,
    LinkPaymentStatus,
    OrderStatus,
    PaymentStatus,
    Period,
    RefundType,
    SecurityType,
    SubscriptionStatus,
    TaxMode,
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

/**
 * A list the answer may carry or leave as null, each entry read as a string.
 */
function optionalStrings(value: unknown): string[] | null {
    return value === undefined || value === null ? null : list(value).map(string);
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
 * Who an order or a subscription is for, as the gateway holds them: the
 * merchant's own key for them, where the bill goes, and where the goods go
 * when somebody said.
 */
export class NamedCustomer {
    /** The key the merchant keeps them under; null for somebody the team does not keep. */
    declare readonly reference: string | null;
    /** Where the bill goes; null until somebody has said. */
    declare readonly billingAddress: Address | null;
    declare readonly shippingAddress: Address | null;

    constructor(fields: Fields<NamedCustomer>) {
        Object.assign(this, fields);
    }

    static fromBody(customer: Body): NamedCustomer {
        const billing = optionalObject(customer.billing_address);
        const shipping = optionalObject(customer.shipping_address);

        return new NamedCustomer({
            reference: said(customer.reference),
            billingAddress: billing === null ? null : Address.fromBody(billing),
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
    /** Who the card is kept for; listed cards only, the other answers carry it beside the card. */
    declare readonly customer: SavedCardCustomer | null;

    constructor(fields: Fields<SavedCard>) {
        Object.assign(this, fields);
    }

    static fromBody(card: Body): SavedCard {
        const customer = optionalObject(card.customer);

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
            customer: customer === null ? null : SavedCardCustomer.fromBody(customer),
        });
    }
}

/**
 * Which payment it is: its token, the merchant's own reference for it, and
 * what became of its money.
 */
export class TransactionReference {
    /** The payment's token in the gateway, which names it again to ask after or give back. */
    declare readonly token: string;
    /** The reference the payment was made under in the calling system. */
    declare readonly reference: string;
    /** What became of the money: paid, cancelled, refunded, partially refunded. */
    declare readonly paymentStatus: Known<PaymentStatus> | null;

    constructor(fields: Fields<TransactionReference>) {
        Object.assign(this, fields);
    }

    static fromBody(transaction: Body): TransactionReference {
        return new TransactionReference({
            token: string(transaction.token),
            reference: string(transaction.reference),
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
    /** The reference the payment was made under in the calling system. */
    declare readonly reference: string;
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
    /** The payer's payment at the link, when it was made on one; ask after it with `retrieveLinkPayments`. */
    declare readonly linkPaymentToken: string | null;
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
            reference: string(transaction.reference),
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
            linkPaymentToken: said(optionalObject(transaction.link_payment)?.token),
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
 * money given back. It goes to the addresses the team set for the event
 * under Webhook in the panel, as plain JSON signed the way every answer is.
 *
 * It is a notification, never the answer. It names the thing by token —
 * and the payment beside it when money moved, and the payer's payment at
 * the link for a link — and nothing else; ask the gateway what became of it
 * (`retrieveOrders`, `retrievePaymentLinks`, `retrieveLinkPayments`,
 * `retrieveSubscriptions`, `retrievePayments`, by its token) and act on
 * that. A word may arrive more than once; the id tells the copies apart.
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
    /** The payer's payment at the link, for the `payment_link.*` events. */
    declare readonly linkPaymentToken: string | null;
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
            linkPaymentToken: said(optionalObject(body.link_payment)?.token),
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
    /** The reference the payment was made under in the calling system. */
    declare readonly reference: string;
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
    /** The token of the payer's payment at the link this attempt was at, when it was at one. */
    declare readonly linkPaymentToken: string | null;
    /** The token of the subscription this attempt paid a renewal of, when it did. */
    declare readonly subscriptionToken: string | null;
    /** The card the payment kept, when it asked to keep one and went through; null otherwise. */
    declare readonly savedCard: SavedCard | null;

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
        const savedCard = optionalObject(transaction.saved_card);

        const customer = optionalObject(transaction.customer);
        const conversion = optionalObject(transaction.conversion);

        return new Transaction({
            token: string(transaction.token),
            reference: string(transaction.reference),
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
            linkPaymentToken: said(object(transaction.link_payment).token),
            subscriptionToken: said(object(transaction.subscription).token),
            savedCard: savedCard === null ? null : SavedCard.fromBody(savedCard),
        });
    }
}

/**
 * Payments asked after, each with its state, amount, customer and what
 * became of its money, the ones the bank turned away included. The answer is always a list, oldest first, and an empty one when
 * nothing matched. The days are the ones the gateway used, when the records
 * were asked for by the days they were made on: the ones asked for, or the
 * last seven when none were.
 */
export class PaymentList {
    declare readonly result: Result;
    /** The first day listed, `YYYY-MM-DD` in the team's own time; null when they were asked for by token or reference. */
    declare readonly createdFrom: string | null;
    /** The last day listed, the same way. */
    declare readonly createdTo: string | null;
    declare readonly payments: Transaction[];

    constructor(fields: Fields<PaymentList>) {
        Object.assign(this, fields);
    }

    /** The payments that went through. */
    successful(): Transaction[] {
        return this.payments.filter((payment) => payment.isSuccessful());
    }

    static fromBody(body: Body): PaymentList {
        return new PaymentList({
            result: Result.fromBody(body),
            createdFrom: said(body.created_from),
            createdTo: said(body.created_to),
            payments: list(body.payments).map((entry) => Transaction.fromBody(object(entry))),
        });
    }
}

/**
 * One line of what an order, a subscription or a payment link is made up
 * of, as it was written down.
 */
export class Item {
    /** The merchant's own key for what is on the line, if it gave one. */
    declare readonly reference: string | null;
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
            reference: said(item.reference),
            name: string(item.name),
            image: said(item.image),
            quantity: integer(item.quantity),
            unitAmount: string(item.unit_amount),
            taxRate: optionalString(item.tax_rate),
        });
    }
}

/**
 * The way the payer picked to have the goods sent, from the team's own
 * list, as it was copied onto the order or the subscription. The amount
 * includes the tax.
 */
export class ShippingMethod {
    /** The merchant's own key for the way, on the team's list. */
    declare readonly reference: string;
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
            reference: string(method.reference),
            title: string(method.title),
            amount: string(method.amount),
            taxRate: string(method.tax_rate),
        });
    }
}

/**
 * The coupon the payer put on an order, a subscription or a payment at a
 * link on the checkout page: the code they typed and what it took off the
 * lines. A coupon is never sent through the API; it only comes back.
 */
export class Discount {
    /** The code the payer typed. */
    declare readonly code: string;
    /** What it took off the lines, with the kurus behind a point, in the thing's own money. */
    declare readonly amount: string;

    constructor(fields: Fields<Discount>) {
        Object.assign(this, fields);
    }

    static fromBody(discount: Body): Discount {
        return new Discount({
            code: string(discount.code),
            amount: string(discount.amount),
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
    /** The reference the order is known by in the calling system. */
    declare readonly reference: string;
    declare readonly description: string | null;
    /** The account the order is paid through; null where the team's Gate rules and default account decide. */
    declare readonly paymentProviderToken: string | null;
    /** Where the order stands: open until it is paid, then paid. */
    declare readonly status: Known<OrderStatus>;
    declare readonly items: Item[];
    /** The way the payer picked; null until they have, or when none was offered. */
    declare readonly shippingMethod: ShippingMethod | null;
    /** What the lines come to before tax, the coupon taken off. */
    declare readonly subtotal: string;
    /** What the way picked costs before tax. */
    declare readonly shippingAmount: string;
    /** The tax of the lines and the way picked together. */
    declare readonly taxAmount: string;
    /** What the order comes to: the lines, the coupon taken off, and the way picked, added up by the gateway. */
    declare readonly amount: string;
    /** The coupon the payer put on the order; null when none was. The amounts above already have it taken off. */
    declare readonly discount: Discount | null;
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
        const discount = optionalObject(order.discount);
        const transaction = optionalObject(order.transaction);
        const namedCustomer = optionalObject(customer);

        return new Order({
            token: string(order.token),
            reference: string(order.reference),
            description: said(order.description),
            paymentProviderToken: said(order.payment_provider_token),
            status: string(order.status),
            items: list(order.items).map((item) => Item.fromBody(object(item))),
            shippingMethod: shippingMethod === null ? null : ShippingMethod.fromBody(shippingMethod),
            subtotal: string(order.subtotal),
            shippingAmount: string(order.shipping_amount),
            taxAmount: string(order.tax_amount),
            amount: string(order.amount),
            discount: discount === null ? null : Discount.fromBody(discount),
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
 * Orders asked after, each with its customer on `Order.customer`. The answer is always a list, oldest first, and an empty one when
 * nothing matched. The days are the ones the gateway used, when the records
 * were asked for by the days they were made on: the ones asked for, or the
 * last seven when none were.
 */
export class OrderList {
    declare readonly result: Result;
    /** The first day listed, `YYYY-MM-DD` in the team's own time; null when they were asked for by token or reference. */
    declare readonly createdFrom: string | null;
    /** The last day listed, the same way. */
    declare readonly createdTo: string | null;
    declare readonly orders: Order[];

    constructor(fields: Fields<OrderList>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): OrderList {
        return new OrderList({
            result: Result.fromBody(body),
            createdFrom: said(body.created_from),
            createdTo: said(body.created_to),
            orders: list(body.orders).map((entry) => Order.fromSummary(object(entry))),
        });
    }
}

/**
 * A payment link as it stands: what it sells — its lines and what they
 * come to now, or what the payer may pick and the tax on it — in which
 * money, whether it takes payments and until when, and the address it is
 * paid at.
 */
export class PaymentLink {
    /** The link's token in the gateway; name it to ask after it or change it. */
    declare readonly token: string;
    /** The reference the link is known by in the calling system; LINK1, LINK2… when none was given. */
    declare readonly reference: string;
    declare readonly description: string | null;
    /** The account the link is paid through; null where the team's Gate rules and default account decide. */
    declare readonly paymentProviderToken: string | null;
    /** What the payer pays: the lines (`fixed`), or an amount they pick. */
    declare readonly amountType: Known<AmountType>;
    /** The name of the one line a payment is made up of where the payer picks the amount; null on a `fixed` link. */
    declare readonly itemName: string | null;
    /** The amounts the payer picks from; null where none are offered. */
    declare readonly predefinedAmounts: string[] | null;
    /** The tax on the amount the payer picks, as a percentage; null when it carries none. */
    declare readonly taxRate: string | null;
    /** Whether `taxRate` is inside the amount the payer picks or added on top of it. */
    declare readonly taxMode: Known<TaxMode>;
    /** The lines, on a `fixed` link; empty on the others. */
    declare readonly items: Item[];
    /** What the lines come to before tax; null where the payer picks the amount. */
    declare readonly subtotal: string | null;
    /** The tax inside the lines; null where the payer picks the amount. */
    declare readonly taxAmount: string | null;
    /** What one payment on the link comes to; null where the payer picks the amount. */
    declare readonly amount: string | null;
    declare readonly currency: Known<Currency>;
    /** Whether the payer may pick the money. */
    declare readonly currencyType: Known<CurrencyType>;
    /** The money the payer picks from, `currency` included, on a `selectable` link; null on a `fixed` one. */
    declare readonly currencies: Known<Currency>[] | null;
    /** Whether the payer is sent an e-mail once their payment goes through. */
    declare readonly emailsPayer: boolean;
    /** Whether it takes payments now: switched on, and its last day not gone by. */
    declare readonly isActive: boolean;
    /** Whether its payments are taken in the test environment now. */
    declare readonly isTest: boolean;
    /** The last moment it takes payments, in UTC; null for a link that never runs out. */
    declare readonly expiresAt: string | null;
    /** The link itself, while it can be paid; null otherwise. */
    declare readonly checkoutUrl: string | null;
    declare readonly createdAt: string | null;
    /** The latest attempts made on the link, at most fifty, newest first, the refused ones included; listed links only. */
    declare readonly transactions: Transaction[];
    /** How many attempts have been made on the link in all, however many are listed; null but on a listed link. */
    declare readonly transactionsCount: number | null;

    constructor(fields: Fields<PaymentLink>) {
        Object.assign(this, fields);
    }

    /** The listed attempts that went through. */
    successful(): Transaction[] {
        return this.transactions.filter((transaction) => transaction.isSuccessful());
    }

    static fromBody(link: Body): PaymentLink {
        return new PaymentLink({
            token: string(link.token),
            reference: string(link.reference),
            description: said(link.description),
            paymentProviderToken: said(link.payment_provider_token),
            amountType: string(link.amount_type),
            itemName: said(link.item_name),
            predefinedAmounts: optionalStrings(link.predefined_amounts),
            taxRate: optionalString(link.tax_rate),
            taxMode: string(link.tax_mode),
            items: list(link.items).map((item) => Item.fromBody(object(item))),
            subtotal: optionalString(link.subtotal),
            taxAmount: optionalString(link.tax_amount),
            amount: optionalString(link.amount),
            currency: string(link.currency),
            currencyType: string(link.currency_type),
            currencies: optionalStrings(link.currencies),
            emailsPayer: boolean(link.emails_payer),
            isActive: boolean(link.is_active),
            isTest: boolean(link.is_test),
            expiresAt: said(link.expires_at),
            checkoutUrl: said(link.checkout_url),
            createdAt: said(link.created_at),
            transactions: list(link.transactions).map((transaction) => Transaction.fromBody(object(transaction))),
            transactionsCount: optionalInteger(link.transactions_count),
        });
    }
}

/**
 * The answer to opening or changing a payment link: the link as it now
 * stands. Its payments are on the link when it is asked after with
 * `retrievePaymentLinks`.
 */
export class PaymentLinkDetails {
    declare readonly result: Result;
    declare readonly paymentLink: PaymentLink;

    constructor(fields: Fields<PaymentLinkDetails>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): PaymentLinkDetails {
        return new PaymentLinkDetails({
            result: Result.fromBody(body),
            paymentLink: PaymentLink.fromBody(object(body.payment_link)),
        });
    }
}

/**
 * Payment links asked after, each with how many payments were made on it
 * and the latest fifty of them. The answer is always a list, oldest first, and an empty one when
 * nothing matched. The days are the ones the gateway used, when the records
 * were asked for by the days they were made on: the ones asked for, or the
 * last seven when none were.
 */
export class PaymentLinkList {
    declare readonly result: Result;
    /** The first day listed, `YYYY-MM-DD` in the team's own time; null when they were asked for by token or reference. */
    declare readonly createdFrom: string | null;
    /** The last day listed, the same way. */
    declare readonly createdTo: string | null;
    declare readonly paymentLinks: PaymentLink[];

    constructor(fields: Fields<PaymentLinkList>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): PaymentLinkList {
        return new PaymentLinkList({
            result: Result.fromBody(body),
            createdFrom: said(body.created_from),
            createdTo: said(body.created_to),
            paymentLinks: list(body.payment_links).map((entry) => PaymentLink.fromBody(object(entry))),
        });
    }
}

/**
 * Which payment link a payment was made at: its token and the merchant's
 * own reference for it.
 */
export class PaymentLinkReference {
    /** The link's token in the gateway, which names it to ask after it or change it. */
    declare readonly token: string;
    /** The reference the link is known by in the calling system. */
    declare readonly reference: string;

    constructor(fields: Fields<PaymentLinkReference>) {
        Object.assign(this, fields);
    }

    static fromBody(paymentLink: Body): PaymentLinkReference {
        return new PaymentLinkReference({
            token: string(paymentLink.token),
            reference: string(paymentLink.reference),
        });
    }
}

/**
 * Who paid at a link, as they billed themselves on the page. A payer at a
 * link is nobody the team keeps, so there is no reference.
 */
export class LinkPaymentCustomer {
    declare readonly billingAddress: Address;

    constructor(fields: Fields<LinkPaymentCustomer>) {
        Object.assign(this, fields);
    }

    static fromBody(customer: Body): LinkPaymentCustomer {
        return new LinkPaymentCustomer({
            billingAddress: Address.fromBody(object(customer.billing_address)),
        });
    }
}

/**
 * A payment made at a payment link: opened as the payer starts paying, and
 * paid once a payment goes through. What was paid and the tax in it, where
 * it stands, the link it was made at, the payer as they billed themselves,
 * and — once it is paid — the payment that paid it, which is what is given
 * back out of or asked after.
 */
export class LinkPayment {
    /** The payment's token in the gateway; name it to ask after it again. */
    declare readonly token: string;
    /** The reference the gateway gave it: LINKPAY1, LINKPAY2… */
    declare readonly reference: string;
    /** The link it was made at. */
    declare readonly paymentLink: PaymentLinkReference;
    /** The account the link named when the payment was opened; null where the team's Gate rules and default account decide. */
    declare readonly paymentProviderToken: string | null;
    /** Where it stands: open until a payment goes through, then paid. */
    declare readonly status: Known<LinkPaymentStatus>;
    /** What was paid for, as the link was when the payer paid; a line here carries no picture. */
    declare readonly items: Item[];
    /** What the lines come to before tax, the coupon taken off. */
    declare readonly subtotal: string;
    /** The tax inside the lines, the coupon taken off. */
    declare readonly taxAmount: string;
    /** What the payer pays, the coupon taken off. */
    declare readonly amount: string;
    /** The coupon the payer put on it; null when none was. The amounts above already have it taken off. */
    declare readonly discount: Discount | null;
    declare readonly currency: Known<Currency>;
    /** Who paid, as they billed themselves; null while they have not said. */
    declare readonly customer: LinkPaymentCustomer | null;
    /** Whether it was made in the test environment. */
    declare readonly isTest: boolean;
    declare readonly createdAt: string | null;
    /** The payment that paid it, which names it again for a refund; null while it is open. */
    declare readonly transaction: TransactionReference | null;

    constructor(fields: Fields<LinkPayment>) {
        Object.assign(this, fields);
    }

    /** Whether a payment has gone through. */
    isPaid(): boolean {
        return this.status === 'paid';
    }

    static fromBody(linkPayment: Body): LinkPayment {
        const discount = optionalObject(linkPayment.discount);
        const customer = optionalObject(linkPayment.customer);
        const transaction = optionalObject(linkPayment.transaction);

        return new LinkPayment({
            token: string(linkPayment.token),
            reference: string(linkPayment.reference),
            paymentLink: PaymentLinkReference.fromBody(object(linkPayment.payment_link)),
            paymentProviderToken: said(linkPayment.payment_provider_token),
            status: string(linkPayment.status),
            items: list(linkPayment.items).map((item) => Item.fromBody(object(item))),
            subtotal: string(linkPayment.subtotal),
            taxAmount: string(linkPayment.tax_amount),
            amount: string(linkPayment.amount),
            discount: discount === null ? null : Discount.fromBody(discount),
            currency: string(linkPayment.currency),
            customer: customer === null ? null : LinkPaymentCustomer.fromBody(customer),
            isTest: boolean(linkPayment.is_test),
            createdAt: said(linkPayment.created_at),
            transaction: transaction === null ? null : TransactionReference.fromBody(transaction),
        });
    }
}

/**
 * Payments at the team's links asked after. The answer is always a list,
 * oldest first, and an empty one when nothing matched. The days are the
 * ones the gateway used, when the records were asked for by the days they
 * were made on: the ones asked for, or the last seven when none were.
 */
export class LinkPaymentList {
    declare readonly result: Result;
    /** The first day listed, `YYYY-MM-DD` in the team's own time; null when they were asked for by token or reference. */
    declare readonly createdFrom: string | null;
    /** The last day listed, the same way. */
    declare readonly createdTo: string | null;
    declare readonly linkPayments: LinkPayment[];

    constructor(fields: Fields<LinkPaymentList>) {
        Object.assign(this, fields);
    }

    /** The payments that have gone through. */
    paid(): LinkPayment[] {
        return this.linkPayments.filter((linkPayment) => linkPayment.isPaid());
    }

    static fromBody(body: Body): LinkPaymentList {
        return new LinkPaymentList({
            result: Result.fromBody(body),
            createdFrom: said(body.created_from),
            createdTo: said(body.created_to),
            linkPayments: list(body.link_payments).map((entry) => LinkPayment.fromBody(object(entry))),
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
    /** The reference the subscription is known by in the calling system. */
    declare readonly reference: string;
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
    /** The way the payer picked; null until they have, or when none was offered. */
    declare readonly shippingMethod: ShippingMethod | null;
    declare readonly subtotal: string;
    declare readonly shippingAmount: string;
    declare readonly taxAmount: string;
    /** What a renewal comes to: the lines and the way picked, with no coupon taken off. */
    declare readonly amount: string;
    /**
     * The coupon the payer put on the first payment, the only one that
     * takes a coupon; null when none was. The amounts above are without it;
     * what the first payment was charged is on `renewal.amount`.
     */
    declare readonly discount: Discount | null;
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
        const discount = optionalObject(subscription.discount);
        const namedCustomer = optionalObject(customer);

        return new Subscription({
            token: string(subscription.token),
            reference: string(subscription.reference),
            description: said(subscription.description),
            paymentProviderToken: said(subscription.payment_provider_token),
            status: string(subscription.status),
            period: string(subscription.period),
            renewalLimit: optionalInteger(subscription.renewal_limit),
            renewalsPaid: integer(subscription.renewals_paid),
            items: list(subscription.items).map((item) => Item.fromBody(object(item))),
            shippingMethod: shippingMethod === null ? null : ShippingMethod.fromBody(shippingMethod),
            subtotal: string(subscription.subtotal),
            shippingAmount: string(subscription.shipping_amount),
            taxAmount: string(subscription.tax_amount),
            amount: string(subscription.amount),
            discount: discount === null ? null : Discount.fromBody(discount),
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
 * Subscriptions asked after, each with its customer on
 * `Subscription.customer`. The answer is always a list, oldest first, and an empty one when
 * nothing matched. The days are the ones the gateway used, when the records
 * were asked for by the days they were made on: the ones asked for, or the
 * last seven when none were.
 */
export class SubscriptionList {
    declare readonly result: Result;
    /** The first day listed, `YYYY-MM-DD` in the team's own time; null when they were asked for by token or reference. */
    declare readonly createdFrom: string | null;
    /** The last day listed, the same way. */
    declare readonly createdTo: string | null;
    declare readonly subscriptions: Subscription[];

    constructor(fields: Fields<SubscriptionList>) {
        Object.assign(this, fields);
    }

    static fromBody(body: Body): SubscriptionList {
        return new SubscriptionList({
            result: Result.fromBody(body),
            createdFrom: said(body.created_from),
            createdTo: said(body.created_to),
            subscriptions: list(body.subscriptions).map((entry) => Subscription.fromSummary(object(entry))),
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
 * The answer about one kept card: kept or made the default.
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
 * Kept cards asked after, each with the customer it is kept for. A
 * customer's cards come with the one they pay with by default first. The answer is always a list, oldest first, and an empty one when
 * nothing matched. The days are the ones the gateway used, when the records
 * were asked for by the days they were made on: the ones asked for, or the
 * last seven when none were.
 */
export class SavedCardList {
    declare readonly result: Result;
    /** The first day listed, `YYYY-MM-DD` in the team's own time; null when they were asked for by token or reference. */
    declare readonly createdFrom: string | null;
    /** The last day listed, the same way. */
    declare readonly createdTo: string | null;
    declare readonly savedCards: SavedCard[];

    constructor(fields: Fields<SavedCardList>) {
        Object.assign(this, fields);
    }

    /** The card the customer pays with unless they say otherwise, when the cards were asked for by the customer's reference. */
    default(): SavedCard | null {
        return this.savedCards.find((card) => card.isDefault) ?? null;
    }

    static fromBody(body: Body): SavedCardList {
        return new SavedCardList({
            result: Result.fromBody(body),
            createdFrom: said(body.created_from),
            createdTo: said(body.created_to),
            savedCards: list(body.saved_cards).map((entry) => SavedCard.fromBody(object(entry))),
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
