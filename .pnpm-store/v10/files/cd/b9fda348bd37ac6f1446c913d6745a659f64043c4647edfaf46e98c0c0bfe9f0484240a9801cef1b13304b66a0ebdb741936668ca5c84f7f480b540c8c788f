"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var use_queries_exports = {};
__export(use_queries_exports, {
  useQueries: () => useQueries,
  useQueriesHelper: () => useQueriesHelper
});
module.exports = __toCommonJS(use_queries_exports);
var import_react = require("react");
var import_client = require("./client.js");
var import_queries_observer = require("./queries_observer.js");
var import_use_subscription = require("./use_subscription.js");
function useQueries(queries) {
  const convex = (0, import_client.useConvex)();
  if (convex === void 0) {
    throw new Error(
      "Could not find Convex client! `useQuery` must be used in the React component tree under `ConvexProvider`. Did you forget it? See https://docs.convex.dev/quick-start#set-up-convex-in-your-react-app"
    );
  }
  const createWatch = (0, import_react.useMemo)(() => {
    return (query, args, journal) => {
      return convex.watchQuery(query, args, journal ? { journal } : {});
    };
  }, [convex]);
  return useQueriesHelper(queries, createWatch);
}
function useQueriesHelper(queries, createWatch) {
  const [observer] = (0, import_react.useState)(() => new import_queries_observer.QueriesObserver(createWatch));
  if (observer.createWatch !== createWatch) {
    observer.setCreateWatch(createWatch);
  }
  (0, import_react.useEffect)(() => () => observer.destroy(), [observer]);
  const subscription = (0, import_react.useMemo)(
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
  return (0, import_use_subscription.useSubscription)(subscription);
}
//# sourceMappingURL=use_queries.js.map
