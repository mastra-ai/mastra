/**
 * The support case file — working memory as a typed record.
 *
 * Working memory is the agent's scratchpad: a small block of state that
 * survives between turns and is handed back to the model on every request.
 * It comes in two shapes and the choice matters more than it looks:
 *
 *   template  a Markdown blob. The agent rewrites the whole thing on every
 *             update (*replace* semantics), and the browser renders it as
 *             formatted Markdown. Good for a free-form profile.
 *
 *   schema    a JSON object matching a Standard Schema — Zod here (*merge*
 *   (this)    semantics: the agent sends only the fields that changed). The
 *             browser renders it as JSON in a monospace block, because Studio
 *             switches on whether the stored value starts with `{`.
 *
 * A schema is the right call for this workshop for one reason: the whole
 * example is about *measuring* things, and a typed record is diffable. Two
 * conversations about the same customer produce two objects you can compare
 * field by field. Two Markdown blobs produce a wall of prose that a human has
 * to read. Validation is the second reason — a `rootCause` that has to be one
 * of five enum values cannot quietly become "seems like a sync issue".
 *
 * What goes in a case file, and what does not:
 *
 *   In    facts that change what the agent does next turn — who this is, what
 *         is wrong, what has already been checked, what happens next.
 *   Out   anything the transcript already says. Working memory is not a
 *         summary of the conversation; message history is. Duplicating it
 *         wastes context and drifts out of sync with the truth.
 *
 * `checksRun` and `ruledOut` are the two fields that earn their place. They
 * are what stop the agent asking a customer to try something it already
 * watched fail — the single most recognisable way support bots waste people's
 * time, and something no amount of message history reliably prevents once the
 * conversation is longer than the recall window.
 *
 * Every field is `.nullish()` rather than `.optional()`, and the reason is the
 * sharpest thing in this file.
 *
 * Under merge semantics an explicit `null` does not mean "no value" — it means
 * **delete this field**. Models pad their tool calls: asked to update one
 * field, they cheerfully send every other field as `null`, because providers
 * running in strict mode want every property listed as required and the habit
 * carries over even when strict mode is off. Left alone, that wipes the case
 * file. Watched live, turn one fills the panel and turn two empties it:
 *
 *   model sent  {"customer":null,"issue":null,"checksRun":null,"nextStep":"…"}
 *   stored      {"nextStep":"…"}
 *
 * `@mastra/memory` does guard against exactly this — `stripNullsFromOptional`
 * drops nulls for fields the schema marks optional, before the merge sees
 * them. But that guard rides on a custom validator attached to the tool's
 * input schema, and `tool-builder/builder.ts` replaces that validator with a
 * provider-derived one whenever a schema compat layer applies. OpenAI has one.
 * So on this stack the guard never runs and the nulls reach the merge intact.
 * `.nullish()` at least keeps them from failing validation on the way through;
 * it does not save the data.
 *
 * What saves the data is the prompt. `CASE_FILE_INSTRUCTIONS` below tells the
 * model, in as many words, that null deletes and that unchanged fields are
 * left out of the call rather than nulled. That holds: across fifteen turns of
 * live conversation the model only ever nulled fields that were already empty,
 * where deleting is a no-op, and it never dropped a populated one. Asked to
 * "close this out" it moved `issue.status` to `resolved` rather than deleting
 * the issue — a state transition, which is what you want.
 *
 * Worth knowing before you copy this pattern: the prompt is load-bearing here.
 * If you would rather not depend on that, a Markdown `template` uses replace
 * semantics and has no deletion hazard at all — you trade the typed record and
 * the field-by-field diff for a blob the model rewrites whole.
 */
import { z } from 'zod';

