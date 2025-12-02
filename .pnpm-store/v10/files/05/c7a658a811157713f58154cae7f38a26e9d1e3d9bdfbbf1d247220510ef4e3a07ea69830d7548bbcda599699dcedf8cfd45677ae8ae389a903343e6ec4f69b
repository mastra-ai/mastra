"use strict";
import { useEffect, useMemo, useState } from "react";
import { useConvex } from "./client.js";
import { QueriesObserver } from "./queries_observer.js";
import { useSubscription } from "./use_subscription.js";
export function useQueries(queries) {
  const convex = useConvex();
  if (convex === void 0) {
    throw new Error(
      "Could not find Convex client! `useQuery` must be used in the React component tree under `ConvexProvider`. Did you forget it? See https://docs.convex.dev/quick-start#set-up-convex-in-your-react-app"
    );
  }
  const createWatch = useMemo(() => {
    return (query, args, journal) => {
      return convex.watchQuery(query, args, journal ? { journal } : {});
    };
  }, [convex]);
  return useQueriesHelper(queries, createWatch);
}
export function useQueriesHelper(queries, createWatch) {
  const [observer] = useState(() => new QueriesObserver(createWatch));
  if (observer.createWatch !== createWatch) {
    observer.setCreateWatch(createWatch);
  }
  useEffect(() => () => observer.destroy(), [observer]);
  const subscription = useMemo(
    () => ({
      getCurrentValue: () => {
        return observer.getLocalResults(queries);
      },
      subscribe: (callback) => {
        observer.setQueries(queries);
        return observer.subscribe(callback);
      }
    }),
    [observer, queries]
  );
  return useSubscription(subscription);
}
//# sourceMappingURL=use_queries.js.map
