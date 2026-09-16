import type { PolicyDocument } from "./types.ts";
import { refundPolicy } from "./docs/refund-policy.ts";
import { duplicateChargePolicy } from "./docs/duplicate-charge-policy.ts";
import { damagedItemPolicy } from "./docs/damaged-item-policy.ts";
import { shippingPolicy } from "./docs/shipping-policy.ts";
import { subscriptionCancellationPolicy } from "./docs/subscription-cancellation-policy.ts";
import { escalationPolicy } from "./docs/escalation-policy.ts";
import { serviceProblemCreditPolicy } from "./docs/service-problem-credit-policy.ts";
import { addressGuidance } from "./docs/address-guidance.ts";

export type { PolicyDocument };

/**
 * Policy knowledge base. Each document lives in its own file under
 * `src/mastra/knowledge/docs/` so it reads and edits like the standalone
 * Markdown file it represents.
 *
 * These are plain TS modules rather than `.md` files read from disk at
 * runtime on purpose: Mastra's bundler flattens `src/mastra` into
 * `.mastra/output`, so a directory a step reads with `fs` at runtime (e.g.
 * relative to `import.meta.url`) won't exist at the same relative path after
 * a build. Plain imports don't have that problem - the bundler resolves them
 * like any other module, in dev and in the built output alike.
 *
 * Add a new policy by creating a file in `docs/` and listing it here, then
 * re-run `POST /support/knowledge/reindex`.
 */
export const POLICY_DOCUMENTS: PolicyDocument[] = [
  refundPolicy,
  duplicateChargePolicy,
  damagedItemPolicy,
  shippingPolicy,
  subscriptionCancellationPolicy,
  escalationPolicy,
  serviceProblemCreditPolicy,
  addressGuidance,
];
