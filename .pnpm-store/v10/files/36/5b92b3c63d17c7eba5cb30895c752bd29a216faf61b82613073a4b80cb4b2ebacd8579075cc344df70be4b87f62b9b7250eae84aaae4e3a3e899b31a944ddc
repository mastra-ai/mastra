import { Element } from "hast";
import { ComponentPropsWithoutRef, ComponentType } from "react";
export type PreComponent = ComponentType<ComponentPropsWithoutRef<"pre"> & {
    node?: Element | undefined;
}>;
export type CodeComponent = ComponentType<ComponentPropsWithoutRef<"code"> & {
    node?: Element | undefined;
}>;
export type CodeHeaderProps = {
    node?: Element | undefined;
    language: string | undefined;
    code: string;
};
export type SyntaxHighlighterProps = {
    node?: Element | undefined;
    components: {
        Pre: PreComponent;
        Code: CodeComponent;
    };
    language: string;
    code: string;
};
//# sourceMappingURL=types.d.ts.map