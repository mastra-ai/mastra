import { useMemo } from "react";
import { useQuery } from "../react/client.js";
import { FunctionReference, makeFunctionReference } from "../server/api.js";
import { jsonToConvex } from "../values/index.js";

/**
 * The preloaded query payload, which should be passed to a client component
 * and passed to {@link usePreloadedQuery}.
 *
 * @public
 */
export type Preloaded<Query extends FunctionReference<"query">> = {
  __type: Query;
  _name: string;
  _argsJSON: string;
  _valueJSON: string;
};

/**
 * Load a reactive query within a React component using a `Preloaded` payload
 * from a Server Component returned by {@link nextjs.preloadQuery}.
 *
 * This React hook contains internal state that will cause a rerender
 * whenever the query result changes.
 *
 * Throws an error if not used under {@link ConvexProvider}.
 *
 * @param preloadedQuery - The `Preloaded` query payload from a Server Component.
 * @returns the result of the query. Initially returns the result fetched
 * by the Server Component. Subsequently returns the result fetched by the client.
 *
 * @public
 */
export function usePreloadedQuery<Query extends FunctionReference<"query">>(
  preloadedQuery: Preloaded<Query>,
): Query["_returnType"] {
  const args = useMemo(
    () => jsonToConvex(preloadedQuery._argsJSON),
    [preloadedQuery._argsJSON],
  ) as Query["_args"];
  const preloadedResult = useMemo(
    () => jsonToConvex(preloadedQuery._valueJSON),
    [preloadedQuery._valueJSON],
  );
  const result = useQuery(
    makeFunctionReference(preloadedQuery._name) as Query,
    args,
  );
  return result === undefined ? preloadedResult : result;
}
