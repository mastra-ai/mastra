import type { ComponentType, ReactNode } from "react";
import { PreComponent, CodeComponent, CodeHeaderProps } from "./types";
import { Element } from "hast";

export const DefaultPre: PreComponent = ({ node, ...rest }) => (
  <pre {...rest} />
);

export const DefaultCode: CodeComponent = ({ node, ...rest }) => (
  <code {...rest} />
);

export const DefaultCodeBlockContent: ComponentType<{
  node: Element | undefined;
  components: { Pre: PreComponent; Code: CodeComponent };
  code: string | ReactNode | undefined;
}> = ({ node, components: { Pre, Code }, code }) => (
  <Pre>
    <Code node={node}>{code}</Code>
  </Pre>
);

export const DefaultCodeHeader: ComponentType<CodeHeaderProps> = () => null;
