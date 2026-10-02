/**
 * What is handed to the gateway. Every request is a plain object written in
 * camelCase; the client turns it into the snake_case body the gateway
 * speaks, signs it and sends it. A field left out is left out of the body
 * altogether rather than sent empty.
 *
 * Nothing is checked on this side: the gateway checks every field and
 * answers a refusal with `ValidationError`, field by field.
 */

import type { Currency, Period, SubscriptionStatus } from './enums.js';

export type { Currency, Period } from './enums.js';

/**
 * A message that speaks for one of the team's channels: a payment, an order
 * opened for checkout, a card kept for a customer. The channel belongs to
 * the integration rather than to any one message, so it is named once on
 * the client; a merchant selling on more than one channel names another
 * here, on the single message that belongs elsewhere.
 */
export interface ChannelMessage {
    /** The channel this one message speaks for. Left out, the client's own is used. */
    channelToken?: string;
}

/**
 * The card a payment is attempted with. The number and the security code
 * travel no further than the request body: the gateway keeps only the head
 * and the tail digits of the number and no digit of the code.
 */
export interface Card {
    holderName: string;
    /** The number, digits only; it may be written in groups with spaces. */
    number: string;
    securityCode: string;
    /** Two digits, e.g. 04. */
    expiryMonth: string;
    /** Four digits, e.g. 2030. */
    expiryYear: string;
    /**
     * Whether the customer asked for this card to be kept, so they can pay
     * with it again without typing it out. It is kept under the customer's
     * `reference`, which then has to be sent, and the account's provider has
     * to be able to charge a kept card.
     */
    shouldSave?: boolean;
}

/**
 * The person a bill goes to or goods go to, field by field.
 */
export interface Person {
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    address: string;
    district: string;
    province: string;
    country: string;
}

/**
 * Who a customer is billed as when they buy for a company. The three are
 * given together or not at all, and only in the billing address.
 */
export interface Company {
    companyTitle?: string;
    taxNumber?: string;
    taxOffice?: string;
}

/**
 * Where the goods go, as far as the merchant knows it: what is left out is
 * asked on the checkout page.
 */
export type Address = Partial<Person>;

/**
 * Where the bill goes, as far as the merchant knows it, with the company
 * they are billed as when they buy for one.
 */
export type BillingAddress = Partial<Person> & Company;

/**
 * The customer an order or a subscription is for: the key the merchant
 * keeps them under, where the bill goes and where the goods go — any of
 * it, or none. What is given is shown filled in on the checkout page, and
 * the payer is asked for the rest.
 */
export interface Customer {
    /** The key the merchant keeps this customer under in its own system. */
    reference?: string;
    billingAddress?: BillingAddress;
    shippingAddress?: Address;
}

/**
 * The customer a payment is made for: the whole billing address, and the
 * key the merchant keeps them under when it has one. A card is only kept,
 * and a kept card only charged, under the key.
 */
export interface PaymentCustomer {
    /** The key the merchant keeps this customer under in its own system. */
    reference?: string;
    billingAddress: Person & Company;
}

/**
 * A payment handed to the gateway. A payment is made with a card the
 * customer typed in or with one they let the merchant keep, never with
 * both: the gateway turns down a body that names both.
 */
export interface Payment extends ChannelMessage {
    /**
     * The reference the payment is known by in the calling system, such as
     * SIP-10231. It has to carry at least one digit: its digits end the
     * order number the bank is sent, so the payment can be found in the
     * bank's panel by it.
     */
    channelReference: string;
    /**
     * The amount, as digits with the kurus behind a point: '100', '100.1'
     * or '100.10'. A comma is refused. It is a string so that it is signed
     * and sent exactly as it is written here, with no rounding on the way.
     */
    amount: string;
    /** 1 to 12. More than one only for a payment asked for and charged in lira. */
    installmentNumber: number;
    /** The address the customer is paying from, as the merchant sees it. */
    ip: string;
    customer: PaymentCustomer;
    /** The card typed in. Left out only when a kept card is named instead. */
    card?: Card;
    /**
     * A card the customer let the merchant keep, by the token the gateway
     * gave it. It is only charged for the customer it was kept for — the
     * same channel and `customer.reference` — and at the account it is kept
     * at, so no `paymentProviderToken` is sent with it.
     */
    savedCardToken?: string;
    /** Left out, the gateway takes the lira. */
    currency?: Currency;
    /**
     * The payment account to charge through. Left out, the team's routing
     * rules pick the account, and the team's default account is used when
     * none of them holds.
     */
    paymentProviderToken?: string;
    /**
     * What is being sold, where the customer spreads the amount over months
     * and the bank takes something for the waiting on top of it. Never more
     * than the amount. Left out where the two are the same, which is most
     * payments.
     */
    baseAmount?: string;
}

