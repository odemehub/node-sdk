import type * as Request from './request.js';

/**
 * A request body, in the snake_case the gateway speaks.
 */
export type Body = Record<string, unknown>;

/**
 * An endpoint under the team's gateway, the method it is reached with and
 * the body sent to it. The body is built with the client's channel handed
 * in, because a message that speaks for a channel puts it where its own
 * endpoint expects it; one that does not, such as a refund, simply never
 * reads it. A message sent with GET carries no body at all.
 */
export interface Message {
    method: 'GET' | 'POST';
    path: string;
    body: Body | null;
}

/**
 * Drop what the caller left unsaid, so an optional field is left out of the
 * body altogether rather than sent empty.
 */
function said(body: Body): Body {
    return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined && value !== null));
}

/**
 * Drop only what the caller left out, keeping what it set to `null`: a
 * change sends `null` on purpose, to set a field to nothing.
 */
function given(body: Body): Body {
    return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}

function post(path: string, body: Body): Message {
    return { method: 'POST', path, body };
}

function get(path: string): Message {
    return { method: 'GET', path, body: null };
}

/**
 * A token as it is written into an address.
 */
function token(value: string): string {
    return encodeURIComponent(value);
}

function card(card: Request.Card): Body {
    return said({
        holder_name: card.holderName,
        number: card.number,
        security_code: card.securityCode,
        expiry_month: card.expiryMonth,
        expiry_year: card.expiryYear,
        should_save: card.shouldSave,
    });
}

function address(address: Request.BillingAddress): Body {
    return said({
        firstname: address.firstname,
        lastname: address.lastname,
        email: address.email,
        phone: address.phone,
        address: address.address,
        district: address.district,
        province: address.province,
        country: address.country,
        company_title: address.companyTitle,
        tax_number: address.taxNumber,
        tax_office: address.taxOffice,
    });
}

function customer(customer: Request.Customer | undefined): Body | undefined {
    if (customer === undefined) {
        return undefined;
    }

    return said({
        reference: customer.reference,
        billing_address: customer.billingAddress === undefined ? undefined : address(customer.billingAddress),
        shipping_address: customer.shippingAddress === undefined ? undefined : address(customer.shippingAddress),
    });
}

function item(item: Request.Item): Body {
    return said({
        channel_reference: item.channelReference,
        name: item.name,
        image: item.image,
        quantity: item.quantity,
        unit_amount: item.unitAmount,
        tax_rate: item.taxRate,
    });
}

function shippingMethod(method: Request.ShippingMethod): Body {
    return {
        handle: method.handle,
        title: method.title,
        amount: method.amount,
        tax_rate: method.taxRate,
    };
}

function payment(payment: Request.Payment, channelToken: string): Body {
    return said({
        transaction: said({
            channel_token: payment.channelToken ?? channelToken,
            channel_reference: payment.channelReference,
            payment_provider_token: payment.paymentProviderToken,
            amount: payment.amount,
            base_amount: payment.baseAmount,
            currency: payment.currency,
            installment_number: payment.installmentNumber,
            ip: payment.ip,
            saved_card_token: payment.savedCardToken,
        }),
        customer: customer(payment.customer),
        card: payment.card === undefined ? undefined : card(payment.card),
    });
}

export function securePayment(message: Request.SecurePayment, channelToken: string): Message {
    const body = payment(message, channelToken);

    body.transaction = said({
        ...(body.transaction as Body),
        callback_url: message.callbackUrl,
    });

    return post('secure-payment', body);
}

export function regularPayment(message: Request.RegularPayment, channelToken: string): Message {
    return post('regular-payment', payment(message, channelToken));
}

export function refundPayment(message: Request.RefundPayment): Message {
    return post('refund-payment', said({
        transaction: { token: message.token },
        amount: message.amount,
    }));
}

export function cancelPayment(message: Request.CancelPayment): Message {
    return post('cancel-payment', { transaction: { token: message.token } });
}

