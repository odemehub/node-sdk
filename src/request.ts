/**
 * What is handed to the gateway. Every request is a plain object written in
 * camelCase; the client turns it into the snake_case body the gateway
 * speaks, signs it and sends it. A field left out is left out of the body
 * altogether rather than sent empty.
 *
 * Nothing is checked on this side: the gateway checks every field and
 * answers a refusal with `ValidationError`, field by field.
 */

import type { AmountType, Currency, CurrencyType, Period, SubscriptionStatus, TaxMode } from './enums.js';

export type { AmountType, Currency, CurrencyType, Period, TaxMode } from './enums.js';

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
     * with it again without typing it out. It is kept for the customer named
     * by `customer.reference`, which then has to be sent, and the account's
     * provider has to be able to charge a kept card.
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
 * the payer is asked for the rest. The key makes them one of the team's
 * customers, written once a payment for them goes through; without it the
 * payer is nobody the team keeps.
 */
export interface Customer {
    /** The key the merchant keeps this customer under in its own system. */
    reference?: string;
    billingAddress?: BillingAddress;
    shippingAddress?: Address;
}

/**
 * The customer a payment is made for: the whole billing address, and the
 * key the merchant keeps them under when it has one. The customer is
 * written under the key once the payment goes through; a card is only
 * kept for, and a kept card only charged for, a customer named by it.
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
export interface Payment {
    /**
     * The reference the payment is known by in the calling system, such as
     * SIP-10231. It has to carry at least one digit: its digits end the
     * order number the bank is sent, so the payment can be found in the
     * bank's panel by it.
     */
    reference: string;
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
     * same `customer.reference` — and at the account it is kept at, so no
     * `paymentProviderToken` is sent with it.
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
    /** The tax inside the price, as a percentage: '20' or '20.00'. Left out, the line carries no tax. */
    taxRate?: string;
    /** The merchant's own key for what is on the line, if it has one. */
    reference?: string;
    /** The https address of the picture shown beside the line at checkout. */
    image?: string;
    /**
     * Whether the line is also kept on the team's product list: written
     * there under its reference, or the product with that reference brought
     * up to the line. A line kept so has to carry a reference.
     */
    saveAsProduct?: boolean;
}

/**
 * An order or a subscription opened to be paid on the gateway's own page.
 * Nothing is charged here: the answer carries the address to send the
 * customer to. What it comes to is never sent: it is the lines added up,
 * and the way of sending the payer picks from the team's own list.
 *
 * Every call opens a new one under a new token, even under a reference
 * already sent: nothing open is written over, and a repeated reference is
 * not turned down. Keep the token each answer carries; it is what names
 * this one from then on, to ask after it or change it.
 */
export interface CheckoutMessage {
    /** The reference it is known by in the calling system. Has to carry at least one digit; it need not be unique. */
    reference: string;
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
    /**
     * Whether the checkout page asks the payer where the goods go. One who
     * is picks a way of sending from the team's own list, of those that send
     * there, and its price is added to the amount.
     */
    requiresShipping?: boolean;
    /**
     * Whether the customer stays as sent: the checkout page asks the payer
     * nothing about who they are and only shows it. Takes a customer with a
     * whole billing address, and a whole shipping address too when the
     * goods are sent.
     */
    locksCustomer?: boolean;
    /**
     * Whether the customer is sent an e-mail at their billing address: on an
     * order once it is paid, on a subscription whenever where it stands
     * changes.
     */
    emailsCustomer?: boolean;
}

/**
 * A change to an order or a subscription, named by its token. Only what is
 * sent is written: a field left out keeps what there was, and lines sent
 * replace every line there was. A field set to `null` is set to nothing.
 */
