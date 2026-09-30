import type * as Request from './request.js';

/**
 * A request body, in the snake_case the gateway speaks.
 */
export type Body = Record<string, unknown>;

/**
 * An endpoint under the team's gateway and the body sent to it. The body is
 * built with the client's channel handed in, because a message that speaks
 * for a channel puts it where its own endpoint expects it; one that does
 * not, such as a refund, simply never reads it.
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

function card(card: Request.Card): Body {
    return {
        holder_name: card.holderName,
        number: card.number,
        security_code: card.securityCode,
        expiry_month: card.expiryMonth,
        expiry_year: card.expiryYear,
        should_save: card.shouldSave ?? false,
    };
}

function customer(customer: Request.Customer): Body {
    const body: Body = {
        channel_reference: customer.channelReference,
        firstname: customer.firstname,
        lastname: customer.lastname,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        district: customer.district,
        province: customer.province,
        country: customer.country,
    };

    if (customer.tax !== undefined) {
        body.tax = {
            company_title: customer.tax.companyTitle,
            tax_number: customer.tax.taxNumber,
            tax_office: customer.tax.taxOffice,
        };
    }

    return body;
}

function namedCustomer(customer: Request.NamedCustomer, channelToken: string): Body {
    return {
        channel_token: channelToken,
        channel_reference: customer.channelReference,
    };
}

function payment(payment: Request.Payment, channelToken: string): Body {
    if ((payment.card === undefined) === (payment.savedCardToken === undefined)) {
        throw new TypeError('Bir ödeme ya bir kartla ya da kayıtlı bir kartla yapılır; ikisi birden ya da hiçbiri verilemez.');
    }

    const body: Body = {
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
    };

    return payment.card === undefined ? body : { ...body, card: card(payment.card) };
}

export function securePayment(message: Request.SecurePayment, channelToken: string): Message {
    const body = payment(message, channelToken);
    (body.transaction as Body).callback_url = message.callbackUrl;

    return { path: 'secure-payment', body };
}

export function regularPayment(message: Request.RegularPayment, channelToken: string): Message {
    return { path: 'regular-payment', body: payment(message, channelToken) };
}

export function orderPayment(message: Request.OrderPayment, channelToken: string): Message {
    return {
        path: 'order-payment',
        body: {
            order: said({
                channel_token: message.channelToken ?? channelToken,
                channel_reference: message.channelReference,
                payment_provider_token: message.paymentProviderToken,
                description: message.description,
                currency: message.currency,
                success_url: message.successUrl,
                cancel_url: message.cancelUrl,
                items: message.items.map((item) => said({
                    channel_reference: item.channelReference,
                    name: item.name,
                    image: item.image,
                    quantity: item.quantity,
                    unit_amount: item.unitAmount,
                    tax_rate: item.taxRate,
                })),
            }),
            customer: customer(message.customer),
        },
    };
}

export function subscriptionPayment(message: Request.SubscriptionPayment, channelToken: string): Message {
    return {
        path: 'subscription-payment',
        body: {
            subscription: said({
                channel_token: message.channelToken ?? channelToken,
                channel_reference: message.channelReference,
                payment_provider_token: message.paymentProviderToken,
                items: message.items.map((item) => said({
                    channel_reference: item.channelReference,
                    quantity: item.quantity,
                    unit_amount: item.unitAmount,
                    image: item.image,
                })),
                success_url: message.successUrl,
                cancel_url: message.cancelUrl,
                webhook_url: message.webhookUrl,
            }),
            customer: customer(message.customer),
        },
    };
}

export function refundPayment(message: Request.RefundPayment): Message {
    return {
        path: 'refund-payment',
        body: said({
            transaction: { token: message.transactionToken },
            amount: message.amount,
        }),
    };
}

export function cancelPayment(message: Request.CancelPayment): Message {
    return { path: 'cancel-payment', body: { transaction: { token: message.transactionToken } } };
}

export function retrievePayment(message: Request.RetrievePayment): Message {
    return { path: 'retrieve-payment', body: { transaction: { token: message.transactionToken } } };
}

export function retrieveBin(message: Request.RetrieveBin): Message {
    return {
        path: 'retrieve-bin',
        body: {
            transaction: said({
                payment_provider_token: message.paymentProviderToken,
                amount: message.amount,
                currency: message.currency,
            }),
            card: { bin: message.bin },
        },
    };
}

export function saveProduct(message: Request.SaveProduct, channelToken: string): Message {
    return {
        path: 'save-product',
        body: {
            product: said({
                channel_token: message.channelToken ?? channelToken,
                channel_reference: message.channelReference,
                name: message.name,
                image: message.image,
                type: message.type,
                amount: message.amount,
                currency: message.currency,
                tax_rate: message.taxRate,
                period: message.period,
                is_active: message.isActive,
            }),
        },
    };
}

export function retrieveSubscription(message: Request.RetrieveSubscription): Message {
    return { path: 'retrieve-subscription', body: { subscription: { token: message.subscriptionToken } } };
}

export function cancelSubscription(message: Request.CancelSubscription): Message {
    return { path: 'cancel-subscription', body: { subscription: { token: message.subscriptionToken } } };
}

export function saveCard(message: Request.SaveCard, channelToken: string): Message {
    return {
        path: 'save-card',
        body: {
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
        },
    };
}

export function savedCards(message: Request.SavedCards, channelToken: string): Message {
    return {
        path: 'saved-cards',
        body: { customer: namedCustomer(message.customer, message.channelToken ?? channelToken) },
    };
}

function savedCard(path: string, message: Request.SavedCardMessage, channelToken: string): Message {
    return {
        path,
        body: {
            customer: namedCustomer(message.customer, message.channelToken ?? channelToken),
            saved_card: { token: message.savedCardToken },
        },
    };
}

export function defaultSavedCard(message: Request.DefaultSavedCard, channelToken: string): Message {
    return savedCard('default-saved-card', message, channelToken);
}

export function deleteSavedCard(message: Request.DeleteSavedCard, channelToken: string): Message {
    return savedCard('delete-saved-card', message, channelToken);
}