export function retrievePayment(message: Request.RetrievePayment): Message {
    return get(`retrieve-payment/${token(message.token)}`);
}

function byReference(path: string, message: Request.RetrieveByReference, channelToken: string): Message {
    return post(path, {
        channel_token: message.channelToken ?? channelToken,
        channel_reference: message.channelReference,
    });
}

function byChannelReference(path: string, message: Request.RetrieveByChannelReference, channelToken: string): Message {
    return post(path, said({
        channel_token: message.channelToken ?? channelToken,
        created_from: message.createdFrom,
        created_to: message.createdTo,
    }));
}

export function retrievePaymentByReference(message: Request.RetrievePaymentByReference, channelToken: string): Message {
    return byReference('retrieve-payment-by-reference', message, channelToken);
}

export function retrievePaymentsByChannelReference(message: Request.RetrievePaymentsByChannelReference, channelToken: string): Message {
    return byChannelReference('retrieve-payments-by-channel-reference', message, channelToken);
}

export function retrieveBin(message: Request.RetrieveBin): Message {
    return post('retrieve-bin', {
        transaction: said({
            payment_provider_token: message.paymentProviderToken,
            amount: message.amount,
            currency: message.currency,
        }),
        card: { bin: message.bin },
    });
}

/**
 * The fields an order and a subscription share, under their group, as a
 * new one is opened with them.
 */
function checkout(message: Request.CheckoutMessage, channelToken: string): Body {
    return said({
        channel_token: message.channelToken ?? channelToken,
        channel_reference: message.channelReference,
        description: message.description,
        payment_provider_token: message.paymentProviderToken,
        currency: message.currency,
        success_url: message.successUrl,
        cancel_url: message.cancelUrl,
        requires_shipping_address: message.requiresShippingAddress,
        items: message.items.map(item),
        shipping_methods: message.shippingMethods?.map(shippingMethod),
    });
}

/**
 * The fields an order and a subscription share, as a change sends them:
 * only what was given, `null` included, and the channel only when the
 * message names one.
 */
function checkoutChange(message: Request.UpdateCheckoutMessage): Body {
    return given({
        channel_token: message.channelToken,
        channel_reference: message.channelReference,
        description: message.description,
        payment_provider_token: message.paymentProviderToken,
        currency: message.currency,
        success_url: message.successUrl,
        cancel_url: message.cancelUrl,
        requires_shipping_address: message.requiresShippingAddress,
        items: message.items?.map(item),
        shipping_methods: message.shippingMethods === null ? null : message.shippingMethods?.map(shippingMethod),
    });
}

export function createOrder(message: Request.CreateOrder, channelToken: string): Message {
    return post('create-order', said({
        order: checkout(message, channelToken),
        customer: customer(message.customer),
    }));
}

export function retrieveOrder(message: Request.RetrieveOrder): Message {
    return get(`retrieve-order/${token(message.token)}`);
}

export function retrieveOrderByReference(message: Request.RetrieveOrderByReference, channelToken: string): Message {
    return byReference('retrieve-order-by-reference', message, channelToken);
}

export function retrieveOrdersByChannelReference(message: Request.RetrieveOrdersByChannelReference, channelToken: string): Message {
    return byChannelReference('retrieve-orders-by-channel-reference', message, channelToken);
}

export function updateOrder(message: Request.UpdateOrder): Message {
    return post(`update-order/${token(message.token)}`, said({
        token: message.token,
        order: checkoutChange(message),
        customer: customer(message.customer),
    }));
}

export function createPaymentLink(message: Request.CreatePaymentLink, channelToken: string): Message {
    return post('create-payment-link', {
        payment_link: said({
            channel_token: message.channelToken === undefined ? channelToken : message.channelToken,
            channel_reference: message.channelReference,
            description: message.description,
            payment_provider_token: message.paymentProviderToken,
            currency: message.currency,
            expires_at: message.expiresAt,
            is_active: message.isActive,
            items: message.items.map(item),
        }),
    });
}

