import { ComponentPropsWithoutRef, ComponentType } from "react";
import { CodeComponent, CodeHeaderProps, PreComponent, SyntaxHighlighterProps } from "./types";
export type CodeOverrideProps = ComponentPropsWithoutRef<CodeComponent> & {
    components: {
        Pre: PreComponent;
        Code: CodeComponent;
        CodeHeader: ComponentType<CodeHeaderProps>;
        SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>;
    };
    componentsByLanguage?: Record<string, {
        CodeHeader?: ComponentType<CodeHeaderProps>;
        SyntaxHighlighter?: ComponentType<SyntaxHighlighterProps>;
    }> | undefined;
};
export declare const CodeOverride: import("react").NamedExoticComponent<CodeOverrideProps>;
//# sourceMappingURL=CodeOverride.d.ts.map