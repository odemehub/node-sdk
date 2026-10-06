/**
 * The fixed sets of values the gateway speaks in, the same sets every
 * ödemehub SDK names. A request takes only the values listed here. An
 * answer is read as it came: a value the gateway adds later is handed back
 * as the plain string it is rather than refused, so the answer fields are
 * typed `Known<…>` — the listed values, or any other string.
 */

/**
 * One of the listed values, or a string the gateway added after this SDK
 * was written. Comparing against a listed value still checks the spelling.
 */
export type Known<T extends string> = T | (string & {});

/** The money a payment, an order, a subscription, a link or a payment at one is priced in. */
export type Currency = 'TRY' | 'USD' | 'EUR' | 'GBP';

/** How often a subscription renews. */
export type Period = 'daily' | 'weekly' | 'monthly' | 'annually';

/** Where an order stands: open until it is paid, then paid. */
export type OrderStatus = 'open' | 'paid';

/** Where a subscription stands. */
export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'cancelled' | 'completed';

/**
 * Where a payment at a link stands: open from the moment the payer starts
 * paying and while their bank turns them away, then paid once a payment
 * goes through.
 */
export type LinkPaymentStatus = 'open' | 'paid';

/**
 * What a payment link lets the payer pay: the lines the merchant wrote
 * (`fixed`), any amount they write themselves (`custom`), one of the
 * amounts offered (`predefined`), or one of those or an amount of their
 * own (`predefined_and_custom`).
 */
export type AmountType = 'fixed' | 'custom' | 'predefined' | 'predefined_and_custom';

/** Whether a payment link is paid in the one money it names, or the payer picks one of those it offers. */
export type CurrencyType = 'fixed' | 'selectable';

/**
 * How a link whose amount the payer picks reads its tax rate against what
 * they pay: split out of it (`inclusive`: 100 paid is 83.33 and 16.67 tax
 * at 20%), or added on top of it (`exclusive`: 100 written is 120 charged).
 */
export type TaxMode = 'inclusive' | 'exclusive';

/**
 * Where a payment attempt stands. `timeout` is an attempt the provider
 * never answered; it is not over, and needs looking into.
 */
export type TransactionStatus =
    | 'started'
    | 'redirected_to_secure_page'
    | 'returned_from_secure_page'
    | 'timeout'
    | 'failed'
    | 'expired'
    | 'successful';

/**
 * What a webhook says happened. The first part is what it is about —
 * `order`, `payment_link`, `subscription`, `transaction` — and the webhook
 * carries that thing's token; a `payment_link.*` webhook carries the token
 * of the payment at the link beside it.
 */
export type WebhookEvent =
    | 'order.paid'
    | 'order.payment_refunded'
    | 'order.payment_cancelled'
    | 'payment_link.paid'
    | 'payment_link.payment_refunded'
    | 'payment_link.payment_cancelled'
    | 'subscription.active'
    | 'subscription.past_due'
    | 'subscription.cancelled'
    | 'subscription.ended'
    | 'subscription.completed'
    | 'subscription.payment_refunded'
    | 'subscription.payment_cancelled'
    | 'transaction.successful'
    | 'transaction.failed'
    | 'transaction.expired'
    | 'transaction.payment_refunded'
    | 'transaction.payment_cancelled';

/** What became of a payment's money. */
export type PaymentStatus = 'unpaid' | 'paid' | 'cancelled' | 'refunded' | 'partially_refunded';

/** How a payment was made: confirmed at the bank (secure) or charged straight to the card (regular). */
export type SecurityType = 'secure' | 'regular';

/** How money went back out of a payment: the whole of it before settlement (cancel), or after it (refund). */
export type RefundType = 'cancel' | 'refund';

/** Where a giving back stands. */
export type RefundStatus = 'pending' | 'successful' | 'failed';

/** The network a card belongs to. */
export type CardScheme =
    | 'visa'
    | 'mastercard'
    | 'american_express'
    | 'troy'
    | 'discover'
    | 'diners_club'
    | 'jcb'
    | 'unionpay'
    | 'maestro';

/** Whether a card's money is lent, drawn from an account or loaded beforehand. */
export type CardType = 'credit' | 'debit' | 'prepaid';
