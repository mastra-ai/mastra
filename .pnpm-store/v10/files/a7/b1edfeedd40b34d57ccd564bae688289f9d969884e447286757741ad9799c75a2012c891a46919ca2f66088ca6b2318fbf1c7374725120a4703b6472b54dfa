/**
 * Helpers for integrating Convex into Next.js applications using server rendering.
 *
 * This module contains:
 * 1. {@link preloadQuery}, for preloading data for reactive client components.
 * 2. {@link fetchQuery}, {@link fetchMutation} and {@link fetchAction} for loading and mutating Convex data
 *   from Next.js Server Components, Server Actions and Route Handlers.
 *
 * ## Usage
 *
 * All exported functions assume that a Convex deployment URL is set in the
 * `NEXT_PUBLIC_CONVEX_URL` environment variable. `npx convex dev` will
 * automatically set it during local development.
 *
 * ### Preloading data
 *
 * Preload data inside a Server Component:
 *
 * ```typescript
 * import { preloadQuery } from "convex/nextjs";
 * import { api } from "@/convex/_generated/api";
 * import ClientComponent from "./ClientComponent";
 *
 * export async function ServerComponent() {
 *   const preloaded = await preloadQuery(api.foo.baz);
 *   return <ClientComponent preloaded={preloaded} />;
 * }
 * ```
 *
 * And pass it to a Client Component:
 * ```typescript
 * import { Preloaded, usePreloadedQuery } from "convex/react";
 * import { api } from "@/convex/_generated/api";
 *
 * export function ClientComponent(props: {
 *   preloaded: Preloaded<typeof api.foo.baz>;
 * }) {
 *   const data = usePreloadedQuery(props.preloaded);
 *   // render `data`...
 * }
 * ```
 *
 * @module
 */

import { ConvexHttpClient } from "../browser/index.js";
import { validateDeploymentUrl } from "../common/index.js";
import { Preloaded } from "../react/index.js";
import {
  ArgsAndOptions,
  FunctionReference,
  FunctionReturnType,
  getFunctionName,
} from "../server/index.js";
import { convexToJson, jsonToConvex } from "../values/index.js";

/**
 * Options to {@link preloadQuery}, {@link fetchQuery}, {@link fetchMutation} and {@link fetchAction}.
 */
export type NextjsOptions = {
  /**
   * The JWT-encoded OpenID Connect authentication token to use for the function call.
   */
  token?: string;
  /**
   * The URL of the Convex deployment to use for the function call.
   * Defaults to `process.env.NEXT_PUBLIC_CONVEX_URL` if not provided.
   *
   * Explicitly passing undefined here (such as from missing ENV variables) will throw an error in the future.
   */
  url?: string;

  /**
   * @internal
   */
  adminToken?: string;
  /**
   * Skip validating that the Convex deployment URL looks like
   * `https://happy-animal-123.convex.cloud` or localhost.
   *
   * This can be useful if running a self-hosted Convex backend that uses a different
   * URL.
   *
   * The default value is `false`
   */
  skipConvexDeploymentUrlCheck?: boolean;
};

/**
 * Execute a Convex query function and return a `Preloaded`
 * payload which can be passed to {@link react.usePreloadedQuery} in a Client
 * Component.
 *
 * @param query - a {@link server.FunctionReference} for the public query to run
 * like `api.dir1.dir2.filename.func`.
 * @param args - The arguments object for the query. If this is omitted,
 * the arguments will be `{}`.
 * @param options -  A {@link NextjsOptions} options object for the query.
 * @returns A promise of the `Preloaded` payload.
 */
export async function preloadQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: ArgsAndOptions<Query, NextjsOptions>
): Promise<Preloaded<Query>> {
  const value = await fetchQuery(query, ...args);
  const preloaded = {
    _name: getFunctionName(query),
    _argsJSON: convexToJson(args[0] ?? {}),
    _valueJSON: convexToJson(value),
  };
  return preloaded as any;
}

