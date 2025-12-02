import { ElementType, ForwardRefExoticComponent, RefAttributes, type ComponentPropsWithoutRef, type ComponentType } from "react";
import { type Options } from "react-markdown";
import { SyntaxHighlighterProps, CodeHeaderProps } from "../overrides/types";
import { Primitive } from "@radix-ui/react-primitive";
type PrimitiveDivProps = ComponentPropsWithoutRef<typeof Primitive.div>;
export type MarkdownTextPrimitiveProps = Omit<Options, "components" | "children"> & {
    className?: string | undefined;
    containerProps?: Omit<PrimitiveDivProps, "children" | "asChild"> | undefined;
    containerComponent?: ElementType | undefined;
    components?: (NonNullable<Options["components"]> & {
        SyntaxHighlighter?: ComponentType<SyntaxHighlighterProps> | undefined;
        CodeHeader?: ComponentType<CodeHeaderProps> | undefined;
    }) | undefined;
    /**
     * Language-specific component overrides.
     * @example { mermaid: { SyntaxHighlighter: MermaidDiagram } }
     */
    componentsByLanguage?: Record<string, {
        CodeHeader?: ComponentType<CodeHeaderProps> | undefined;
        SyntaxHighlighter?: ComponentType<SyntaxHighlighterProps> | undefined;
    }> | undefined;
    smooth?: boolean | undefined;
    /**
     * Function to transform text before markdown processing.
     */
    preprocess?: (text: string) => string;
};
export declare const MarkdownTextPrimitive: ForwardRefExoticComponent<MarkdownTextPrimitiveProps> & RefAttributes<HTMLDivElement>;
export {};
//# sourceMappingURL=MarkdownText.d.ts.map