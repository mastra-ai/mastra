import { timingSafeEqual } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { registerApiRoute } from '@mastra/core/server';

import { circle, circleCliHome } from './circle-cli';
import { MissingIdentityError, tenantHomeFor } from './tenancy';

/**
 * The control plane: the two steps of Circle setup that the agent is forbidden
 * to take, exposed as plain HTTP so something other than the agent can take
 * them.
 *
 * `approval.ts` blocks `circle terms accept` and `circle wallet login` in the
 * sandbox, and that block is right — an agent must not accept a user's Terms of
 * Use, and an OTP must not pass through a model's context or its memory. But a
 * block on its own only moves the problem: the template's answer was to hand
 * the user a shell command, which assumes the user has a shell on the machine
 * the agent runs on. Deployed, nobody does.
 *
 * So the commands run here instead — same machine, same tenant directory, same
 * CLI, reached by a request that carries a person's decision rather than a
 * model's. The agent never sees these routes and cannot call them; the shell
 * gate stays exactly as it was.
 */

/** The header the front end proves itself with. */
const TOKEN_HEADER = 'x-control-plane-token';

/**
 * An empty origin allowlist, which is not the same as no CORS config: the
 * server's default is `origin: '*'`, and these four routes are the last ones
 * that should inherit it. It matches no origin, so no `Access-Control-Allow-
 * Origin` comes back and a browser on another site cannot read the response.
 *
 * Not the security boundary — `curl` has never read a CORS header in its life,
 * and the token is what actually stops anyone. This is the narrower promise
 * that a page the user happens to have open cannot be turned into a caller.
 */
const NO_BROWSER = { origin: [] as string[] };

/**
 * How long a `login-requests/<uuid>.json` file is worth reading.
 *
 * The CLI's own window, restated because this module picks the request to
 * complete and has to agree with the CLI about which ones are still live —
 * `loadLoginRequest` deletes anything older than this and reports it as
 * invalid, and offering the user a request the CLI will refuse is worse than
 * telling them up front that the code expired.
 */
const LOGIN_REQUEST_TTL_MS = 10 * 60 * 1000;

/** What the CLI writes for a login it has started but not finished. */
type LoginRequest = {
  requestId?: unknown;
  email?: unknown;
  timestamp?: unknown;
  otpHead?: unknown;
};

/** The half of a login request that is safe to say out loud. */
type PendingLogin = { requestId: string; email: string; otpHead?: string };

type TermsRecord = { accepted?: unknown; acceptedAt?: unknown; acceptedVia?: unknown };

type WalletStatus = {
  mainnet?: { email?: unknown; tokenStatus?: unknown; expiresIn?: unknown };
};

/**
 * Whether the caller is our own front end.
 *
 * A constant-time compare because the alternative leaks the token one byte at a
 * time to anyone willing to measure, and these routes accept Terms of Use and
 * start logins — the two things in this system a stranger most wants to do on
 * someone else's behalf.
 *
 * An unset token fails closed. A deployed server with no token configured is
 * misconfigured, and the failure mode of the other choice is an open control
 * plane on a public URL, which is the worst outcome available here.
 */
function authorised(presented: string | undefined): boolean {
  const expected = process.env.CONTROL_PLANE_TOKEN;

  if (!expected || !presented) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(presented);

  return a.length === b.length && timingSafeEqual(a, b);
}

/** Terms acceptance, read from the file the CLI records it in. */
async function termsAccepted(home: string): Promise<boolean> {
  try {
    const raw = await readFile(join(circleCliHome(home), 'terms.json'), 'utf-8');
    const record = JSON.parse(raw) as TermsRecord;

    return record.accepted === true;
  } catch {
    return false;
  }
}

/**
 * The most recent login this caller started and has not finished.
 *
 * Read from disk rather than held in memory here, because the CLI already
 * keeps it there and a second copy is a second thing to get out of sync — and
 * because memory does not survive the restart that a login, sitting between
 * two requests a minute apart, very much can.
 *
 * Only three fields come back. The same file holds the device token and the
 * encryption key the OTP is exchanged against, and those have no reason to
 * exist anywhere but on disk.
 */
async function pendingLogin(home: string): Promise<PendingLogin | undefined> {
  const dir = join(circleCliHome(home), 'login-requests');

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return undefined;
  }

  const live: (PendingLogin & { at: number })[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    try {
      const request = JSON.parse(await readFile(join(dir, file), 'utf-8')) as LoginRequest;
      const at = typeof request.timestamp === 'number' ? request.timestamp : 0;

      if (typeof request.requestId !== 'string' || typeof request.email !== 'string') continue;
      if (Date.now() - at > LOGIN_REQUEST_TTL_MS) continue;

      live.push({
        at,
        requestId: request.requestId,
        email: request.email,
        ...(typeof request.otpHead === 'string' ? { otpHead: request.otpHead } : {}),
      });
    } catch {
      // A half-written or hand-edited file is not worth failing the whole
      // request over; the user's next code request writes a fresh one.
    }
  }

  live.sort((a, b) => b.at - a.at);

  return live[0];
}

/** The caller's home, or the reason there isn't one. */
function homeFor(body: unknown): { home: string } | { error: string } {
  const id = (body as { userId?: unknown } | undefined)?.userId;

  try {
    return { home: tenantHomeFor(typeof id === 'string' ? id : undefined) };
  } catch (error) {
    if (error instanceof MissingIdentityError) {
      return { error: 'No `userId` in the request body.' };
    }
    return { error: 'That caller has no usable workspace.' };
  }
}

/**
 * A route that needs a token and a caller, with both checks written once.
 *
 * Four handlers repeating the same two guards is four chances to leave one out,
 * and the one to leave out is always the token.
 */