export interface UpdateCheckoutMessage {
    reference?: string;
    successUrl?: string;
    items?: Item[];
    /** What is sent of the customer is written over what there was of them; a reference sent takes the place of the one there was. */
    customer?: Customer;
    cancelUrl?: string | null;
    description?: string | null;
    /** `null` sets it back to the lira. */
    currency?: Currency | null;
    /** `null` leaves the account to the team's Gate rules and default account again. */
    paymentProviderToken?: string | null;
    requiresShipping?: boolean | null;
    locksCustomer?: boolean | null;
    emailsCustomer?: boolean | null;
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
 * paid. Once the first renewal has been paid only the status, the period,
 * the renewal limit and the prices of the same lines may change; the
 * gateway turns down anything else, the customer included.
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
 * A payment link: a page on the gateway that is paid again and again, by
 * anybody who has the address, until it is switched off or its day runs
 * out. There is no customer; whoever pays says who they are on the page.
 *
 * A link is paid as the lines the merchant wrote (`amountType` `fixed`, the
 * default), or lets the payer pick the amount — any they write, one of
 * `predefinedAmounts`, or either — paid as one line named `itemName`, with
 * `taxRate` read as `taxMode` says. It is paid in `currency`, or, with
 * `currencyType` `selectable`, in any of `currencies` the payer picks.
 *
 * Every call opens a new link under a new token, even under a reference
 * already sent: nothing is written over, and a repeated reference is not
 * turned down. Keep the token the answer carries. A link opened without a
 * reference is given one of the form `LINK{n}`.
 */
export interface CreatePaymentLink {
    /** The money the link is priced in, and the one the payer starts with where they may pick another. */
    currency: Currency;
    /** What the link is for; at least one line on a `fixed` link, passed over on the others. */
    items?: Item[];
    /** The reference the link is known by in the calling system. Has to carry at least one digit; it need not be unique. */
    reference?: string;
    description?: string;
    /** The account the link is paid through; it has to take 3D payments. Left out, Gate rules and the default account decide when it is paid. */
    paymentProviderToken?: string;
    /** What the payer pays: the lines (`fixed`), or an amount they pick. Left out, `fixed`. */
    amountType?: AmountType;
    /** The name of the one line a payment is made up of where the payer picks the amount; needed there. */
    itemName?: string;
    /** The amounts the payer picks from, at most ten, as digits with the kurus behind a point: '100.00'. Needed for `predefined` and `predefined_and_custom`. */
    predefinedAmounts?: string[];
    /** The tax on the amount the payer picks, as a percentage: '20'. Left out, it carries none. */
    taxRate?: string;
    /** Whether `taxRate` is inside the amount the payer picks or added on top of it. Left out, `inclusive`. */
    taxMode?: TaxMode;
    /** Whether the payer may pick the money. Left out, `fixed`: the link is paid in `currency`. */
    currencyType?: CurrencyType;
    /** The money the payer may pick besides `currency`; needed for `selectable`. */
    currencies?: Currency[];
    /** Whether the payer is sent an e-mail, at the address they give on the checkout page, once their payment goes through. Left out, they are not. */
    emailsCustomer?: boolean;
    /** The last day the link may be paid, as `YYYY-MM-DD` in the team's own time; today or later. Left out, it never runs out. */
    expiresAt?: string;
    /** Whether the link takes payments. Left out, it does. */
    isActive?: boolean;
}

/**
 * A change to a payment link. Only what is sent is written: a field left
 * out keeps what there was, and lines sent replace every line there was. A
 * field set to `null` is set to nothing. A link turned back to `fixed`, or
 * left `fixed` without lines, has to be sent its lines. Switching a link
 * off is `isActive: false`; one whose day has gone by is switched back on
 * by giving it a new `expiresAt`.
 */
export interface UpdatePaymentLink {
    /** The link's token in the gateway. */
    token: string;
    items?: Item[];
    currency?: Currency;
    reference?: string;
    description?: string | null;
    paymentProviderToken?: string | null;
    amountType?: AmountType;
    itemName?: string | null;
    predefinedAmounts?: string[] | null;
    /** `null` leaves the amount the payer picks without tax. */
    taxRate?: string | null;
    taxMode?: TaxMode;
    currencyType?: CurrencyType;
    currencies?: Currency[] | null;
    emailsCustomer?: boolean;
    /** As `YYYY-MM-DD` in the team's own time; `null` lets it never run out. */
    expiresAt?: string | null;
    isActive?: boolean;
}

/**
 * A card kept for a customer without a payment being made on it. Once the
 * provider takes it, the team's customer under the reference is written
 * from what was sent and the card is kept for them; a payment with the card
 * has to name the same reference.
 *
 * Providers without a card store of their own keep a card by charging a
 * small amount and giving it straight back; those need the security code,
 * and the ones with a real card store do not. It is never stored.
 */
export interface CreateSavedCard {
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

/**
 * Asking after records of one kind. They are named one of three ways: by
 * the token the gateway gave one, by the merchant's own reference for them,
 * or by the days they were made on, as `YYYY-MM-DD` in the team's own time,
 * both ends counted and at most seven days apart. Asked with none of these,
 * it is the last seven days up to today. The answer is always a list,
 * oldest first, and an empty one when nothing matches. Nothing is changed
 * by asking.
 */
export interface Retrieve {
    /** The record's token in the gateway. */
    token?: string;
    /** The merchant's own reference for them. */
    reference?: string;
    /** The first day, as `YYYY-MM-DD`. Given together with `createdTo`. */
    createdFrom?: string;
    /** The last day, as `YYYY-MM-DD`, at most six days after the first. */
    createdTo?: string;
}

/**
 * Payments asked after: one by its token, every attempt made under the
 * merchant's reference, or the ones made between two days — the ones the
 * bank turned away included.
 */
export type RetrievePayments = Retrieve;

/** Orders asked after, each with its customer. */
export type RetrieveOrders = Retrieve;

/** Subscriptions asked after, each with its customer and the renewal it is on. */
export type RetrieveSubscriptions = Retrieve;

/**
 * Payment links asked after, each with how many payments were made on it
 * and the latest fifty of them.
 */
export type RetrievePaymentLinks = Retrieve;

/**
 * Payments at the team's links asked after: one by its token, one by the
 * reference the gateway gave it (`LINKPAY1`, `LINKPAY2`…), or the ones made
 * between two days. A payment at a link is opened by the payer as they pay,
 * never by the merchant, so it is only ever asked after.
 */
export type RetrieveLinkPayments = Retrieve;

/**
 * Kept cards asked after: one by its token, every card of a customer by the
 * merchant's reference for them, or the ones kept between two days. A
 * customer's cards come with the one they pay with by default first.
 */
export interface RetrieveSavedCards extends Omit<Retrieve, 'reference'> {
    /** The merchant's reference for the customer the cards are kept for. */
    customerReference?: string;
}
