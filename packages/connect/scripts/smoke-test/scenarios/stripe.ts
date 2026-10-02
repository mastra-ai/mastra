import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Stripe scenario: customer + product + price + invoice-item lifecycle.
 * Everything is created in the connected account's test mode and is cleaned
 * up on exit. The scenario never calls any charge-money endpoints — payment
 * intents are not confirmed.
 */
export const stripeScenario: Scenario = {
  integrationId: 'stripe',
  summary: 'customer + product + price + invoice CRUD (test mode)',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'stripe_create_customer',
      'stripe_get_customer',
      'stripe_update_customer',
      'stripe_delete_customer',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['stripe_get_account_info', {}],
          ['stripe_retrieve_balance', {}],
          ['stripe_list_customers', { limit: 5 }],
          ['stripe_list_products', { limit: 5 }],
          ['stripe_list_prices', { limit: 5 }],
          ['stripe_list_invoices', { limit: 5 }],
          ['stripe_list_payment_intents', { limit: 5 }],
          ['stripe_list_subscriptions', { limit: 5 }],
          ['stripe_list_coupons', { limit: 5 }],
          ['stripe_list_disputes', { limit: 5 }],
        ],
        tools,
      )),
    );

    let customerId: string | undefined;
    try {
      const customer = await call<{ id: string }>('stripe_create_customer', {
        email: `smoke+${runId}@mastra-smoke.invalid`,
        name: `${runId} smoke customer`,
      });
      customerId = customer.id;
      steps.push(makeStep('create customer', 'stripe_create_customer', 'pass', customerId));
    } catch (error) {
      steps.push(makeStep('create customer', 'stripe_create_customer', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      await call('stripe_get_customer', { customerId });
      steps.push(makeStep('read customer', 'stripe_get_customer', 'pass'));
    } catch (error) {
      steps.push(makeStep('read customer', 'stripe_get_customer', 'fail', errorMessage(error)));
    }

    try {
      await call('stripe_update_customer', {
        customerId,
        description: `${runId} smoke customer (updated)`,
      });
      steps.push(makeStep('update customer', 'stripe_update_customer', 'pass'));
    } catch (error) {
      steps.push(makeStep('update customer', 'stripe_update_customer', 'fail', errorMessage(error)));
    }

    let productId: string | undefined;
    if (tools['stripe_create_product']) {
      try {
        const product = await call<{ id: string }>('stripe_create_product', {
          name: `${runId} smoke product`,
        });
        productId = product.id;
        steps.push(makeStep('create product', 'stripe_create_product', 'pass', productId));
      } catch (error) {
        steps.push(makeStep('create product', 'stripe_create_product', 'fail', errorMessage(error)));
      }
    }

    let priceId: string | undefined;
    if (productId && tools['stripe_create_price']) {
      try {
        const price = await call<{ id: string }>('stripe_create_price', {
          product: productId,
          currency: 'usd',
          unit_amount: 100,
        });
        priceId = price.id;
        steps.push(makeStep('create price', 'stripe_create_price', 'pass', priceId));
      } catch (error) {
        steps.push(makeStep('create price', 'stripe_create_price', 'fail', errorMessage(error)));
      }
    }

    if (productId && tools['stripe_update_product']) {
      try {
        await call('stripe_update_product', { productId, description: 'smoke updated' });
        steps.push(makeStep('update product', 'stripe_update_product', 'pass'));
      } catch (error) {
        steps.push(makeStep('update product', 'stripe_update_product', 'fail', errorMessage(error)));
      }
    }

    let invoiceItemId: string | undefined;
    if (priceId && tools['stripe_create_invoice_item']) {
      try {
        const item = await call<{ id: string }>('stripe_create_invoice_item', {
          customer: customerId,
          price: priceId,
        });
        invoiceItemId = item.id;
        steps.push(makeStep('create invoice item', 'stripe_create_invoice_item', 'pass', invoiceItemId));
      } catch (error) {
        steps.push(makeStep('create invoice item', 'stripe_create_invoice_item', 'fail', errorMessage(error)));
      }
    }

    if (invoiceItemId && tools['stripe_delete_invoice_item']) {
      try {
        await call('stripe_delete_invoice_item', { invoiceItemId });
        steps.push(makeStep('delete invoice item', 'stripe_delete_invoice_item', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke invoice item ${invoiceItemId}`, errorMessage(error));
        steps.push(makeStep('delete invoice item', 'stripe_delete_invoice_item', 'fail', errorMessage(error)));
      }
    }

    // Prices can't be deleted in Stripe, only deactivated. We leave the price
    // tagged with the runId so operators can filter and archive if they want.

    if (productId && tools['stripe_delete_product']) {
      try {
        await call('stripe_delete_product', { productId });
        steps.push(makeStep('delete product', 'stripe_delete_product', 'pass'));
      } catch (error) {
        // Products with active prices can't be deleted — flag as a known issue.
        log.warn(`Could not delete smoke product ${productId} (likely has active prices).`, errorMessage(error));
        steps.push(makeStep('delete product', 'stripe_delete_product', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('stripe_delete_customer', { customerId });
      steps.push(makeStep('delete customer', 'stripe_delete_customer', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke customer ${customerId}`, errorMessage(error));
      steps.push(makeStep('delete customer', 'stripe_delete_customer', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
