// Server-safe: only depends on `@mastra/core` + zod, never the `@livekit/agents` runtime — so it
// can be added to agents defined in server/shared code and re-exported from the root entry
// (`index.ts`). `index.test.ts` enforces that boundary.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/** A consent decision captured from the caller during a call. */
export interface ConsentGrant {
  /**
   * The consent item, matching a key in the worker's `configuration.requireConsent` (e.g.
   * `'summaryStorage'`).
   */
  item: string;
  /** `true` if the caller agreed, `false` if they declined. */
  granted: boolean;
  /** The caller the grant belongs to (the memory `resource`), when the call is memory-scoped. */
  resourceId?: string;
  /** The call thread the grant was captured on, when the call is memory-scoped. */
  threadId?: string;
}

export interface ConsentToolOptions {
  /**
   * Persist the caller's decision to YOUR system of record (database, CRM, consent ledger). Called
   * each time the caller answers a consent question — keep it quick, it runs inside the turn. This
   * tool owns extracting the caller's identity from the tool execution context; you own storage, so
   * consent lives in a durable, compliant place rather than an opaque plugin store. Read those
   * grants back at `onCallEnd` (or before any consent-gated step) to enforce the requirement.
   */
  onGrant: (grant: ConsentGrant) => void | Promise<void>;
  /** Tool id the agent calls. Defaults to `'recordConsent'`. */
  id?: string;
  /** Override the description the model sees when deciding to call the tool. */
  description?: string;
  /** Restrict the accepted consent items to this set (becomes an enum). Defaults to any string. */
  items?: readonly string[];
}

const DEFAULT_DESCRIPTION =
  "Record the caller's consent decision for a data-processing item (for example, storing a summary " +
  'of the call). Call this as soon as the caller answers a consent question: granted = true if they ' +
  'agree, false if they decline. Do not proceed with an activity that requires consent until you ' +
  'have recorded the caller granting it.';

/**
 * Builds a Mastra tool that captures the caller's consent decisions at runtime — the companion to
 * the worker's `configuration.requireConsent`, which only DECLARES which consents a call needs. Add
 * it to the agent that answers the call; on each call the tool reads the caller's `resourceId` /
 * `threadId` from its execution context and hands the decision to your `onGrant` store. The runtime
 * grants live only where `onGrant` put them: enforce consent by reading them back from your own
 * store — at `onCallEnd` or before any consent-gated action — cross-checking against the declared
 * requirements in `VoiceCallEndArgs.configuration.requireConsent` (the configuration carries the
 * policy, never the grants).
 *
 * ```ts
 * // agent tools
 * recordConsent: createConsentTool({
 *   items: ['summaryStorage'],
 *   onGrant: async ({ item, granted, resourceId }) => {
 *     if (resourceId) await db.saveConsent(resourceId, item, granted);
 *   },
 * }),
 * ```
 */
export function createConsentTool(options: ConsentToolOptions) {
  const items = options.items;
  const itemSchema = items && items.length > 0 ? z.enum([...items] as [string, ...string[]]) : z.string();
  return createTool({
    id: options.id ?? 'recordConsent',
    description: options.description ?? DEFAULT_DESCRIPTION,
    inputSchema: z.object({
      item: itemSchema.describe(
        "The consent item the caller is answering for (matches the deployment's required consents).",
      ),
      granted: z.boolean().describe('True if the caller agreed, false if they declined.'),
    }),
    execute: async ({ item, granted }, { agent }) => {
      await options.onGrant({ item, granted, resourceId: agent?.resourceId, threadId: agent?.threadId });
      return { recorded: true as const, item, granted };
    },
  });
}
