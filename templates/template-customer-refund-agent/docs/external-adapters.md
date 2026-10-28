# External adapters

External adapters are for a development Intercom workspace and Stripe test sandbox. They are opt-in; local mode remains the default.

## Configure staging

Set `APP_MODE=staging`. This mode selects Intercom and Stripe automatically, overriding any `SUPPORT_SOURCE` or `COMMERCE_SOURCE` values. Configure both integrations and set `DATABASE_URL` and `DEMO_DATABASE_URL`. Also set `OPENAI_API_KEY`, `LOCAL_AUTH_SIGNING_KEY` (at least 32 characters), and `DEMO_AUTH_BRIDGE_SIGNING_KEY` (the shared backend/client key), plus the Intercom development and Stripe test values in [environment variables](./env-variables.md#external-integrations), then verify them:

```bash
npm run check:env -- --profile=auto
```

Use a separate development workspace and test account only. `DATABASE_URL` is the backend store; `DEMO_DATABASE_URL` is the customer-demo store. The template accepts `TURSO_DATABASE_URL` only as a temporary legacy backend alias when `DATABASE_URL` is blank.

## Intercom

Set `INTERCOM_DEVELOPMENT_ENABLED=true`, `INTERCOM_TENANT_ID=local-demo`, `INTERCOM_APP_ID`, `INTERCOM_ACCESS_TOKEN`, `INTERCOM_CLIENT_SECRET`, and `INTERCOM_ADMIN_ID`. `INTERCOM_MESSENGER_JWT_SECRET` is required for the authenticated Messenger. Set `DEMO_PUBLIC_ORIGIN` to the HTTPS customer-demo origin, such as an ngrok URL for port 3000. Expose `POST /support/webhooks/intercom` over HTTPS and subscribe it to `conversation.user.created`, `conversation.user.replied`, and `conversation.admin.closed`.

The runtime needs conversation read/write and contact read permissions; ticket read/write and article read/list are optional for the configured features. The adapter checks the signed, current event before processing it. A close event records intent only; it cannot close a case while a workflow or financial operation is active.

## Stripe

Set `STRIPE_SANDBOX_ENABLED=true`, `STRIPE_TENANT_ID=local-demo`, `STRIPE_ACCOUNT_ID`, `STRIPE_RESTRICTED_API_KEY`, and `STRIPE_WEBHOOK_SECRET`. Use an `rk_test_` restricted key. The adapter needs read access to Account, Customers, Checkout Sessions, PaymentIntents, Subscriptions, Invoices, Invoice Payments, and Refunds; write access to Refunds, Subscriptions, and **Customers: Write**. Customers: Write creates the approved **customer balance transaction** for a next-invoice credit.

Subscribe `POST /support/webhooks/stripe` to `refund.created`, `refund.updated`, and `refund.failed`. The adapter rejects live resources and limits subscription writes to end-of-period cancellation.

## Create an external demo round

With both sandbox providers configured, run:

```bash
npm run demo:setup
```

It writes passwords and provider mappings to a private file outside the enclosing Git repository (the default is a `demo-private` sibling of that repository) and prints only that path. This also rejects a path that reaches the repository through a symlink. Start the three services with `npm run dev`, `npm run dev:client-demo`, and `npm run dev:support-demo`.
