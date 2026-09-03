// Naming the one caller that cannot name itself.
//
// `tenancy.ts` refuses a request with no `user-id`, and that refusal is what stops two callers
// sharing a wallet. Every front end this template expects sends one. Mastra Studio does not: it is
// a console for whatever agent it is pointed at, not an application with users of its own, and it
// has no field to put an id in. So a deployment whose only front end is Studio refuses every
// request Studio makes — the agent is listed, and unusable.
//
// This middleware answers that, and nothing else. A request that already names a caller is left
// exactly as it arrived. A request that names nobody is given `studio` only if it came from
// Studio's own page, so the refusal still stands for everything else — a stray call from a
// misconfigured proxy fails as loudly as it did before.
//
// What this is not is an authentication boundary. `Origin` is a header the caller writes, so
// anyone willing to type Studio's gets the studio caller and the wallet behind it. That is the
// same footing the whole template is on — `tenancy.ts` says it plainly: nothing here checks that a
// caller is who it says it is. The thing that actually bounds the loss is a wallet spending policy
// (`circle wallet limit set`), and a deployment reachable by strangers wants one whether or not
// this file exists.

import type { RequestContext } from '@mastra/core/request-context';
import type { Middleware } from '@mastra/core/server';

import { IDENTITY_KEY, STUDIO_CALLER } from './tenancy';

/** Where Mastra Cloud serves a deployment's Studio from, as a host suffix rather than one URL. */
const CLOUD_STUDIO = '.studio.mastra.cloud';

/**
 * Whether `origin` is a Studio looking at this very server.
 *
 * Two shapes, because Studio arrives two ways. Deployed it is a Mastra Cloud
 * page on the project's own subdomain. Locally it is served by this process, on
 * the port the API answers on, so it is same-origin — which is also what keeps
 * a front end on another port out: an app on `localhost:3000` is cross-origin
 * here and gets the refusal it would have got anyway.
 */
function fromStudio(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return false;

  let hostname: string;
  let sameOrigin: boolean;

  try {
    const url = new URL(origin);
    hostname = url.hostname;
    sameOrigin = host === url.host;
  } catch {
    // Not a URL at all, which no browser sends and no honest caller means.
    return false;
  }

  return sameOrigin || hostname.endsWith(CLOUD_STUDIO);
}

/**
 * The middleware itself, mounted in `./index`.
 *
 * Runs after Mastra's own context middleware — which is what put the
 * `requestContext` on the Hono context — and before any route reads it. Setting
 * the id here rather than in the agent is what keeps one answer to "who is
 * this": the workspace resolvers, the skills directory and the CLI home all
 * read the same field they always did, and none of them knows Studio exists.
 */
export const studioCallerMiddleware: Middleware = async (c, next) => {
  const requestContext = c.get('requestContext') as RequestContext | undefined;

  if (
    requestContext &&
    !requestContext.get(IDENTITY_KEY) &&
    fromStudio(c.req.header('origin'), c.req.header('host'))
  ) {
    requestContext.set(IDENTITY_KEY, STUDIO_CALLER);
  }

  return next();
};

/**
 * Whether this request is the one the middleware named.
 *
 * Read by the agent to decide whether the chat is the front end. Studio is the
 * caller with no other door: no terminal to paste a command into, and no proxy
 * in front of it calling the control plane, so the sign-in tools it gets are
 * the only way in. Every other caller arrived through something that can do
 * both, and a second way to sign in is a second thing to keep in step with the
 * first.
 */
export function isStudioCaller(requestContext?: RequestContext): boolean {
  return requestContext?.get(IDENTITY_KEY) === STUDIO_CALLER;
}