/**
 * A payment the customer confirms with their bank. The gateway does not
 * settle it; it hands back the address the customer has to be sent to, and
 * posts them back to `callbackUrl` once they are done.
 */
export interface SecurePayment extends Payment {
    /** Where the customer is posted back to once they are done at their bank. */
    callbackUrl: string;
}

/**
 * A payment charged straight to the card, without sending the customer to
 * their bank to confirm it. A successful answer is a settled payment.
 */
export type RegularPayment = Payment;

/**
 * Something asked of a payment that has already been made, named by the
 * token the gateway gave it.
 */
export interface PaymentMessage {
    /** The payment's token in the gateway, as it answered when the payment was made. */
    token: string;
}

/**
 * Money given back out of a payment the provider has already settled, whole
 * or in part.
 */
export interface RefundPayment extends PaymentMessage {
    /**
     * How much goes back, as digits with the kurus behind a point: '35.50'.
     * Leave it out and everything the payment has left in it goes back. It
     * is never more than the payment has left: the gateway turns down
     * anything larger.
     */
    amount?: string;
}

/**
 * The whole of a payment taken back before the provider has settled it.
 * Anything less goes back as a refund.
 */
export type CancelPayment = PaymentMessage;

/**
 * How a payment went, asked for after the fact. A customer sent to their
 * bank comes back carrying the payment's token and nothing more; this is
 * the call that says what became of it.
 */
export type RetrievePayment = PaymentMessage;

/**
 * Something the merchant names by its own reference for it on one of its
 * channels rather than by its token. Where more than one carries the same
 * reference, the one made last is meant.
 */
export interface RetrieveByReference extends ChannelMessage {
    /** The reference it was made under in the calling system. */
    channelReference: string;
}

/**
 * Everything of a kind made on one of the merchant's channels within a
 * stretch of days, oldest first. The stretch is at most seven days, both
 * ends counted, in the team's own time; left out, it is the last seven days
 * up to today.
 */
export interface RetrieveByChannelReference extends ChannelMessage {
    /** The first day, as `YYYY-MM-DD`. Given together with `createdTo`. */
    createdFrom?: string;
    /** The last day, as `YYYY-MM-DD`, at most six days after the first. */
    createdTo?: string;
}

/**
 * The last payment made under one of the merchant's own references, for a
 * merchant that sent a payment and never heard back.
 */
export type RetrievePaymentByReference = RetrieveByReference;

/**
 * Every payment made on a channel within a stretch of days, the attempts
 * the bank turned away included.
 */
export type RetrievePaymentsByChannelReference = RetrieveByChannelReference;

/**
 * A question about a card before anything is charged to it: who issued it,
 * what kind of card it is, and how the amount may be paid off on it. Only
 * the head of the number is sent, never the whole of it.
 */
export interface RetrieveBin {
    /** The first six to eight digits of the card. */
    bin: string;
    /** What the payment would come to, as digits with the kurus behind a point: '1000.00'. */
    amount: string;
    /**
     * The account to ask. Left out, the account the team's routing rules
     * would send the card to is asked — the default one when none of them
     * holds — so the instalments match a payment that names no account either.
     */
    paymentProviderToken?: string;
    /** The money the payment is taken in; the lira unless another is named. */
    currency?: Currency;
}

/**
 * One line of what an order, a subscription or a payment link is made up
 * of, sent as it is sold: nothing is looked up in a catalogue.
 */
export interface Item {
    name: string;
    /** The price of one, tax included, as digits with the kurus behind a point: '120.00'. */
    unitAmount: string;
    /** 1 to 9999. */
    quantity: number;
    /** The tax inside the price, as a percentage: '20' or '20.00'. */
    taxRate: string;
    /** The merchant's own key for what is on the line, if it has one. */
    channelReference?: string;
    /** The https address of the picture shown beside the line at checkout. */
    image?: string;
}

/**
 * One way the goods of an order or a subscription may be sent, offered to
 * the payer on the checkout page. The one they pick is added to what they
 * pay. The handle is the merchant's own key for it and has to be unique
 * within the list; the amount includes the tax, like an item's price.
 */
export interface ShippingMethod {
    handle: string;
    /** What the payer sees, e.g. 'Standart Kargo'. */
    title: string;
    /** What it costs, tax included, as digits with the kurus behind a point; '0' for free. */
    amount: string;
    /** The tax inside the amount, as a percentage. */
    taxRate: string;
}

/**
 * An order or a subscription opened to be paid on the gateway's own page.
 * Nothing is charged here: the answer carries the address to send the
 * customer to. What it comes to is never sent: it is the lines added up,
 * and the way of sending the payer picks.
 *
 * Opening again under a reference already open on the channel writes over
 * the open one and answers with it, under its own token, so a call repeated
 * after a lost answer finds what it opened rather than a twin of it.
 */
