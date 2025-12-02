import { ComponentType, FC, useMemo } from "react";

import {
  CodeComponent,
  CodeHeaderProps,
  PreComponent,
  SyntaxHighlighterProps,
} from "./types";
import { DefaultCodeBlockContent } from "./defaultComponents";
import { Element } from "hast";

export type CodeBlockProps = {
  node: Element | undefined;
  language: string;
  code: string;
  components: {
    Pre: PreComponent;
    Code: CodeComponent;
    CodeHeader: ComponentType<CodeHeaderProps>;
    SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>;
  };
};

export const DefaultCodeBlock: FC<CodeBlockProps> = ({
  node,
  components: { Pre, Code, SyntaxHighlighter, CodeHeader },
  language,
  code,
}) => {
  const components = useMemo(() => ({ Pre, Code }), [Pre, Code]);

  const SH = !!language ? SyntaxHighlighter : DefaultCodeBlockContent;

  return (
    <>
      <CodeHeader node={node} language={language} code={code} />
      <SH
        node={node}
        components={components}
        language={language ?? "unknown"}
        code={code}
      />
    </>
  );
};
