import { Element } from "hast";
import { ComponentProps, ComponentType, ElementType } from "react";
import { CodeHeaderProps, SyntaxHighlighterProps } from "./overrides/types";
type Components = {
    [Key in Extract<ElementType, string>]?: ComponentType<ComponentProps<Key>>;
} & {
    SyntaxHighlighter?: ComponentType<Omit<SyntaxHighlighterProps, "node">> | undefined;
    CodeHeader?: ComponentType<Omit<CodeHeaderProps, "node">> | undefined;
};
export declare const areNodesEqual: (prev: Element | undefined, next: Element | undefined) => boolean;
export declare const memoCompareNodes: (prev: {
    node?: Element | undefined;
}, next: {
    node?: Element | undefined;
}) => boolean;
export declare const memoizeMarkdownComponents: (components?: Components) => {
    [k: string]: import("react").MemoExoticComponent<({ node, ...props }: {
        node?: Element;
    }) => import("react/jsx-runtime").JSX.Element> | undefined;
};
export {};
//# sourceMappingURL=memoization.d.ts.map