export interface CheckoutMessage extends ChannelMessage {
    /** The reference it is known by in the calling system. Has to carry at least one digit. */
    channelReference: string;
    /** Where the customer is posted back to once it is paid. */
    successUrl: string;
    /** What it is for; at least one line. */
    items: Item[];
    /** Who it is for, as far as the merchant knows; the rest is asked on the checkout page. */
    customer?: Customer;
    /** Where the customer goes if they turn back without paying. */
    cancelUrl?: string;
    description?: string;
    /** Left out, the gateway takes the lira. */
    currency?: Currency;
    /**
     * The payment account it is paid through. Left out, the merchant's Gate
     * rules pick the account when the customer pays, and its default account
     * is used where none of them holds.
     */
    paymentProviderToken?: string;
    /** Whether the checkout page asks the payer where the goods go. */
    requiresShippingAddress?: boolean;
    /** How the goods may be sent, for the payer to pick from; up to twenty. */
    shippingMethods?: ShippingMethod[];
}

/**
 * A change to an order or a subscription, named by its token. Only what is
 * sent is written: a field left out keeps what there was, lines sent replace
 * every line there was, and shipping methods sent replace the ones there
 * were. A field set to `null` is set to nothing: an empty list of shipping
 * methods or `null` removes them all.
 *
 * The channel is written only when this message names one; the client's
 * own is not sent.
 */
export interface UpdateCheckoutMessage extends ChannelMessage {
    channelReference?: string;
    successUrl?: string;
    items?: Item[];
    /** What is sent of the customer is written over what there was of them. */
    customer?: Customer;
    cancelUrl?: string | null;
    description?: string | null;
    /** `null` sets it back to the lira. */
    currency?: Currency | null;
    /** `null` leaves the account to the team's Gate rules and default account again. */
    paymentProviderToken?: string | null;
    requiresShippingAddress?: boolean | null;
    shippingMethods?: ShippingMethod[] | null;
}

/**
 * An order opened to be paid once on the gateway's own page.
 */
export type CreateOrder = CheckoutMessage;

/**
 * A change to an open order. A paid order never changes.
 */
export interface UpdateOrder extends UpdateCheckoutMessage {
    /** The order's token in the gateway. */
    token: string;
}

/**
 * An order asked after by the token the gateway gave it when it was opened,
 * which is all a merchant holds of an order whose customer never came back
 * from the checkout. Nothing is changed by asking.
 */
export interface RetrieveOrder {
    /** The order's token in the gateway, as it answered when it was opened. */
    token: string;
}

/** The last order opened under one of the merchant's own references. */
export type RetrieveOrderByReference = RetrieveByReference;

/** Every order opened on a channel within a stretch of days. */
export type RetrieveOrdersByChannelReference = RetrieveByChannelReference;

/**
 * A subscription opened for a customer and paid for the first time on the
 * gateway's own page. The card is kept there, and the renewals to come are
 * taken from it; so the account it is paid through has to keep cards and
 * take 3D payments, and the customer has to be named by the merchant's key
 * for them.
 */
export interface CreateSubscription extends CheckoutMessage {
    /** How often it renews. */
    period: Period;
    /** Who it is for; the key is required, the rest is asked on the checkout page. */
    customer: Customer & { reference: string };
    /** How many renewals are paid in all, 1 to 1000. Left out, it runs until it is called off. */
    renewalLimit?: number;
}

/**
 * A change to a subscription. Lines sent re-price every renewal not yet
 * paid. Once the first renewal has been paid the channel, the account, the
 * currency, the period and `customer.reference` stay as they were opened;
 * the gateway turns down a change to any of them.
 *
 * This is also how a subscription is called off: send the status
 * `cancelled`, the one status a merchant may set. Nothing is charged after
 * that and nothing is given back; a renewal already paid is served to its
 * end.
 */
export interface UpdateSubscription extends UpdateCheckoutMessage {
    /** The subscription's token in the gateway. */
    token: string;
    /** Only `cancelled` is taken; the other states follow the payments. */
    status?: Extract<SubscriptionStatus, 'cancelled'>;
    period?: Period;
    /** 1 to 1000, and never fewer than the renewals already paid; `null` runs it until it is called off. */
    renewalLimit?: number | null;
}

/**
 * A subscription asked after by its token. Nothing is changed by asking.
 */
export interface RetrieveSubscription {
    /** The subscription's token in the gateway, as it answered when it was opened. */
    token: string;
}

/** The last subscription opened under one of the merchant's own references. */
export type RetrieveSubscriptionByReference = RetrieveByReference;

/** Every subscription opened on a channel within a stretch of days. */
export type RetrieveSubscriptionsByChannelReference = RetrieveByChannelReference;

