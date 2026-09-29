/**
 * What is handed to the gateway. Every request is a plain object written in
 * camelCase; the client turns it into the snake_case body the gateway
 * speaks, signs it and sends it. A field left out is left out of the body
 * altogether rather than sent empty.
 */

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
    /** The number, digits only, without spaces. */
    number: string;
    securityCode: string;
    /** Two digits, e.g. 04. */
    expiryMonth: string;
    /** Four digits, e.g. 2030. */
    expiryYear: string;
    /**
     * Whether the customer asked for this card to be kept, so they can pay
     * with it again without typing it out. The account's provider has to be
     * able to charge a kept card; one that cannot turns the payment down on
     * this field rather than declining it.
     */
    shouldSave?: boolean;
}

/**
 * Who a customer is billed as when they buy for a company. The three are
 * always given together: the gateway turns down a customer that names one
 * of them without the others.
 */
export interface TaxDetails {
    companyTitle: string;
    taxNumber: string;
    taxOffice: string;
}

/**
 * The customer a payment is made for, an order is opened for or a card is
 * kept for. The merchant names them by its own key for them on the channel
 * they came in on: the same key twice is the same customer, and what is
 * said of them here becomes the latest the gateway knows.
 */
export interface Customer {
    /** The key the merchant keeps this customer under in its own system. */
    channelReference: string;
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    address: string;
    district: string;
    province: string;
    country: string;
    /** The company they are billed as, for a customer buying for one. */
    tax?: TaxDetails;
}

/**
 * A customer the gateway already knows, named and nothing more. It is what
 * the endpoints that only look a customer up take, such as listing the
 * cards kept for them.
 */
export interface NamedCustomer {
    channelReference: string;
}

/**
 * A payment handed to the gateway. A payment is made with a card the
 * customer typed in or with one they let the merchant keep, never with
 * both: naming a kept card and a card at once is turned down by the
 * gateway, so it is turned down by the client first.
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
    installmentNumber: number;
    /** The address the customer is paying from, as the merchant sees it. */
    ip: string;
    customer: Customer;
    /** The card typed in. Left out only when a kept card is named instead. */
    card?: Card;
    /** A card the customer let the merchant keep, by the token the gateway gave it. */
    savedCardToken?: string;
    /** Three letters, e.g. TRY. Left out, the gateway takes the lira. */
    currency?: string;
    /**
     * The payment account to charge through. Left out, the team's routing
     * rules pick the account, and the team's default account is used when
     * none of them holds. A payment with a kept card always goes through the
     * account the card is kept at.
     */
    paymentProviderToken?: string;
    /**
     * What is being sold, where the customer spreads the amount over months
     * and the bank takes something for the waiting on top of it. Left out
     * where the two are the same, which is most payments.
     */
    baseAmount?: string;
}

/**
 * A payment the customer confirms with their bank. The gateway does not
 * settle it; it hands back the address the customer has to be sent to, and
 * posts them back to `callbackUrl` once they are done.
 */
export interface SecurePayment extends Payment {
    /** Where the customer is posted back to, with the signed outcome, once they are done at their bank. */
    callbackUrl: string;
}

/**
 * A payment charged straight to the card, without sending the customer to
 * their bank to confirm it. A successful answer is a settled payment.
 */
export type RegularPayment = Payment;

/**
 * One line of what an order is made up of. A line names one of the
 * merchant's products by its own key for it; whatever it leaves unsaid —
 * name, price, tax — is filled in from the product saved with
 * `saveProduct()`. What it does say holds for this order alone.
 *
 * A line whose key names no product still goes through, as long as it
 * brings its own name and price.
 */
export interface OrderItem {
    /** The key the product is saved under on the order's channel. */
    channelReference: string;
    /** Left out, the product's own name is shown. */
    name?: string;
    /** Left out, the line is for one. */
    quantity?: number;
    /** The price of one, as digits with the kurus behind a point. Left out, the product's own price is charged. */
    unitAmount?: string;
    /** The tax included in the price, as a percentage, e.g. '20'. Left out, the product's own rate is used. */
    taxRate?: string;
}

/**
 * An order opened to be paid on the gateway's own page. Nothing is charged
 * here: the answer carries the address to send the customer to, and they
 * give their card there. What the order comes to is not sent; the gateway
 * adds up the lines and answers with the amount.
 */
export interface OrderPayment extends ChannelMessage {
    /** The number the order is known by in the calling system. */
    channelReference: string;
    /** Where the customer is posted back to, with the signed outcome, once the order is paid. */
    successUrl: string;
    customer: Customer;
    /** What the order is made up of; at least one line. */
    items: OrderItem[];
    /** Where the customer goes if they turn back without paying. */
    cancelUrl?: string;
    description?: string;
    /** Three letters, e.g. TRY. Left out, the gateway takes the lira. */
    currency?: string;
    /**
     * The payment account the order is paid through, by its token. Left out,
     * the merchant's Gate rules pick the account, and its default account is
     * used where none of them holds.
     */
    paymentProviderToken?: string;
}