export const supportCaseFile = z.object({
  /**
   * Who we are talking to.
   *
   * Every field here is a tool result, never a customer claim — the
   * `evidence-discipline` stored skill says so and this is where that rule
   * becomes visible. A `plan` in the case file that nobody looked up is a
   * guess the agent will now repeat with confidence for the rest of the
   * conversation, which is strictly worse than not knowing.
   */
  customer: z
    .object({
      accountId: z
        .string()
        .nullish()
        .describe('Nimbus account id, e.g. acct-42. The one identifier the customer supplies; everything else here is a tool result.'),
      plan: z.string().nullish().describe('Free, Pro or Enterprise — from getAccountOverview, not from the customer.'),
      storageUsedGb: z.number().nullish().describe('As the tool reported it. Do not round.'),
      deviceCount: z.number().nullish(),
      region: z.string().nullish().describe('Home region, e.g. us-east. Matters for incident attribution.'),
    })
    .nullish(),

  /** What is actually wrong, and how far along we are in finding out. */
  issue: z
    .object({
      summary: z.string().nullish().describe("One line, in the customer's own words."),
      rootCause: z
        .enum(['DEVICE_LIMIT', 'QUOTA_EXCEEDED', 'REGION_DEGRADED', 'FILE_TOO_LARGE', 'NOT_YET_KNOWN'])
        .nullish()
        .describe('The Nimbus error code the evidence points at. Leave NOT_YET_KNOWN until a tool confirms it.'),
      status: z
        .enum(['reported', 'diagnosing', 'diagnosed', 'resolved', 'escalated'])
        .nullish()
        .describe('Where this conversation has got to.'),
    })
    .nullish(),

  /**
   * Diagnostics already performed. Arrays are *replaced* on update, not
   * appended to — so an update that adds one entry has to send the whole
   * list. That is the one sharp edge in schema working memory, and the agent
   * instructions say it out loud.
   */
  checksRun: z
    .array(z.string())
    .nullish()
    .describe('Checks already done, e.g. "getServiceStatus: us-east operational". Send the full list when adding.'),

  /** Causes eliminated, so they are never raised with the customer twice. */
  ruledOut: z
    .array(z.string())
    .nullish()
    .describe('Causes checked and eliminated, e.g. "regional incident — us-east is operational". Full list when adding.'),

  /** The single thing that happens next, in plain words the customer would recognise. */
  nextStep: z.string().nullish().describe('One sentence. What the customer or Nimbus does next.'),

  /** Set only after createSupportTicket actually returns an id. */
  ticketId: z.string().nullish().describe('e.g. TCK-9001. Only after createSupportTicket has returned it.'),
});

/**
 * The prompt half of the feature.
 *
 * Enabling working memory gives the agent a tool and a copy of the current
 * state; it does not tell it *when* writing something down is worth the call.
 * Left to itself a model either never updates the case file or rewrites it
 * every turn, and both look broken in the UI — an empty panel, or one that
 * churns. These are the rules that make the panel move in a way that tracks
 * the conversation.
 *
 * Kept next to the schema on purpose: the two are one feature, and a field
 * added above without a rule below is a field that stays null forever.
 */
export const CASE_FILE_INSTRUCTIONS = `Keeping the case file (working memory)

You keep a short case file for this conversation using the updateWorkingMemory
tool. It is your own notes, not a transcript, and it is shown back to you at
the start of every turn.

When to write:
- As soon as the customer gives you their account id.
- As soon as a tool confirms a fact about them — plan, usage, region, device
  count. Those come from tools only, never from what the customer says they
  are on.
- When you form or change a view on the root cause, or the status moves on.
- After you have run a check, so the same check is never run twice.
- After createSupportTicket returns an id.
Write before you reply, not after. Do not announce that you are doing it.

How to write:
- Send ONLY the fields you are changing. Every field you leave out keeps the
  value it already has.
- NEVER send a field as null. Null means "delete this from the case file", so
  padding a call with nulls erases work you have already done. A field you are
  not changing is left out of the call entirely — it is not set to null.
- checksRun and ruledOut are replaced, not appended to. To add one entry, send
  that field with its existing entries plus the new one.
- Numbers go in exactly as the tool reported them.

So to record one new check on a case that already knows the customer and the
issue, the entire call is:

  { "checksRun": ["<the entries already there>", "<the new one>"] }

Nothing else. No customer, no issue, no nulls.

How to read:
- Never re-run a check that is already in checksRun.
- Never raise a cause that is already in ruledOut, and never ask the customer
  to retry something that has already failed.
- Never ask for a fact the case file already holds.

What never goes in it:
- Payment card numbers, tokens, passwords or recovery codes, even if the
  customer pastes one in.
- Anything a tool did not return. An empty field is worth more than a guess,
  because a guess in the case file is one you will repeat all conversation.`;