export function retrievePaymentLink(message: Request.RetrievePaymentLink): Message {
    return get(`retrieve-payment-link/${token(message.token)}`);
}

export function retrievePaymentLinkByReference(message: Request.RetrievePaymentLinkByReference, channelToken: string): Message {
    return post('retrieve-payment-link-by-reference', said({
        channel_token: message.channelToken === undefined ? channelToken : message.channelToken,
        channel_reference: message.channelReference,
    }));
}

export function retrievePaymentLinksByChannelReference(message: Request.RetrievePaymentLinksByChannelReference, channelToken: string): Message {
    return post('retrieve-payment-links-by-channel-reference', said({
        channel_token: message.channelToken === undefined ? channelToken : message.channelToken,
        created_from: message.createdFrom,
        created_to: message.createdTo,
    }));
}

export function updatePaymentLink(message: Request.UpdatePaymentLink): Message {
    return post(`update-payment-link/${token(message.token)}`, {
        token: message.token,
        payment_link: given({
            channel_token: message.channelToken,
            channel_reference: message.channelReference,
            description: message.description,
            payment_provider_token: message.paymentProviderToken,
            currency: message.currency,
            expires_at: message.expiresAt,
            is_active: message.isActive,
            items: message.items?.map(item),
        }),
    });
}

export function createSubscription(message: Request.CreateSubscription, channelToken: string): Message {
    return post('create-subscription', said({
        subscription: said({
            ...checkout(message, channelToken),
            period: message.period,
            renewal_limit: message.renewalLimit,
        }),
        customer: customer(message.customer),
    }));
}

export function retrieveSubscription(message: Request.RetrieveSubscription): Message {
    return get(`retrieve-subscription/${token(message.token)}`);
}

export function retrieveSubscriptionByReference(message: Request.RetrieveSubscriptionByReference, channelToken: string): Message {
    return byReference('retrieve-subscription-by-reference', message, channelToken);
}

export function retrieveSubscriptionsByChannelReference(message: Request.RetrieveSubscriptionsByChannelReference, channelToken: string): Message {
    return byChannelReference('retrieve-subscriptions-by-channel-reference', message, channelToken);
}

export function updateSubscription(message: Request.UpdateSubscription): Message {
    return post(`update-subscription/${token(message.token)}`, said({
        token: message.token,
        subscription: given({
            ...checkoutChange(message),
            period: message.period,
            renewal_limit: message.renewalLimit,
            status: message.status,
        }),
        customer: customer(message.customer),
    }));
}

export function createSavedCard(message: Request.CreateSavedCard, channelToken: string): Message {
    return post('create-saved-card', {
        saved_card: said({
            channel_token: message.channelToken ?? channelToken,
            payment_provider_token: message.paymentProviderToken,
        }),
        customer: customer(message.customer),
        card: said({
            holder_name: message.card.holderName,
            number: message.card.number,
            security_code: message.card.securityCode === '' ? undefined : message.card.securityCode,
            expiry_month: message.card.expiryMonth,
            expiry_year: message.card.expiryYear,
        }),
    });
}

export function retrieveSavedCard(message: Request.RetrieveSavedCard): Message {
    return get(`retrieve-saved-card/${token(message.token)}`);
}

export function retrieveSavedCardsByReference(message: Request.RetrieveSavedCardsByReference, channelToken: string): Message {
    return post('retrieve-saved-cards-by-reference', {
        channel_token: message.channelToken ?? channelToken,
        customer_reference: message.customerReference,
    });
}

export function updateSavedCard(message: Request.UpdateSavedCard): Message {
    return post(`update-saved-card/${token(message.token)}`, {
        token: message.token,
        saved_card: { is_default: message.isDefault ?? true },
    });
}

export function deleteSavedCard(message: Request.DeleteSavedCard): Message {
    return post(`delete-saved-card/${token(message.token)}`, { token: message.token });
}
