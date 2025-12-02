import { Element } from "hast";
import { ComponentProps, ComponentType, ElementType, memo } from "react";
import { CodeHeaderProps, SyntaxHighlighterProps } from "./overrides/types";

type Components = {
  [Key in Extract<ElementType, string>]?: ComponentType<ComponentProps<Key>>;
} & {
  SyntaxHighlighter?:
    | ComponentType<Omit<SyntaxHighlighterProps, "node">>
    | undefined;
  CodeHeader?: ComponentType<Omit<CodeHeaderProps, "node">> | undefined;
};

const areChildrenEqual = (prev: string | unknown, next: string | unknown) => {
  if (typeof prev === "string") return prev === next;
  return JSON.stringify(prev) === JSON.stringify(next);
};

export const areNodesEqual = (
  prev: Element | undefined,
  next: Element | undefined,
) => {
  if (!prev || !next) return false;

  const excludeMetadata = (props: Element["properties"]) => {
    const { position, data, ...rest } =
      (props as Record<string, unknown>) || {};
    return rest;
  };

  return (
    JSON.stringify(excludeMetadata(prev.properties)) ===
      JSON.stringify(excludeMetadata(next.properties)) &&
    areChildrenEqual(prev.children, next.children)
  );
};

export const memoCompareNodes = (
  prev: { node?: Element | undefined },
  next: { node?: Element | undefined },
) => {
  return areNodesEqual(prev.node, next.node);
};

export const memoizeMarkdownComponents = (components: Components = {}) => {
  return Object.fromEntries(
    Object.entries(components ?? {}).map(([key, value]) => {
      if (!value) return [key, value];

      const Component = value as ComponentType;
      const WithoutNode = ({ node, ...props }: { node?: Element }) => {
        return <Component {...props} />;
      };
      return [key, memo(WithoutNode, memoCompareNodes)];
    }),
  );
};
