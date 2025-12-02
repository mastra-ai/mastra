"use strict";
import { useMemo } from "react";
import { useQuery } from "../react/client.js";
import { makeFunctionReference } from "../server/api.js";
import { jsonToConvex } from "../values/index.js";
export function usePreloadedQuery(preloadedQuery) {
  const args = useMemo(
    () => jsonToConvex(preloadedQuery._argsJSON),
    [preloadedQuery._argsJSON]
  );
  const preloadedResult = useMemo(
    () => jsonToConvex(preloadedQuery._valueJSON),
    [preloadedQuery._valueJSON]
  );
  const result = useQuery(
    makeFunctionReference(preloadedQuery._name),
    args
  );
  return result === void 0 ? preloadedResult : result;
}
//# sourceMappingURL=hydration.js.map
