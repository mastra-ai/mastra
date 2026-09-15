import { Agent } from '@mastra/core/agent';
import { callCenterMemory } from '../memory';
import { endCall, lookupAccountStatus, recordConsent } from '../tools/compliance-tools';
import { stopOnToolCall } from './stop-conditions';

/**
 * "Super Regulated Business" demo agent — Northwind Financial, a stand-in for a heavily-regulated
 * line (financial services, health, insurance) where every compliance control is turned on. Its
 * only job is to make the full regulatory surface of `@mastra/livekit`'s `configuration` visible on
 * one call:
 *
 *   - AI disclosure at the start (the worker's non-interruptible, awaited, persisted greeting), plus
 *     periodic re-disclosure — the agent doesn't speak these; the worker does.
 *   - A named consent set captured at runtime, one item at a time, via `recordConsent`.
 *   - Agent-initiated hang-up via `endCall`, after which the worker plays a guaranteed compliance
 *     sign-off and drops the line.
 *   - A consent-gated end-of-call summary flush (in the worker's `onCallEnd`).
 *
 * The instructions are deliberately forceful and sequenced: the Meridian agent only *mentions*
 * consent and a fast model often skips it, so here the consent sweep is the first thing that
 * happens and each answer must be recorded before moving on — so every mechanism reliably fires in
 * a demo.
 */
export const superRegulatedAgent = new Agent({
  id: 'super-regulated',
  name: 'Super Regulated Business',
  description:
    'A maximally-regulated financial-services voice line (Northwind Financial) that demonstrates every @mastra/livekit compliance control: AI disclosure, periodic re-disclosure, a full runtime consent sweep, agent-initiated hang-up with a compliance sign-off, and a consent-gated call-summary flush.',
  instructions: `You are the AI virtual assistant for Northwind Financial, a regulated financial-services provider. You are on a PHONE CALL, so keep every reply to one or two short spoken sentences, no lists, markdown, emojis, or special characters, and read any numbers or codes back slowly.

The system has already spoken the opening disclosure to the caller (that you are an AI assistant and the call may be recorded). Do not repeat it word for word — continue naturally from it.

You MUST complete this compliance sequence on every call, in this exact order, before helping with anything:

STEP 1 — Consent sweep. Ask for each of the following permissions ONE AT A TIME, in this order. Ask plainly, wait for the caller's answer, and the MOMENT they answer, call the recordConsent tool with the matching item and granted true if they agree or false if they decline. Do not ask the next question until you have recorded the previous answer. Do not batch them. Do not skip any, even if the caller seems in a hurry.
  1. item "callRecording" — "For compliance, this call is recorded. Is that okay?"
  2. item "summaryStorage" — "We keep a short summary of the call to help serve you next time. Is that alright?"
  3. item "dataSharing" — "To fully handle your request we may share your details with our partner services. Do you consent to that?"
  4. item "marketing" — "Lastly, would you like to receive occasional product updates from us?"
Record every answer with recordConsent, whether yes or no. If the caller declines call recording, acknowledge it, record it, and continue anyway for this demo.

STEP 2 — Help the caller. Only after all four consents are recorded, ask what they need. You can check an account with the lookupAccountStatus tool using the last four digits of their account number; read the status back briefly. Never invent account details beyond what the tool returns. If the request is outside account status, say you'll note it for a specialist to follow up.

STEP 3 — Close the call. When the caller has nothing else, tell them briefly that you'll close out the call for compliance, then call the endCall tool as your very last action. Do not give a long goodbye — the system plays the official compliance sign-off after you. Never call endCall before all four consents are recorded and the caller's request is handled. The moment you call endCall your turn is over: produce no text after it and do not acknowledge its result.

The caller's collected details (working memory) are shown to you as context and kept up to date for you automatically in the background. Never try to update it yourself and never mention it.

Stay calm, professional, and concise throughout.`,
  // Fast, non-reasoning model for the voice loop — same reasoning as the Meridian agent: a reasoning
  // model spends seconds "thinking" before each spoken turn. Uses OPENAI_API_KEY.
  model: 'openai/gpt-4.1-mini',
  tools: {
    recordConsent,
    lookupAccountStatus,
    endCall,
  },
  // Hard stop once a step calls `endCall` — same rationale as the Meridian agent: the model
  // structurally cannot speak past its close-out line, which matters even more here because the
  // worker plays the official compliance sign-off after it.
  defaultOptions: {
    stopWhen: stopOnToolCall('endCall'),
  },
  // Reuse the caller-scoped memory (working memory + observational memory) so the consent-gated
  // end-of-call OM flush can be demonstrated. The regulated worker prefixes the memory `resource`
  // (e.g. `regulated:<caller>`) so this demo's records never mix with the Meridian demo's.
  memory: callCenterMemory,
});
