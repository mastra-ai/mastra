import {
  pathToRegexp
} from "./chunk-JJHTUJGL.mjs";

// src/pathMatcher.ts
var precomputePathRegex = (patterns) => {
  return patterns.map((pattern) => pattern instanceof RegExp ? pattern : pathToRegexp(pattern));
};
var createPathMatcher = (patterns) => {
  const routePatterns = [patterns || ""].flat().filter(Boolean);
  const matchers = precomputePathRegex(routePatterns);
  return (pathname) => matchers.some((matcher) => matcher.test(pathname));
};

export {
  createPathMatcher
};
//# sourceMappingURL=chunk-2ZNADCNC.mjs.map