/**
 * One line of what a subscription is for: one of the merchant's recurring
 * products, named by its own key for it. What it costs and how often it
 * comes round are the product's, as saved with `saveProduct()`.
 */
export interface SubscriptionItem {
    /** The key the recurring product is saved under on the subscription's channel. */
    channelReference: string;
    /** Left out, the line is for one. */
    quantity?: number;
    /**
     * The price of one for the first period only, as digits with the kurus
     * behind a point: an opening offer. The periods after it are charged at
     * the product's own price. Left out, the first period is charged at that
     * price too.
     */
    unitAmount?: string;
}

/**
 * A subscription opened for a customer and paid for the first time on the
 * gateway's own page. Nothing is charged here: the answer carries the
 * address to send the customer to. The card is kept, because the periods
 * to come are taken from it.
 *
 * The products subscribed to come round at the same frequency and are
 * priced in the same money, because a subscription is charged as one thing.
 */
export interface SubscriptionPayment extends ChannelMessage {
    /** The key the subscription is known by in the calling system. */
    channelReference: string;
    /** What is subscribed to; at least one line, each product once. */
    items: SubscriptionItem[];
    /** Where the customer is posted back to, with the signed outcome, once the first period is paid. */
    successUrl: string;
    customer: Customer;
    /** Where the customer goes if they turn back without paying. */
    cancelUrl?: string;
    /** Where the merchant is told, signed, whenever the subscription's state changes. */
    webhookUrl?: string;
    /**
     * The payment account the subscription is paid through, by its token;
     * the card is kept there and renewals are taken there. Left out, the
     * merchant's Gate rules pick the account, and its default account is
     * used where none of them holds.
     */
    paymentProviderToken?: string;
}

/**
 * Something asked of a payment that has already been made, named by the
 * token the gateway gave it.
 */
export interface PaymentMessage {
    /** The payment's token in the gateway, as it answered when the payment was made. */
    transactionToken: string;
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
    currency?: string;
}

/**
 * A product written down in the merchant's catalogue at the gateway, under
 * the merchant's own key for it on one of its channels. The same key on the
 * same channel is the same product: sending it again changes the one
 * already saved. A product is never deleted; it is taken off sale by
 * sending it with `isActive: false`.
 */
export interface SaveProduct extends ChannelMessage {
    /** The key the product is known by in the calling system. */
    channelReference: string;
    name: string;
    /** simple for something sold once, recurring for something subscribed to. */
    type: 'simple' | 'recurring';
    /** The price of one, as digits with the kurus behind a point. */
    amount: string;
    /** The tax included in the price, as a percentage, e.g. '20'. */
    taxRate: string;
    /** How often a recurring product comes round. Only a recurring product has one. */
    period?: 'monthly' | 'yearly';
    /** Three letters, e.g. TRY. Left out, the gateway takes the lira. */
    currency?: string;
    /** Whether it is on sale. Left out, it is. */
    isActive?: boolean;
}

/**
 * Something asked of a subscription that has already been opened, named by
 * the token the gateway gave it.
 */
export interface SubscriptionMessage {
    /** The subscription's token in the gateway, as it answered when it was opened. */
    subscriptionToken: string;
}

/**
 * Where a subscription stands. Nothing is changed by asking.
 */
export type RetrieveSubscription = SubscriptionMessage;

/**
 * A subscription called off. Nothing is given back: the customer keeps the
 * days they have already paid for, and nothing is charged after that.
 */
export type CancelSubscription = SubscriptionMessage;

/**
 * A card kept for a customer without a payment being made on it.
 *
 * Providers without a card store of their own keep a card by charging one
 * lira and giving it straight back; those ask for the security code, and
 * the ones with a real card store do not.
 */
export interface SaveCard extends ChannelMessage {
    customer: Customer;
    card: Omit<Card, 'securityCode' | 'shouldSave'> & { securityCode?: string };
    /** The payment account to keep the card at. Left out, the team's default account is used. */
    paymentProviderToken?: string;
}

/**
 * The cards a customer has let the merchant keep. The card that is theirs
 * by default comes first.
 */
export interface SavedCards extends ChannelMessage {
    customer: NamedCustomer;
}

/**
 * Something done to one of a customer's kept cards. The card is named by the
 * token the gateway gave it, and the customer alongside it, so a card can
 * only ever be reached through the customer it belongs to.
 */
export interface SavedCardMessage extends ChannelMessage {
    customer: NamedCustomer;
    /** The card's token in the gateway, as a listing of the customer's cards gave it. */
    savedCardToken: string;
}

/**
 * Making one of a customer's kept cards the one they pay with unless they
 * say otherwise.
 */
export type DefaultSavedCard = SavedCardMessage;

/**
 * Letting go of a kept card, at the provider first and with the gateway
 * after: a card the provider would not let go of stays, and the answer
 * says why.
 */
export type DeleteSavedCard = SavedCardMessage;
