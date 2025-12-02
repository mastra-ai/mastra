import {
  isAbsoluteUrl,
  withLeadingSlash,
  withoutTrailingSlash
} from "./chunk-IFTVZ2LQ.mjs";
import "./chunk-3TMSNP4L.mjs";
import "./chunk-I6MTSTOF.mjs";
import "./chunk-IEP6GGEX.mjs";

// src/router/router.ts
var PRESERVED_QUERYSTRING_PARAMS = ["after_sign_in_url", "after_sign_up_url", "redirect_url"];
function normalizePath(path) {
  return withoutTrailingSlash(withLeadingSlash(path));
}
function createClerkRouter(router, basePath = "/") {
  const normalizedBasePath = normalizePath(basePath);
  function makeDestinationUrlWithPreservedQueryParameters(path) {
    if (isAbsoluteUrl(path)) {
      return path;
    }
    const destinationUrl = new URL(path, window.location.origin);
    const currentSearchParams = router.searchParams();
    PRESERVED_QUERYSTRING_PARAMS.forEach((key) => {
      const maybeValue = currentSearchParams.get(key);
      if (maybeValue) {
        destinationUrl.searchParams.set(key, maybeValue);
      }
    });
    return `${destinationUrl.pathname}${destinationUrl.search}`;
  }
  function match(path, index) {
    const pathToMatch = path ?? (index && "/");
    if (!pathToMatch) {
      throw new Error("[clerk] router.match() requires either a path to match, or the index flag must be set to true.");
    }
    const normalizedPath = normalizePath(pathToMatch);
    return normalizePath(`${normalizedBasePath}${normalizedPath}`) === normalizePath(router.pathname());
  }
  function child(childBasePath) {
    return createClerkRouter(router, `${normalizedBasePath}${normalizePath(childBasePath)}`);
  }
  function push(path) {
    const destinationUrl = makeDestinationUrlWithPreservedQueryParameters(path);
    return router.push(destinationUrl);
  }
  function replace(path) {
    const destinationUrl = makeDestinationUrlWithPreservedQueryParameters(path);
    return router.replace(destinationUrl);
  }
  function shallowPush(path) {
    const destinationUrl = makeDestinationUrlWithPreservedQueryParameters(path);
    return router.shallowPush(destinationUrl);
  }
  function pathname() {
    return router.pathname();
  }
  function searchParams() {
    return router.searchParams();
  }
  return {
    makeDestinationUrlWithPreservedQueryParameters,
    child,
    match,
    mode: router.mode,
    name: router.name,
    push,
    replace,
    shallowPush,
    pathname,
    searchParams,
    basePath: normalizedBasePath
  };
}

// src/router/react.tsx
import React, { createContext, useContext } from "react";
var ClerkHostRouterContext = createContext(null);
var ClerkRouterContext = createContext(null);
function useClerkHostRouter() {
  const ctx = useContext(ClerkHostRouterContext);
  if (!ctx) {
    throw new Error(
      "clerk: Unable to locate ClerkHostRouter, make sure this is rendered within `<ClerkHostRouterContext.Provider>`."
    );
  }
  return ctx;
}
function useClerkRouter() {
  const ctx = useContext(ClerkRouterContext);
  if (!ctx) {
    throw new Error("clerk: Unable to locate ClerkRouter, make sure this is rendered within `<Router>`.");
  }
  return ctx;
}
function Router({
  basePath,
  children,
  router
}) {
  const hostRouter = useClerkHostRouter();
  const clerkRouter = createClerkRouter(router ?? hostRouter, basePath);
  return /* @__PURE__ */ React.createElement(ClerkRouterContext.Provider, { value: clerkRouter }, children);
}
function Route({ path, children, index }) {
  const parentRouter = useClerkRouter();
  if (!path && !index) {
    return children;
  }
  if (!parentRouter?.match(path, index)) {
    return null;
  }
  return children;
}
export {
  ClerkHostRouterContext,
  ClerkRouterContext,
  Route,
  Router,
  createClerkRouter,
  useClerkHostRouter,
  useClerkRouter
};
//# sourceMappingURL=router.mjs.map