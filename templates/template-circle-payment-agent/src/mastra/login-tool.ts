// Circle sign-in, in the conversation, for the deployment that has no front end of its own.
//
// `approval.ts` blocks `circle terms accept` and `circle wallet login` in the shell, and the block
// is right: an agent must not accept a user's Terms of Use, and the CLI's own prompt has no
// terminal to read a code from. The block's advice — hand the user the command with a `HOME=`
// prefix to paste into their own terminal — assumes the user has a shell on the machine the agent
// runs on. Locally they do. Deployed, nobody does, and the control plane in `./control-plane`
// answers that for a front end that can call it. Mastra Studio is neither: no terminal to paste
// into, and no place to put a login form.
//
// So the login runs here instead, as three tools the agent drives and cannot complete on its own.
// Acceptance is an approval the user grants or refuses, which Studio renders natively. Sign-in is
// two calls with the user between them: one asks Circle to send a code, one spends the code the
// user gives back.
//
// About that code. This is the one place the template knowingly gives ground. Its own rule is that
// an OTP must never pass through the model's context — and here it does, because the model is what
// emits the tool call carrying it, and Studio's agent chat has no other way to collect one. Its
// suspended-tool UI is read-only: a `data-tool-call-suspended` part renders as a payload and
// nothing else, and the only interactive path chat has is approve/decline, which is a boolean. A
// suspending tool pauses correctly there and can never be answered. What is left of the rule is
// that the code is single-use and that Circle expires it in ten minutes. Treat a code typed here as
// a code spent.
//
// The shell block is untouched. These call the CLI directly, the same way the control-plane routes
// do, so the commands the agent is refused are still refused in the terminal it drives.

import { createTool } from '@mastra/core/tools';
import type { ToolPayloadTransformTargetConfig } from '@mastra/core/tools';
import { z } from 'zod';

import { circle, pendingLogin, termsAccepted } from './circle-cli';
import { tenantHome } from './tenancy';

/** Circle's Terms of Use, named in the approval so the user is deciding about something they can read. */
const TERMS_URL = 'https://www.circle.com/legal/developer-terms';

/**
 * The code Circle emails, in either of the two spellings the CLI accepts.
 *
 * The six digits alone, or the full `B1X-123456` with the anti-phishing prefix.
 * The CLI checks the prefix against the one it issued, so a code carrying
 * someone else's prefix is rejected there rather than here — this only turns
 * away input that could not be a code at all, before it reaches a command line.
 */
const OTP = /^(?:[A-Za-z0-9]{3}-)?\d{6}$/;

/**
 * Accepting Circle's Terms of Use, as an approval rather than a tool call.
 *
 * `requireApproval` is the whole design. The agent can ask, and only the user
 * can answer — Studio renders the question, and nothing runs until a person
 * presses accept. That keeps Circle's rule intact where a plain tool would
 * break it: the agent never decides, it only offers the user the chance to.
 *
 * `CIRCLE_ACCEPT_TERMS` stays absent from every environment this template
 * builds, here most of all. A default that accepts on everyone's behalf is the
 * same mistake as an agent that does, wearing a config file.
 */
export const acceptCircleTermsTool = createTool({
  id: 'circle-accept-terms',
  description:
    "Ask the user to accept Circle's Terms of Use, which every other `circle` command is gated " +
    'behind. Requires the user to approve; you cannot accept on their behalf. Call this when ' +
    '`circle wallet status` reports the Terms have not been accepted, and show them the terms at ' +
    `${TERMS_URL} when you do.`,
  inputSchema: z.object({}),
  outputSchema: z.object({
    accepted: z.boolean(),
    alreadyAccepted: z.boolean().optional(),
    message: z.string().optional(),
  }),
  requireApproval: true,
  execute: async (_input, context) => {
    const home = tenantHome(context.requestContext);

    if (await termsAccepted(home)) {
      return { accepted: true, alreadyAccepted: true };
    }

    const result = await circle<{ message?: string }>(home, ['terms', 'accept']);

    if (!result.ok) {
      return { accepted: false, message: result.message };
    }

    return { accepted: true, alreadyAccepted: false };
  },
});

/**
 * Asking Circle to send a code.
 *
 * Half a login. It hands back the anti-phishing prefix rather than keeping it,
 * because the user about to read a code out of their inbox needs to know which
 * one is theirs — a code whose prefix does not match this one was requested by
 * somebody else, and saying so is the only thing standing between that and
 * being typed in here.
 *
 * The request id stays on disk. `circle-submit-code` finds it there, which is
 * one less thing the model can get wrong and one less thing it can be talked
 * into changing.
 */
