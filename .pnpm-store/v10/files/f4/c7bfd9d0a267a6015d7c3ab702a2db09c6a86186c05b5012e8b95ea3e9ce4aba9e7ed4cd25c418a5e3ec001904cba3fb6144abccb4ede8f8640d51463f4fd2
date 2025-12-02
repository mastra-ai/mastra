"use client";

// src/overrides/PreOverride.tsx
import {
  createContext,
  useContext,
  memo
} from "react";
import { memoCompareNodes } from "../memoization.js";
import { jsx } from "react/jsx-runtime";
var PreContext = createContext(null);
var useIsMarkdownCodeBlock = () => {
  return useContext(PreContext) !== null;
};
var PreOverrideImpl = ({ children, ...rest }) => {
  return /* @__PURE__ */ jsx(PreContext.Provider, { value: rest, children });
};
var PreOverride = memo(PreOverrideImpl, memoCompareNodes);
export {
  PreContext,
  PreOverride,
  useIsMarkdownCodeBlock
};
//# sourceMappingURL=PreOverride.js.map