# Policies and actions

A policy tells support what it may recommend. It does not create an action, grant permission, or change customer data.

## Configure local policy documents

1. Add a `PolicyDocument` module under `src/mastra/knowledge/docs/` with `title`, stable `source`, and `text`.
2. Register it in `src/mastra/knowledge/policy-docs.ts` through `POLICY_DOCUMENTS`.
3. In the support UI, sign in as `admin@local.test` / `local-admin` and choose **Reindex knowledge**. An authenticated admin can also call `POST /support/knowledge/reindex`.

Editing a source document does not replace an already-published index; reindex after each change. Existing cases retain their knowledge binding.

```ts
import type { PolicyDocument } from '../types.ts';

export const billingPolicy: PolicyDocument = {
  title: 'Billing policy',
  source: 'billing-policy',
  text: 'Eligible purchases may be reviewed for a refund.',
};
```

## Optional Intercom Articles

Published Intercom Articles are already supported as a policy source:

1. Configure the [Intercom development integration](./external-adapters.md#configure-staging) and give its token article read/list permission.
2. Add `INTERCOM_KNOWLEDGE_ENABLED=true` to `.env` and restart the backend.
3. Create or update an Article in Intercom and publish it. Draft articles are excluded.
4. Sign in as an admin and choose **Reindex knowledge**, or call the authenticated `POST /support/knowledge/reindex` endpoint.

Reindex after publishing or changing an Article; there is no background Articles sync. When enabled, the Intercom integration selects Articles as its knowledge source instead of the local policy documents. Existing cases retain their knowledge binding. Local documents are not uploaded to Intercom.

`APP_MODE=local` continues to use local documents. See the [environment reference](./env-variables.md#intercom) for the optional Articles setting.

## Supported actions

The template supports refunds, a credit for the next invoice, and end-of-period subscription cancellation. Every financial proposal still requires authenticated human approval. A policy for a coupon, pause, or another offer does not implement that action.
