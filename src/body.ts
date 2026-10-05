import type * as Request from './request.js';

/**
 * A request body, in the snake_case the gateway speaks.
 */
export type Body = Record<string, unknown>;

/**
 * An endpoint under the team's gateway and the body posted to it. Every
 * endpoint is reached with POST.
 */
export interface Message {
    path: string;
    body: Body;
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
    return { path, body };
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
        reference: item.reference,
        name: item.name,
        image: item.image,
        quantity: item.quantity,
        unit_amount: item.unitAmount,
        tax_rate: item.taxRate,
        save_as_product: item.saveAsProduct,
    });
}

function payment(payment: Request.Payment): Body {
    return said({
        transaction: said({
            reference: payment.reference,
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

export function securePayment(message: Request.SecurePayment): Message {
    const body = payment(message);

    body.transaction = said({
        ...(body.transaction as Body),
        callback_url: message.callbackUrl,
    });

    return post('secure-payment', body);
}

export function regularPayment(message: Request.RegularPayment): Message {
    return post('regular-payment', payment(message));
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

/**
 * Asking after records of one kind, by token, by reference or by days; the
 * reference travels under the name the endpoint gives it.
 */
function retrieve(path: string, message: Request.Retrieve, referenceField = 'reference'): Message {
    return post(path, said({
        token: message.token,
        [referenceField]: message.reference,
        created_from: message.createdFrom,
        created_to: message.createdTo,
    }));
}

export function retrievePayments(message: Request.RetrievePayments): Message {
    return retrieve('retrieve-payments', message);
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
function checkout(message: Request.CheckoutMessage): Body {
    return said({
        reference: message.reference,
        description: message.description,
        payment_provider_token: message.paymentProviderToken,
        currency: message.currency,
        success_url: message.successUrl,
        cancel_url: message.cancelUrl,
        requires_shipping: message.requiresShipping,
        items: message.items.map(item),
    });
}

/**
 * The fields an order and a subscription share, as a change sends them:
 * only what was given, `null` included.
 */
function checkoutChange(message: Request.UpdateCheckoutMessage): Body {
    return given({
        reference: message.reference,
        description: message.description,
        payment_provider_token: message.paymentProviderToken,
        currency: message.currency,
        success_url: message.successUrl,
        cancel_url: message.cancelUrl,
        requires_shipping: message.requiresShipping,
        items: message.items?.map(item),
    });
}

export function createOrder(message: Request.CreateOrder): Message {
    return post('create-order', said({
        order: checkout(message),
        customer: customer(message.customer),
    }));
}

export function retrieveOrders(message: Request.RetrieveOrders): Message {
    return retrieve('retrieve-orders', message);
}

export function updateOrder(message: Request.UpdateOrder): Message {
    return post(`update-order/${token(message.token)}`, said({
        token: message.token,
        order: checkoutChange(message),
        customer: customer(message.customer),
    }));
}

export function createPaymentLink(message: Request.CreatePaymentLink): Message {
    return post('create-payment-link', {
        payment_link: said({
            reference: message.reference,
            description: message.description,
            payment_provider_token: message.paymentProviderToken,
            currency: message.currency,
            expires_at: message.expiresAt,
            is_active: message.isActive,
            items: message.items.map(item),
        }),
    });
}

export function retrievePaymentLinks(message: Request.RetrievePaymentLinks): Message {
    return retrieve('retrieve-payment-links', message);
}

export function updatePaymentLink(message: Request.UpdatePaymentLink): Message {
    return post(`update-payment-link/${token(message.token)}`, {
        token: message.token,
        payment_link: given({
            reference: message.reference,
            description: message.description,
            payment_provider_token: message.paymentProviderToken,
            currency: message.currency,
            expires_at: message.expiresAt,
            is_active: message.isActive,
            items: message.items?.map(item),
        }),
    });
}

export function createSubscription(message: Request.CreateSubscription): Message {
    return post('create-subscription', said({
        subscription: said({
            ...checkout(message),
            period: message.period,
            renewal_limit: message.renewalLimit,
        }),
        customer: customer(message.customer),
    }));
}

export function retrieveSubscriptions(message: Request.RetrieveSubscriptions): Message {
    return retrieve('retrieve-subscriptions', message);
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

export function createSavedCard(message: Request.CreateSavedCard): Message {
    return post('create-saved-card', said({
        saved_card: message.paymentProviderToken === undefined ? undefined : { payment_provider_token: message.paymentProviderToken },
        customer: customer(message.customer),
        card: said({
            holder_name: message.card.holderName,
            number: message.card.number,
            security_code: message.card.securityCode === '' ? undefined : message.card.securityCode,
            expiry_month: message.card.expiryMonth,
            expiry_year: message.card.expiryYear,
        }),
    }));
}

export function retrieveSavedCards(message: Request.RetrieveSavedCards): Message {
    return retrieve('retrieve-saved-cards', { ...message, reference: message.customerReference }, 'customer_reference');
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
