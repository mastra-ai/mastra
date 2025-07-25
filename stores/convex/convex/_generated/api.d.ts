/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';
import type * as evals from '../evals.js';
import type * as messages from '../messages.js';
import type * as system from '../system.js';
import type * as threads from '../threads.js';
import type * as traces from '../traces.js';
import type * as workflowRuns from '../workflowRuns.js';

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  evals: typeof evals;
  messages: typeof messages;
  system: typeof system;
  threads: typeof threads;
  traces: typeof traces;
  workflowRuns: typeof workflowRuns;
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>;
