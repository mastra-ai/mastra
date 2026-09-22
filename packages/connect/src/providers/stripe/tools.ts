// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { cancelPaymentIntentTool } from './tools/cancel-payment-intent.js';
import { capturePaymentIntentTool } from './tools/capture-payment-intent.js';
import { createCheckoutSessionTool } from './tools/create-checkout-session.js';
import { createCreditNoteTool } from './tools/create-credit-note.js';
import { createCustomerTool } from './tools/create-customer.js';
import { createInvoiceItemTool } from './tools/create-invoice-item.js';
import { createInvoiceTool } from './tools/create-invoice.js';
import { createPaymentIntentTool } from './tools/create-payment-intent.js';
import { createPaymentMethodTool } from './tools/create-payment-method.js';
import { createPriceTool } from './tools/create-price.js';
import { createProductTool } from './tools/create-product.js';
import { createRefundTool } from './tools/create-refund.js';
import { createSetupIntentTool } from './tools/create-setup-intent.js';
import { createSubscriptionTool } from './tools/create-subscription.js';
import { deleteCustomerTool } from './tools/delete-customer.js';
import { deleteInvoiceItemTool } from './tools/delete-invoice-item.js';
import { deleteInvoiceTool } from './tools/delete-invoice.js';
import { deletePaymentIntentTool } from './tools/delete-payment-intent.js';
import { deletePriceTool } from './tools/delete-price.js';
import { deleteProductTool } from './tools/delete-product.js';
import { deleteSetupIntentTool } from './tools/delete-setup-intent.js';
import { deleteSubscriptionTool } from './tools/delete-subscription.js';
import { finalizeInvoiceTool } from './tools/finalize-invoice.js';
import { getAccountInfoTool } from './tools/get-account-info.js';
import { getCheckoutSessionTool } from './tools/get-checkout-session.js';
import { getCreditNoteTool } from './tools/get-credit-note.js';
import { getCustomerTool } from './tools/get-customer.js';
import { getInvoiceItemTool } from './tools/get-invoice-item.js';
import { getInvoiceTool } from './tools/get-invoice.js';
import { getPaymentIntentTool } from './tools/get-payment-intent.js';
import { getPaymentMethodTool } from './tools/get-payment-method.js';
import { getPriceTool } from './tools/get-price.js';
import { getProductTool } from './tools/get-product.js';
import { getRefundTool } from './tools/get-refund.js';
import { getSetupIntentTool } from './tools/get-setup-intent.js';
import { getSubscriptionTool } from './tools/get-subscription.js';
import { listCheckoutSessionsTool } from './tools/list-checkout-sessions.js';
import { listCouponsTool } from './tools/list-coupons.js';
import { listCreditNotesTool } from './tools/list-credit-notes.js';
import { listCustomersTool } from './tools/list-customers.js';
import { listDisputesTool } from './tools/list-disputes.js';
import { listInvoiceItemsTool } from './tools/list-invoice-items.js';
import { listInvoicesTool } from './tools/list-invoices.js';
import { listPaymentIntentsTool } from './tools/list-payment-intents.js';
import { listPaymentMethodsTool } from './tools/list-payment-methods.js';
import { listPricesTool } from './tools/list-prices.js';
import { listProductsTool } from './tools/list-products.js';
import { listRefundsTool } from './tools/list-refunds.js';
import { listSetupIntentsTool } from './tools/list-setup-intents.js';
import { listSubscriptionsTool } from './tools/list-subscriptions.js';
import { retrieveBalanceTool } from './tools/retrieve-balance.js';
import { updateCustomerTool } from './tools/update-customer.js';
import { updateInvoiceItemTool } from './tools/update-invoice-item.js';
import { updateInvoiceTool } from './tools/update-invoice.js';
import { updatePaymentIntentTool } from './tools/update-payment-intent.js';
import { updatePriceTool } from './tools/update-price.js';
import { updateProductTool } from './tools/update-product.js';
import { updateRefundTool } from './tools/update-refund.js';
import { updateSetupIntentTool } from './tools/update-setup-intent.js';
import { updateSubscriptionTool } from './tools/update-subscription.js';
import { voidCreditNoteTool } from './tools/void-credit-note.js';
import { voidInvoiceTool } from './tools/void-invoice.js';

