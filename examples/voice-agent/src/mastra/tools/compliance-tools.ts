import { createConsentTool, createEndCallTool } from '@mastra/livekit';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { recordConsent as recordConsentBackend } from '../backend';

/**
 * The named, extensible consent set this regulated line captures at runtime — the companion to the
 * worker's `configuration.requireConsent`. `summaryStorage` is the one wired to a consequence (the
 * end-of-call observational-memory summary flush is gated on it in the worker's `onCallEnd`); the
 * others show how the SAME runtime-capture mechanism scales to a full regulated consent model
 * without one global "consented" flag: a call-recording notice, third-party data sharing, and
 * marketing follow-ups, each independently asked and independently recorded.
 *
 * Keep this in sync with the agent's instructions (super-regulated-agent.ts), which walk the caller
 * through these items in order.
 */
export const REGULATED_CONSENT_ITEMS = ['callRecording', 'summaryStorage', 'dataSharing', 'marketing'] as const;

/**
 * Captures each consent decision at runtime. `createConsentTool` reads the caller id from the tool
 * execution context; we log the grant (so it's visible in the worker console the moment it lands —
 * the piece that was invisible before) and persist it to the shared consent ledger, which
 * `onCallEnd` reads back to gate the summary flush and to print the full audit trail.
 */
export const recordConsent = createConsentTool({
  items: REGULATED_CONSENT_ITEMS,
  onGrant: async ({ item, granted, resourceId }) => {
    console.info('[regulated] consent captured', { item, granted, resourceId });
    if (resourceId) await recordConsentBackend(resourceId, item, granted);
  },
});

/**
 * Lets the agent hang up once the compliance sequence is done — the companion to the worker's
 * `configuration.endCall`. The tool only SIGNALS intent; the worker waits for the agent's words to
 * finish, then speaks the configured (non-interruptible) compliance sign-off and disconnects.
 * `onEndCall` is optional bookkeeping — here we log the reason and caller.
 */
export const endCall = createEndCallTool({
  onEndCall: ({ reason, resourceId }) => {
    console.info('[regulated] agent ended the call', { reason, resourceId });
  },
});

/**
 * A trivial domain action so the regulated call has somewhere to go after consent: a canned
 * account-status lookup standing in for a real core-banking system. It never invents balances — it
 * returns a fixed, safe summary the agent can read back.
 */
export const lookupAccountStatus = createTool({
  id: 'lookupAccountStatus',
  description:
    'Look up the caller\'s account status by the last four digits of their account number. Only use this after the caller has consented to call recording. Returns a short status summary to read back.',
  inputSchema: z.object({
    lastFour: z.string().describe('The last four digits of the account number, e.g. "4921".'),
  }),
  execute: async ({ lastFour }) => {
    return {
      lastFour,
      status: 'in good standing',
      summary: 'The account is active and in good standing with no outstanding actions required.',
    };
  },
});
