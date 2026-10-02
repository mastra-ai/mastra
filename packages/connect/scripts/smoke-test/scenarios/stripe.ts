import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep Stripe scenario: customer + product + price + invoice + payment-intent +
 * setup-intent + checkout-session + refund + credit-note + subscription lifecycle.
 *
 * All work happens in the connected account's test mode. Payment intents are
 * never confirmed and no real money moves; token "tok_visa" is used for test
 * payment-method creation. Everything is tagged with the runId so operators can
 * audit stray resources.
 */
export const stripeScenario: Scenario = {
  integrationId: 'stripe',
  summary: 'customer + product + price + invoice + intent + subscription + refund CRUD (test mode)',
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
          ['stripe_list_checkout_sessions', { limit: 5 }],
          ['stripe_list_credit_notes', { limit: 5 }],
          ['stripe_list_invoice_items', { limit: 5 }],
          ['stripe_list_payment_methods', { limit: 5 }],
          ['stripe_list_refunds', { limit: 5 }],
          ['stripe_list_setup_intents', { limit: 5 }],
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

    // ---- product + price lifecycle ----
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

    if (productId && tools['stripe_get_product']) {
      try {
        await call('stripe_get_product', { id: productId });
        steps.push(makeStep('read product', 'stripe_get_product', 'pass'));
      } catch (error) {
        steps.push(makeStep('read product', 'stripe_get_product', 'fail', errorMessage(error)));
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

    if (priceId && tools['stripe_get_price']) {
      try {
        await call('stripe_get_price', { id: priceId });
        steps.push(makeStep('read price', 'stripe_get_price', 'pass'));
      } catch (error) {
        steps.push(makeStep('read price', 'stripe_get_price', 'fail', errorMessage(error)));
      }
    }

    if (priceId && tools['stripe_update_price']) {
      try {
        await call('stripe_update_price', { id: priceId, nickname: `${runId}-price` });
        steps.push(makeStep('update price', 'stripe_update_price', 'pass'));
      } catch (error) {
        steps.push(makeStep('update price', 'stripe_update_price', 'fail', errorMessage(error)));
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

    // ---- payment method ----
    let paymentMethodId: string | undefined;
    if (tools['stripe_create_payment_method']) {
      try {
        const pm = await call<{ id: string }>('stripe_create_payment_method', {
          type: 'card',
          card: { token: 'tok_visa' },
        });
        paymentMethodId = pm.id;
        steps.push(makeStep('create payment method', 'stripe_create_payment_method', 'pass', paymentMethodId));
      } catch (error) {
        steps.push(makeStep('create payment method', 'stripe_create_payment_method', 'fail', errorMessage(error)));
      }
    }

    if (paymentMethodId && tools['stripe_get_payment_method']) {
      try {
        await call('stripe_get_payment_method', { id: paymentMethodId });
        steps.push(makeStep('read payment method', 'stripe_get_payment_method', 'pass'));
      } catch (error) {
        steps.push(makeStep('read payment method', 'stripe_get_payment_method', 'fail', errorMessage(error)));
      }
    }

    // ---- payment intent lifecycle (manual capture so we can capture then cancel safely) ----
    let paymentIntentId: string | undefined;
    if (tools['stripe_create_payment_intent']) {
      try {
        const pi = await call<{ id: string }>('stripe_create_payment_intent', {
          amount: 500,
          currency: 'usd',
          customer: customerId,
          capture_method: 'manual',
          description: `${runId} smoke intent`,
        });
        paymentIntentId = pi.id;
        steps.push(makeStep('create payment intent', 'stripe_create_payment_intent', 'pass', paymentIntentId));
      } catch (error) {
        steps.push(makeStep('create payment intent', 'stripe_create_payment_intent', 'fail', errorMessage(error)));
      }
    }

    if (paymentIntentId && tools['stripe_get_payment_intent']) {
      try {
        await call('stripe_get_payment_intent', { id: paymentIntentId });
        steps.push(makeStep('read payment intent', 'stripe_get_payment_intent', 'pass'));
      } catch (error) {
        steps.push(makeStep('read payment intent', 'stripe_get_payment_intent', 'fail', errorMessage(error)));
      }
    }

    if (paymentIntentId && tools['stripe_update_payment_intent']) {
      try {
        await call('stripe_update_payment_intent', {
          id: paymentIntentId,
          description: `${runId} smoke intent (updated)`,
        });
        steps.push(makeStep('update payment intent', 'stripe_update_payment_intent', 'pass'));
      } catch (error) {
        steps.push(makeStep('update payment intent', 'stripe_update_payment_intent', 'fail', errorMessage(error)));
      }
    }

    // Capture requires a confirmed PI — probe exercises routing; expect error without confirm.
    if (paymentIntentId && tools['stripe_capture_payment_intent']) {
      steps.push(
        await probeTool(call, tools, 'capture payment intent', 'stripe_capture_payment_intent', {
          id: paymentIntentId,
        }),
      );
    }

    if (paymentIntentId && tools['stripe_cancel_payment_intent']) {
      try {
        await call('stripe_cancel_payment_intent', {
          id: paymentIntentId,
          cancellation_reason: 'abandoned',
        });
        steps.push(makeStep('cancel payment intent', 'stripe_cancel_payment_intent', 'pass'));
      } catch (error) {
        steps.push(makeStep('cancel payment intent', 'stripe_cancel_payment_intent', 'fail', errorMessage(error)));
      }
    }

    // delete_payment_intent probes with the cancelled PI (Stripe only allows deletion
    // under limited conditions; we accept both the delete and expected errors).
    if (paymentIntentId && tools['stripe_delete_payment_intent']) {
      steps.push(
        await probeTool(call, tools, 'delete payment intent', 'stripe_delete_payment_intent', {
          payment_intent_id: paymentIntentId,
        }),
      );
    }

    // ---- refund lifecycle (probe since there is no successful charge) ----
    if (paymentIntentId && tools['stripe_create_refund']) {
      steps.push(
        await probeTool(call, tools, 'create refund', 'stripe_create_refund', { payment_intent: paymentIntentId }),
      );
    }
    if (tools['stripe_get_refund']) {
      steps.push(await probeTool(call, tools, 'read refund', 'stripe_get_refund', { refund_id: `re_smoke_${runId}` }));
    }
    if (tools['stripe_update_refund']) {
      steps.push(
        await probeTool(call, tools, 'update refund', 'stripe_update_refund', {
          id: `re_smoke_${runId}`,
          metadata: { runId },
        }),
      );
    }

    // ---- setup intent lifecycle ----
    let setupIntentId: string | undefined;
    if (customerId && tools['stripe_create_setup_intent']) {
      try {
        const si = await call<{ id: string }>('stripe_create_setup_intent', {
          customer: customerId,
          description: `${runId} smoke setup intent`,
          usage: 'off_session',
        });
        setupIntentId = si.id;
        steps.push(makeStep('create setup intent', 'stripe_create_setup_intent', 'pass', setupIntentId));
      } catch (error) {
        steps.push(makeStep('create setup intent', 'stripe_create_setup_intent', 'fail', errorMessage(error)));
      }
    }

    if (setupIntentId && tools['stripe_get_setup_intent']) {
      try {
        await call('stripe_get_setup_intent', { id: setupIntentId });
        steps.push(makeStep('read setup intent', 'stripe_get_setup_intent', 'pass'));
      } catch (error) {
        steps.push(makeStep('read setup intent', 'stripe_get_setup_intent', 'fail', errorMessage(error)));
      }
    }

    if (setupIntentId && tools['stripe_update_setup_intent']) {
      try {
        await call('stripe_update_setup_intent', {
          id: setupIntentId,
          description: `${runId} smoke setup intent (updated)`,
        });
        steps.push(makeStep('update setup intent', 'stripe_update_setup_intent', 'pass'));
      } catch (error) {
        steps.push(makeStep('update setup intent', 'stripe_update_setup_intent', 'fail', errorMessage(error)));
      }
    }

    if (setupIntentId && tools['stripe_delete_setup_intent']) {
      try {
        await call('stripe_delete_setup_intent', { id: setupIntentId });
        steps.push(makeStep('delete setup intent', 'stripe_delete_setup_intent', 'pass'));
      } catch (error) {
        // Stripe cancels (not deletes) a setup intent; some tools return a status check.
        log.warn(`Could not delete smoke setup intent ${setupIntentId}`, errorMessage(error));
        steps.push(makeStep('delete setup intent', 'stripe_delete_setup_intent', 'fail', errorMessage(error)));
      }
    }

    // ---- checkout session ----
    let checkoutSessionId: string | undefined;
    if (priceId && tools['stripe_create_checkout_session']) {
      try {
        const session = await call<{ id: string }>('stripe_create_checkout_session', {
          mode: 'payment',
          customer: customerId,
          success_url: 'https://example.com/success',
          cancel_url: 'https://example.com/cancel',
          line_items: [{ price: priceId, quantity: 1 }],
        });
        checkoutSessionId = session.id;
        steps.push(makeStep('create checkout session', 'stripe_create_checkout_session', 'pass', checkoutSessionId));
      } catch (error) {
        steps.push(makeStep('create checkout session', 'stripe_create_checkout_session', 'fail', errorMessage(error)));
      }
    }

    if (checkoutSessionId && tools['stripe_get_checkout_session']) {
      try {
        await call('stripe_get_checkout_session', { id: checkoutSessionId });
        steps.push(makeStep('read checkout session', 'stripe_get_checkout_session', 'pass'));
      } catch (error) {
        steps.push(makeStep('read checkout session', 'stripe_get_checkout_session', 'fail', errorMessage(error)));
      }
    }

    // ---- invoice item + invoice lifecycle ----
    let invoiceItemId: string | undefined;
    if (priceId && customerId && tools['stripe_create_invoice_item']) {
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

    if (invoiceItemId && tools['stripe_get_invoice_item']) {
      try {
        await call('stripe_get_invoice_item', { invoice_item_id: invoiceItemId });
        steps.push(makeStep('read invoice item', 'stripe_get_invoice_item', 'pass'));
      } catch (error) {
        steps.push(makeStep('read invoice item', 'stripe_get_invoice_item', 'fail', errorMessage(error)));
      }
    }

    if (invoiceItemId && tools['stripe_update_invoice_item']) {
      try {
        await call('stripe_update_invoice_item', {
          invoice_item_id: invoiceItemId,
          description: `${runId} smoke invoice item (updated)`,
        });
        steps.push(makeStep('update invoice item', 'stripe_update_invoice_item', 'pass'));
      } catch (error) {
        steps.push(makeStep('update invoice item', 'stripe_update_invoice_item', 'fail', errorMessage(error)));
      }
    }

    let invoiceId: string | undefined;
    if (customerId && tools['stripe_create_invoice']) {
      try {
        const invoice = await call<{ id: string }>('stripe_create_invoice', {
          customer: customerId,
          collection_method: 'send_invoice',
          days_until_due: 30,
          description: `${runId} smoke invoice`,
        });
        invoiceId = invoice.id;
        steps.push(makeStep('create invoice', 'stripe_create_invoice', 'pass', invoiceId));
      } catch (error) {
        steps.push(makeStep('create invoice', 'stripe_create_invoice', 'fail', errorMessage(error)));
      }
    }

    if (invoiceId && tools['stripe_get_invoice']) {
      try {
        await call('stripe_get_invoice', { id: invoiceId });
        steps.push(makeStep('read invoice', 'stripe_get_invoice', 'pass'));
      } catch (error) {
        steps.push(makeStep('read invoice', 'stripe_get_invoice', 'fail', errorMessage(error)));
      }
    }

    if (invoiceId && tools['stripe_update_invoice']) {
      try {
        await call('stripe_update_invoice', { id: invoiceId, description: `${runId} smoke invoice (updated)` });
        steps.push(makeStep('update invoice', 'stripe_update_invoice', 'pass'));
      } catch (error) {
        steps.push(makeStep('update invoice', 'stripe_update_invoice', 'fail', errorMessage(error)));
      }
    }

    let finalizedInvoiceId: string | undefined;
    if (invoiceId && tools['stripe_finalize_invoice']) {
      try {
        const finalized = await call<{ id: string }>('stripe_finalize_invoice', {
          invoice_id: invoiceId,
          auto_advance: false,
        });
        finalizedInvoiceId = finalized.id ?? invoiceId;
        steps.push(makeStep('finalize invoice', 'stripe_finalize_invoice', 'pass', finalizedInvoiceId));
      } catch (error) {
        steps.push(makeStep('finalize invoice', 'stripe_finalize_invoice', 'fail', errorMessage(error)));
      }
    }

    // ---- credit note (requires finalized invoice; probe if finalize didn't fire) ----
    if (finalizedInvoiceId && tools['stripe_create_credit_note']) {
      let creditNoteId: string | undefined;
      try {
        const note = await call<{ id: string }>('stripe_create_credit_note', {
          invoice: finalizedInvoiceId,
          amount: 100,
          reason: 'order_change',
        });
        creditNoteId = note.id;
        steps.push(makeStep('create credit note', 'stripe_create_credit_note', 'pass', creditNoteId));
      } catch (error) {
        steps.push(makeStep('create credit note', 'stripe_create_credit_note', 'fail', errorMessage(error)));
      }
      if (creditNoteId && tools['stripe_get_credit_note']) {
        try {
          await call('stripe_get_credit_note', { credit_note_id: creditNoteId });
          steps.push(makeStep('read credit note', 'stripe_get_credit_note', 'pass'));
        } catch (error) {
          steps.push(makeStep('read credit note', 'stripe_get_credit_note', 'fail', errorMessage(error)));
        }
      }
      if (creditNoteId && tools['stripe_void_credit_note']) {
        try {
          await call('stripe_void_credit_note', { credit_note_id: creditNoteId });
          steps.push(makeStep('void credit note', 'stripe_void_credit_note', 'pass'));
        } catch (error) {
          steps.push(makeStep('void credit note', 'stripe_void_credit_note', 'fail', errorMessage(error)));
        }
      }
    } else {
      // probe credit-note tools so routing is still exercised when finalize fails
      if (tools['stripe_create_credit_note']) {
        steps.push(
          await probeTool(call, tools, 'create credit note', 'stripe_create_credit_note', {
            invoice: `in_smoke_${runId}`,
            amount: 100,
            reason: 'order_change',
          }),
        );
      }
      if (tools['stripe_get_credit_note']) {
        steps.push(
          await probeTool(call, tools, 'read credit note', 'stripe_get_credit_note', {
            credit_note_id: `cn_smoke_${runId}`,
          }),
        );
      }
      if (tools['stripe_void_credit_note']) {
        steps.push(
          await probeTool(call, tools, 'void credit note', 'stripe_void_credit_note', {
            credit_note_id: `cn_smoke_${runId}`,
          }),
        );
      }
    }

    if (finalizedInvoiceId && tools['stripe_void_invoice']) {
      try {
        await call('stripe_void_invoice', { invoice_id: finalizedInvoiceId });
        steps.push(makeStep('void invoice', 'stripe_void_invoice', 'pass'));
      } catch (error) {
        steps.push(makeStep('void invoice', 'stripe_void_invoice', 'fail', errorMessage(error)));
      }
    } else if (tools['stripe_void_invoice']) {
      steps.push(
        await probeTool(call, tools, 'void invoice', 'stripe_void_invoice', {
          invoice_id: `in_smoke_${runId}`,
        }),
      );
    }

    // delete_invoice only works on draft invoices. If finalize fired, probe instead.
    if (invoiceId && !finalizedInvoiceId && tools['stripe_delete_invoice']) {
      try {
        await call('stripe_delete_invoice', { id: invoiceId });
        steps.push(makeStep('delete invoice', 'stripe_delete_invoice', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete invoice', 'stripe_delete_invoice', 'fail', errorMessage(error)));
      }
    } else if (tools['stripe_delete_invoice']) {
      steps.push(await probeTool(call, tools, 'delete invoice', 'stripe_delete_invoice', { id: `in_smoke_${runId}` }));
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

    // ---- subscription (probe since no confirmed payment method on customer) ----
    if (customerId && priceId && tools['stripe_create_subscription']) {
      let subscriptionId: string | undefined;
      try {
        const sub = await call<{ id: string }>('stripe_create_subscription', {
          customer: customerId,
          items: [{ price: priceId, quantity: 1 }],
          collection_method: 'send_invoice',
          cancel_at_period_end: true,
        });
        subscriptionId = sub.id;
        steps.push(makeStep('create subscription', 'stripe_create_subscription', 'pass', subscriptionId));
      } catch (error) {
        steps.push(makeStep('create subscription', 'stripe_create_subscription', 'fail', errorMessage(error)));
      }
      if (subscriptionId && tools['stripe_get_subscription']) {
        try {
          await call('stripe_get_subscription', { id: subscriptionId });
          steps.push(makeStep('read subscription', 'stripe_get_subscription', 'pass'));
        } catch (error) {
          steps.push(makeStep('read subscription', 'stripe_get_subscription', 'fail', errorMessage(error)));
        }
      }
      if (subscriptionId && tools['stripe_update_subscription']) {
        try {
          await call('stripe_update_subscription', {
            id: subscriptionId,
            description: `${runId} smoke subscription (updated)`,
          });
          steps.push(makeStep('update subscription', 'stripe_update_subscription', 'pass'));
        } catch (error) {
          steps.push(makeStep('update subscription', 'stripe_update_subscription', 'fail', errorMessage(error)));
        }
      }
      if (subscriptionId && tools['stripe_delete_subscription']) {
        try {
          await call('stripe_delete_subscription', { id: subscriptionId });
          steps.push(makeStep('delete subscription', 'stripe_delete_subscription', 'pass'));
        } catch (error) {
          log.error(`Failed to delete smoke subscription ${subscriptionId}`, errorMessage(error));
          steps.push(makeStep('delete subscription', 'stripe_delete_subscription', 'fail', errorMessage(error)));
        }
      }
    }

    // ---- price delete (archive) ----
    if (priceId && tools['stripe_delete_price']) {
      try {
        await call('stripe_delete_price', { id: priceId });
        steps.push(makeStep('delete price', 'stripe_delete_price', 'pass'));
      } catch (error) {
        // Prices with active subscriptions can't be archived — flag as known.
        log.warn(`Could not archive smoke price ${priceId}`, errorMessage(error));
        steps.push(makeStep('delete price', 'stripe_delete_price', 'fail', errorMessage(error)));
      }
    }

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