export function createStripeTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    stripe_cancel_payment_intent: cancelPaymentIntentTool(platformProxy),
    stripe_capture_payment_intent: capturePaymentIntentTool(platformProxy),
    stripe_create_checkout_session: createCheckoutSessionTool(platformProxy),
    stripe_create_credit_note: createCreditNoteTool(platformProxy),
    stripe_create_customer: createCustomerTool(platformProxy),
    stripe_create_invoice_item: createInvoiceItemTool(platformProxy),
    stripe_create_invoice: createInvoiceTool(platformProxy),
    stripe_create_payment_intent: createPaymentIntentTool(platformProxy),
    stripe_create_payment_method: createPaymentMethodTool(platformProxy),
    stripe_create_price: createPriceTool(platformProxy),
    stripe_create_product: createProductTool(platformProxy),
    stripe_create_refund: createRefundTool(platformProxy),
    stripe_create_setup_intent: createSetupIntentTool(platformProxy),
    stripe_create_subscription: createSubscriptionTool(platformProxy),
    stripe_delete_customer: deleteCustomerTool(platformProxy),
    stripe_delete_invoice_item: deleteInvoiceItemTool(platformProxy),
    stripe_delete_invoice: deleteInvoiceTool(platformProxy),
    stripe_delete_payment_intent: deletePaymentIntentTool(platformProxy),
    stripe_delete_price: deletePriceTool(platformProxy),
    stripe_delete_product: deleteProductTool(platformProxy),
    stripe_delete_setup_intent: deleteSetupIntentTool(platformProxy),
    stripe_delete_subscription: deleteSubscriptionTool(platformProxy),
    stripe_finalize_invoice: finalizeInvoiceTool(platformProxy),
    stripe_get_account_info: getAccountInfoTool(platformProxy),
    stripe_get_checkout_session: getCheckoutSessionTool(platformProxy),
    stripe_get_credit_note: getCreditNoteTool(platformProxy),
    stripe_get_customer: getCustomerTool(platformProxy),
    stripe_get_invoice_item: getInvoiceItemTool(platformProxy),
    stripe_get_invoice: getInvoiceTool(platformProxy),
    stripe_get_payment_intent: getPaymentIntentTool(platformProxy),
    stripe_get_payment_method: getPaymentMethodTool(platformProxy),
    stripe_get_price: getPriceTool(platformProxy),
    stripe_get_product: getProductTool(platformProxy),
    stripe_get_refund: getRefundTool(platformProxy),
    stripe_get_setup_intent: getSetupIntentTool(platformProxy),
    stripe_get_subscription: getSubscriptionTool(platformProxy),
    stripe_list_checkout_sessions: listCheckoutSessionsTool(platformProxy),
    stripe_list_coupons: listCouponsTool(platformProxy),
    stripe_list_credit_notes: listCreditNotesTool(platformProxy),
    stripe_list_customers: listCustomersTool(platformProxy),
    stripe_list_disputes: listDisputesTool(platformProxy),
    stripe_list_invoice_items: listInvoiceItemsTool(platformProxy),
    stripe_list_invoices: listInvoicesTool(platformProxy),
    stripe_list_payment_intents: listPaymentIntentsTool(platformProxy),
    stripe_list_payment_methods: listPaymentMethodsTool(platformProxy),
    stripe_list_prices: listPricesTool(platformProxy),
    stripe_list_products: listProductsTool(platformProxy),
    stripe_list_refunds: listRefundsTool(platformProxy),
    stripe_list_setup_intents: listSetupIntentsTool(platformProxy),
    stripe_list_subscriptions: listSubscriptionsTool(platformProxy),
    stripe_retrieve_balance: retrieveBalanceTool(platformProxy),
    stripe_update_customer: updateCustomerTool(platformProxy),
    stripe_update_invoice_item: updateInvoiceItemTool(platformProxy),
    stripe_update_invoice: updateInvoiceTool(platformProxy),
    stripe_update_payment_intent: updatePaymentIntentTool(platformProxy),
    stripe_update_price: updatePriceTool(platformProxy),
    stripe_update_product: updateProductTool(platformProxy),
    stripe_update_refund: updateRefundTool(platformProxy),
    stripe_update_setup_intent: updateSetupIntentTool(platformProxy),
    stripe_update_subscription: updateSubscriptionTool(platformProxy),
    stripe_void_credit_note: voidCreditNoteTool(platformProxy),
    stripe_void_invoice: voidInvoiceTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