export const circleLoginTool = createTool({
  id: 'circle-wallet-login',
  description:
    'Start signing the user in to Circle with their email address. Circle emails them a one-time ' +
    'code. Ask the user for their email in chat and never invent one. Requires the Terms to be ' +
    'accepted first. After this succeeds, show them the returned prefix, ask them to paste the ' +
    'code from their email, and pass it to `circle-submit-code` — that call is what finishes the ' +
    'login.',
  inputSchema: z.object({
    email: z.string().describe('The email address the user gave you. Never invent one.'),
  }),
  outputSchema: z.object({
    codeSent: z.boolean(),
    email: z.string().optional(),
    otpHead: z
      .string()
      .optional()
      .describe(
        'The anti-phishing prefix Circle put in the email. Show it to the user: a code that does ' +
          'not carry this prefix belongs to someone else and must not be submitted.',
      ),
    message: z.string().optional(),
  }),
  execute: async ({ email }, context) => {
    const home = tenantHome(context.requestContext);
    const address = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      return { codeSent: false, message: 'That does not look like an email address.' };
    }
    // The CLI gates every command behind acceptance, and a login run before it
    // fails with PERMISSION_DENIED — an error about the Terms wearing the
    // costume of an error about the wallet.
    if (!(await termsAccepted(home))) {
      return {
        codeSent: false,
        message:
          "Circle's Terms have not been accepted yet. Call `circle-accept-terms` first, then try again.",
      };
    }

    const init = await circle<{ message?: string }>(home, [
      'wallet',
      'login',
      address,
      '--type',
      'agent',
      '--init',
    ]);

    if (!init.ok) {
      return { codeSent: false, message: init.message };
    }

    const pending = await pendingLogin(home);

    return {
      codeSent: true,
      email: address,
      ...(pending?.otpHead ? { otpHead: pending.otpHead } : {}),
    };
  },
});

/** What `circle-submit-code` is called with and answers, named so its transform can be typed. */
type SubmitInput = { otp: string };
type SubmitOutput = { loggedIn: boolean; email?: string; message?: string };

/**
 * What the code looks like to everything that keeps a copy.
 *
 * The `input` phase is replaced with a mask, so the rendered call and the
 * transcript replayed to the model on later turns carry `******` rather than a
 * live credential. `execute` still receives the real one: this sits between the
 * payload and its serializers, not between the user and the tool.
 *
 * A reduction and not a fix, and the difference is worth being exact about,
 * because it is easy to read more into a mask than it does. The transformed
 * value is stored *beside* the original, under
 * `providerMetadata.mastra.toolPayloadTransform`, and the serializers choose it
 * — so `toolInvocation.args` on disk still holds the code, as does the user's
 * own message. What this buys is that the code stops being replayed into the
 * model's context on every subsequent turn, and stops being shown in the UI.
 * What it does not buy is the code not being written down.
 *
 * Every other phase is spelled out and passed through unchanged. Configuring a
 * target opts this tool's whole payload into transformation, and a phase with
 * no transformer is replaced by a placeholder rather than left alone — so an
 * omitted line here would blank the tool's result and leave the model unable to
 * tell a completed login from a failed one.
 */
const SUBMIT_PHASES: ToolPayloadTransformTargetConfig<SubmitInput, SubmitOutput> = {
  // The streaming half of the same argument, which would otherwise spell the
  // code out one token at a time on its way to being masked.
  inputDelta: () => '',
  input: () => ({ otp: '******' }),
  output: ({ output }) => output,
  error: ({ error }) => error,
  approval: () => ({ otp: '******' }),
  suspend: ({ suspendPayload }) => suspendPayload,
  resume: ({ resumeData }) => resumeData,
};

/**
 * Spending the code, and finishing the login.
 *
 * The code arrives, is spent, and is not written down here: not logged, not
 * echoed back in the result, and not stored anywhere this module controls. The
 * only thing that survives is the session the CLI writes.
 */
export const submitCircleCodeTool = createTool({
  id: 'circle-submit-code',
  description:
    'Finish the sign-in started by `circle-wallet-login`, using the one-time code the user pasted ' +
    'into the chat. Pass it exactly as they wrote it — six digits, or the full form with Circle’s ' +
    'prefix. Never guess a code, never reuse one, and never call this without a code the user has ' +
    'just given you. On success the wallet is ready and no `circle wallet create` is needed.',
  inputSchema: z.object({
    otp: z.string().describe('The code the user pasted: 123456, or the full B1X-123456.'),
  }),
  outputSchema: z.object({
    loggedIn: z.boolean(),
    email: z.string().optional(),
    message: z.string().optional(),
  }),
  transform: { display: SUBMIT_PHASES, transcript: SUBMIT_PHASES },
  execute: async ({ otp }, context) => {
    const home = tenantHome(context.requestContext);
    const code = otp.trim();

    if (!OTP.test(code)) {
      return { loggedIn: false, message: 'That does not look like a Circle code.' };
    }

    const pending = await pendingLogin(home);

    if (!pending) {
      return {
        loggedIn: false,
        message:
          'No sign-in is waiting for a code, or the last one expired. Start again with ' +
          '`circle-wallet-login`.',
      };
    }

    const result = await circle<{ email?: string }>(home, [
      'wallet',
      'login',
      '--request',
      pending.requestId,
      '--otp',
      code,
    ]);

    if (!result.ok) {
      return { loggedIn: false, message: result.message };
    }

    return { loggedIn: true, email: pending.email };
  },
});

/** All three, under the ids the agent's instructions and its shell block name. */
export const loginTools = {
  'circle-accept-terms': acceptCircleTermsTool,
  'circle-wallet-login': circleLoginTool,
  'circle-submit-code': submitCircleCodeTool,
};
