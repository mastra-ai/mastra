// src/memoization.tsx
import { memo } from "react";
import { jsx } from "react/jsx-runtime";
var areChildrenEqual = (prev, next) => {
  if (typeof prev === "string") return prev === next;
  return JSON.stringify(prev) === JSON.stringify(next);
};
var areNodesEqual = (prev, next) => {
  if (!prev || !next) return false;
  const excludeMetadata = (props) => {
    const { position, data, ...rest } = props || {};
    return rest;
  };
  return JSON.stringify(excludeMetadata(prev.properties)) === JSON.stringify(excludeMetadata(next.properties)) && areChildrenEqual(prev.children, next.children);
};
var memoCompareNodes = (prev, next) => {
  return areNodesEqual(prev.node, next.node);
};
var memoizeMarkdownComponents = (components = {}) => {
  return Object.fromEntries(
    Object.entries(components ?? {}).map(([key, value]) => {
      if (!value) return [key, value];
      const Component = value;
      const WithoutNode = ({ node, ...props }) => {
        return /* @__PURE__ */ jsx(Component, { ...props });
      };
      return [key, memo(WithoutNode, memoCompareNodes)];
    })
  );
};
export {
  areNodesEqual,
  memoCompareNodes,
  memoizeMarkdownComponents
};
//# sourceMappingURL=memoization.js.map