"use strict";
import React from "react";
import { useConvexAuth } from "./ConvexAuthState.js";
export function Authenticated({ children }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading || !isAuthenticated) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, children);
}
export function Unauthenticated({ children }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading || isAuthenticated) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, children);
}
export function AuthLoading({ children }) {
  const { isLoading } = useConvexAuth();
  if (!isLoading) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, children);
}
//# sourceMappingURL=auth_helpers.js.map