/**
 * Returns the result of executing a query via {@link preloadQuery}.
 *
 * @param preloaded - The `Preloaded` payload returned by {@link preloadQuery}.
 * @returns The query result.
 */
export function preloadedQueryResult<Query extends FunctionReference<"query">>(
  preloaded: Preloaded<Query>,
): FunctionReturnType<Query> {
  return jsonToConvex(preloaded._valueJSON);
}

/**
 * Execute a Convex query function.
 *
 * @param query - a {@link server.FunctionReference} for the public query to run
 * like `api.dir1.dir2.filename.func`.
 * @param args - The arguments object for the query. If this is omitted,
 * the arguments will be `{}`.
 * @param options -  A {@link NextjsOptions} options object for the query.
 * @returns A promise of the query's result.
 */
export async function fetchQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: ArgsAndOptions<Query, NextjsOptions>
): Promise<FunctionReturnType<Query>> {
  const [fnArgs, options] = args;
  const client = setupClient(options ?? {});
  return client.query(query, fnArgs || {});
}

/**
 * Execute a Convex mutation function.
 *
 * @param mutation - A {@link server.FunctionReference} for the public mutation
 * to run like `api.dir1.dir2.filename.func`.
 * @param args - The arguments object for the mutation. If this is omitted,
 * the arguments will be `{}`.
 * @param options -  A {@link NextjsOptions} options object for the mutation.
 * @returns A promise of the mutation's result.
 */
export async function fetchMutation<
  Mutation extends FunctionReference<"mutation">,
>(
  mutation: Mutation,
  ...args: ArgsAndOptions<Mutation, NextjsOptions>
): Promise<FunctionReturnType<Mutation>> {
  const [fnArgs, options] = args;
  const client = setupClient(options ?? {});
  return client.mutation(mutation, fnArgs || {});
}

/**
 * Execute a Convex action function.
 *
 * @param action - A {@link server.FunctionReference} for the public action
 * to run like `api.dir1.dir2.filename.func`.
 * @param args - The arguments object for the action. If this is omitted,
 * the arguments will be `{}`.
 * @param options -  A {@link NextjsOptions} options object for the action.
 * @returns A promise of the action's result.
 */
export async function fetchAction<Action extends FunctionReference<"action">>(
  action: Action,
  ...args: ArgsAndOptions<Action, NextjsOptions>
): Promise<FunctionReturnType<Action>> {
  const [fnArgs, options] = args;
  const client = setupClient(options ?? {});
  return client.action(action, fnArgs || {});
}

function setupClient(options: NextjsOptions) {
  if ("url" in options && options.url === undefined) {
    // This will be an error in the future.
    // eslint-disable-next-line no-console
    console.error(
      "deploymentUrl is undefined, are your environment variables set? In the future explicitly passing undefined will cause an error. To explicitly use the default, pass `process.env.NEXT_PUBLIC_CONVEX_URL`.",
    );
  }
  const client = new ConvexHttpClient(
    getConvexUrl(options.url, options.skipConvexDeploymentUrlCheck ?? false),
  );
  if (options.token !== undefined) {
    client.setAuth(options.token);
  }
  if (options.adminToken !== undefined) {
    client.setAdminAuth(options.adminToken);
  }
  client.setFetchOptions({ cache: "no-store" });
  return client;
}

function getConvexUrl(
  /**
   * The URL of the Convex deployment to use for the function call.
   *
   * Defaults to `process.env.NEXT_PUBLIC_CONVEX_URL` if not provided.
   *
   * Explicitly passing undefined here (such as in broken ENV variables) will throw an error in the future
   */
  deploymentUrl: string | undefined,
  skipConvexDeploymentUrlCheck: boolean,
) {
  const url = deploymentUrl ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const isFromEnv = deploymentUrl === undefined;
  if (typeof url !== "string") {
    throw new Error(
      isFromEnv
        ? `Environment variable NEXT_PUBLIC_CONVEX_URL is not set.`
        : `Convex function called with invalid deployment address.`,
    );
  }
  if (!skipConvexDeploymentUrlCheck) {
    validateDeploymentUrl(url);
  }
  return url!;
}
