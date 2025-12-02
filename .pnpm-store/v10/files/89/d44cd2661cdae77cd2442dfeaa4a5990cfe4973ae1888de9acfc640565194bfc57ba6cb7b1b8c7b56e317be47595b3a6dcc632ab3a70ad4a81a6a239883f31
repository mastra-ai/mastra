"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/router.ts
var router_exports = {};
__export(router_exports, {
  ClerkHostRouterContext: () => ClerkHostRouterContext,
  ClerkRouterContext: () => ClerkRouterContext,
  Route: () => Route,
  Router: () => Router,
  createClerkRouter: () => createClerkRouter,
  useClerkHostRouter: () => useClerkHostRouter,
  useClerkRouter: () => useClerkRouter
});
module.exports = __toCommonJS(router_exports);

// src/url.ts
var TRAILING_SLASH_RE = /\/$|\/\?|\/#/;
function hasTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return input.endsWith("/");
  }
  return TRAILING_SLASH_RE.test(input);
}
function withoutTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return (hasTrailingSlash(input) ? input.slice(0, -1) : input) || "/";
  }
  if (!hasTrailingSlash(input, true)) {
    return input || "/";
  }
  let path = input;
  let fragment = "";
  const fragmentIndex = input.indexOf("#");
  if (fragmentIndex >= 0) {
    path = input.slice(0, fragmentIndex);
    fragment = input.slice(fragmentIndex);
  }
  const [s0, ...s] = path.split("?");
  return (s0.slice(0, -1) || "/") + (s.length > 0 ? `?${s.join("?")}` : "") + fragment;
}
function hasLeadingSlash(input = "") {
  return input.startsWith("/");
}
function withLeadingSlash(input = "") {
  return hasLeadingSlash(input) ? input : "/" + input;
}
var ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/;
var isAbsoluteUrl = (url) => ABSOLUTE_URL_REGEX.test(url);

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
var import_react = __toESM(require("react"));
var ClerkHostRouterContext = (0, import_react.createContext)(null);
var ClerkRouterContext = (0, import_react.createContext)(null);
function useClerkHostRouter() {
  const ctx = (0, import_react.useContext)(ClerkHostRouterContext);
  if (!ctx) {
    throw new Error(
      "clerk: Unable to locate ClerkHostRouter, make sure this is rendered within `<ClerkHostRouterContext.Provider>`."
    );
  }
  return ctx;
}
function useClerkRouter() {
  const ctx = (0, import_react.useContext)(ClerkRouterContext);
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
  return /* @__PURE__ */ import_react.default.createElement(ClerkRouterContext.Provider, { value: clerkRouter }, children);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ClerkHostRouterContext,
  ClerkRouterContext,
  Route,
  Router,
  createClerkRouter,
  useClerkHostRouter,
  useClerkRouter
});
//# sourceMappingURL=router.js.map