/**
 * A payment link: a page on the gateway that is paid again and again, by
 * anybody who has the address, until it is switched off or its day runs
 * out. There is no customer; whoever pays says who they are on the page.
 *
 * Opening again under a reference that already has a link writes over that
 * link and answers with it, under its own token. A link opened without a
 * reference is given one of the form `LINK{n}`.
 */
export interface CreatePaymentLink {
    /** What the link is for; at least one line. */
    items: Item[];
    currency: Currency;
    /**
     * The channel the link sells on. Left out, the client's own is used;
     * `null` opens it on the team's own ödemehub channel, where the panel
     * opens its links.
     */
    channelToken?: string | null;
    /** The reference the link is known by in the calling system. Has to carry at least one digit. */
    channelReference?: string;
    description?: string;
    /** The account the link is paid through; it has to take 3D payments. Left out, Gate rules and the default account decide when it is paid. */
    paymentProviderToken?: string;
    /** The last day the link may be paid, as `YYYY-MM-DD` in the team's own time; today or later. Left out, it never runs out. */
    expiresAt?: string;
    /** Whether the link takes payments. Left out, it does. */
    isActive?: boolean;
}

/**
 * A change to a payment link. Only what is sent is written: a field left
 * out keeps what there was, and lines sent replace every line there was. A
 * field set to `null` is set to nothing. Switching a link off is
 * `isActive: false`; switching one whose day has gone by back on needs a
 * new `expiresAt` with it.
 */
export interface UpdatePaymentLink {
    /** The link's token in the gateway. */
    token: string;
    items?: Item[];
    currency?: Currency;
    /** Written only when named; `null` moves the link to the team's own ödemehub channel. */
    channelToken?: string | null;
    channelReference?: string;
    description?: string | null;
    paymentProviderToken?: string | null;
    /** As `YYYY-MM-DD` in the team's own time; `null` lets it never run out. */
    expiresAt?: string | null;
    isActive?: boolean;
}

/**
 * A payment link asked after by its token, with the latest payments made
 * on it. Nothing is changed by asking.
 */
export interface RetrievePaymentLink {
    /** The link's token in the gateway, as it answered when it was opened. */
    token: string;
}

/**
 * The last link opened under one of the merchant's own references.
 */
export interface RetrievePaymentLinkByReference {
    channelReference: string;
    /** Left out, the client's own channel is looked on; `null` looks on the team's own ödemehub channel. */
    channelToken?: string | null;
}

/**
 * Every link opened on a channel within a stretch of days.
 */
export interface RetrievePaymentLinksByChannelReference {
    /** The first day, as `YYYY-MM-DD`. Given together with `createdTo`. */
    createdFrom?: string;
    /** The last day, as `YYYY-MM-DD`, at most six days after the first. */
    createdTo?: string;
    /** Left out, the client's own channel is listed; `null` lists the team's own ödemehub channel. */
    channelToken?: string | null;
}

/**
 * A card kept for a customer without a payment being made on it. It is
 * kept under the channel and the customer's reference; a payment with the
 * card has to name the same two.
 *
 * Providers without a card store of their own keep a card by charging a
 * small amount and giving it straight back; those need the security code,
 * and the ones with a real card store do not. It is never stored.
 */
export interface CreateSavedCard extends ChannelMessage {
    /** Who the card belongs to: the key and the whole billing address. */
    customer: { reference: string; billingAddress: Person & Company };
    card: Omit<Card, 'securityCode' | 'shouldSave'> & { securityCode?: string };
    /** The payment account to keep the card at; it has to keep cards. Left out, the team's default account is used. */
    paymentProviderToken?: string;
}

/**
 * Something asked of or done to a kept card, named by the token the gateway
 * gave it.
 */
export interface SavedCardMessage {
    /** The card's token in the gateway. */
    token: string;
}

/**
 * One kept card, by its token.
 */
export type RetrieveSavedCard = SavedCardMessage;

/**
 * The cards kept for a customer, named by the two things a card is kept
 * under: the channel and the merchant's key for the customer. The card they
 * pay with unless they say otherwise comes first.
 */
export interface RetrieveSavedCardsByReference extends ChannelMessage {
    /** The key the merchant keeps the customer under. */
    customerReference: string;
}

/**
 * Making a kept card the one the customer pays with unless they say
 * otherwise. A card stops being the default only when another of the
 * customer's cards is made the default instead.
 */
export interface UpdateSavedCard extends SavedCardMessage {
    /** Left out, true; the gateway takes nothing else. */
    isDefault?: boolean;
}

/**
 * Letting go of a kept card, at the provider first and with the gateway
 * after: a card the provider would not let go of stays, and the answer
 * says why.
 */
export type DeleteSavedCard = SavedCardMessage;