const guarded = (
  handle: (home: string, body: Record<string, unknown>) => Promise<{ status: number; body: unknown }>
) => {
  return async (c: {
    req: { header: (name: string) => string | undefined; json: () => Promise<unknown> };
    json: (body: unknown, status?: number) => Response;
  }): Promise<Response> => {
    if (!authorised(c.req.header(TOKEN_HEADER))) {
      return c.json({ error: 'Not authorised.' }, 401);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Expected a JSON body.' }, 400);
    }

    const resolved = homeFor(body);
    if ('error' in resolved) return c.json({ error: resolved.error }, 400);

    const result = await handle(resolved.home, (body ?? {}) as Record<string, unknown>);

    return c.json(result.body, result.status);
  };
};

/**
 * Where setup has got to, as a fact about the filesystem rather than about the
 * conversation.
 *
 * The front end asks this before every turn, so it has to be cheap and it has
 * to be true after a restart, a new thread or a second browser. `wallet status`
 * is skipped until the Terms are accepted because the CLI gates every command
 * behind them: run early, it fails with PERMISSION_DENIED and says nothing
 * about the wallet.
 */
const statusRoute = registerApiRoute('/circle/status', {
  method: 'POST',
  cors: NO_BROWSER,
  handler: guarded(async home => {
    const accepted = await termsAccepted(home);

    if (!accepted) {
      return {
        status: 200,
        body: { termsAccepted: false, loggedIn: false, awaitingOtp: false },
      };
    }

    const pending = await pendingLogin(home);
    const status = await circle<WalletStatus>(home, ['wallet', 'status']);
    const mainnet = status.ok ? status.data.mainnet : undefined;

    return {
      status: 200,
      body: {
        termsAccepted: true,
        loggedIn: mainnet?.tokenStatus === 'VALID',
        ...(typeof mainnet?.email === 'string' ? { email: mainnet.email } : {}),
        ...(typeof mainnet?.expiresIn === 'string' ? { expiresIn: mainnet.expiresIn } : {}),
        awaitingOtp: pending !== undefined,
        ...(pending?.otpHead ? { otpHead: pending.otpHead } : {}),
        ...(pending?.email ? { pendingEmail: pending.email } : {}),
      },
    };
  }),
});

/**
 * Records the acceptance a person just made.
 *
 * The route does not decide anything — it writes down a decision taken
 * elsewhere, which is the whole distinction between this and the agent doing
 * it. What it can do is refuse to write one down twice, so a stray second call
 * reports the original acceptance rather than restamping it with a later date.
 */
const acceptTermsRoute = registerApiRoute('/circle/terms/accept', {
  method: 'POST',
  cors: NO_BROWSER,
  handler: guarded(async home => {
    if (await termsAccepted(home)) {
      return { status: 200, body: { termsAccepted: true, alreadyAccepted: true } };
    }

    const result = await circle<{ message?: string }>(home, ['terms', 'accept']);

    if (!result.ok) {
      return { status: 502, body: { error: result.message, code: result.code } };
    }

    return { status: 200, body: { termsAccepted: true, alreadyAccepted: false } };
  }),
});

/**
 * Starts a login: Circle emails a code, and the CLI writes the request that
 * code answers to.
 *
 * The request id it produces stays here. The front end has no use for it — the
 * completing call finds it on disk — and an id that never crosses the network
 * is an id that cannot be replayed from a browser's history.
 */
const initLoginRoute = registerApiRoute('/circle/login/init', {
  method: 'POST',
  cors: NO_BROWSER,
  handler: guarded(async (home, body) => {
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { status: 400, body: { error: 'That does not look like an email address.' } };
    }
    if (!(await termsAccepted(home))) {
      return { status: 409, body: { error: "Circle's Terms have not been accepted yet." } };
    }

    const result = await circle<{ message?: string }>(home, [
      'wallet',
      'login',
      email,
      '--type',
      'agent',
      '--init',
    ]);

    if (!result.ok) {
      return { status: 502, body: { error: result.message, code: result.code } };
    }

    const pending = await pendingLogin(home);

    return {
      status: 200,
      body: {
        otpSent: true,
        email,
        // The anti-phishing prefix the CLI would have shown in its own prompt.
        // Circle puts it in the email too, and a code whose prefix does not
        // match this one is a code someone else asked for.
        ...(pending?.otpHead ? { otpHead: pending.otpHead } : {}),
      },
    };
  }),
});

/**
 * Finishes a login with the code from the user's inbox.
 *
 * The code arrives, is spent, and is not written down: it is not logged, not
 * echoed back in the response, and not stored anywhere this process controls.
 * That is the property the whole control plane exists to preserve, so it is
 * worth saying plainly — the only thing that survives this handler is the
 * session the CLI writes.
 */
const completeLoginRoute = registerApiRoute('/circle/login/complete', {
  method: 'POST',
  cors: NO_BROWSER,
  handler: guarded(async (home, body) => {
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

    if (!/^(?:[A-Za-z0-9]{3}-)?\d{6}$/.test(otp)) {
      return { status: 400, body: { error: 'That does not look like a Circle code.' } };
    }

    const pending = await pendingLogin(home);

    if (!pending) {
      return {
        status: 409,
        body: { error: 'No sign-in is waiting for a code, or the last one expired.' },
      };
    }

    const result = await circle<{ email?: string }>(home, [
      'wallet',
      'login',
      '--request',
      pending.requestId,
      '--otp',
      otp,
    ]);

    if (!result.ok) {
      return { status: 502, body: { error: result.message, code: result.code } };
    }

    return { status: 200, body: { loggedIn: true, email: pending.email } };
  }),
});

export const controlPlaneRoutes = [
  statusRoute,
  acceptTermsRoute,
  initLoginRoute,
  completeLoginRoute,
];
