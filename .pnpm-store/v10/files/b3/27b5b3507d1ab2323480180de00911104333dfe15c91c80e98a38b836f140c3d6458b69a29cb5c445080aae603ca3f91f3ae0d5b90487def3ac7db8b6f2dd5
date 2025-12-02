import {
  ComponentPropsWithoutRef,
  ComponentType,
  FC,
  memo,
  useContext,
} from "react";
import { PreContext, useIsMarkdownCodeBlock } from "./PreOverride";
import {
  CodeComponent,
  CodeHeaderProps,
  PreComponent,
  SyntaxHighlighterProps,
} from "./types";
import { DefaultCodeBlock } from "./CodeBlock";
import { useCallbackRef } from "@radix-ui/react-use-callback-ref";
import { withDefaultProps } from "./withDefaults";
import { DefaultCodeBlockContent } from "./defaultComponents";
import { memoCompareNodes } from "../memoization";

const CodeBlockOverride: FC<CodeOverrideProps> = ({
  node,
  components: {
    Pre,
    Code,
    SyntaxHighlighter: FallbackSyntaxHighlighter,
    CodeHeader: FallbackCodeHeader,
  },
  componentsByLanguage = {},
  children,
  ...codeProps
}) => {
  const preProps = useContext(PreContext)!;
  const getPreProps = withDefaultProps<any>(preProps);
  const WrappedPre: PreComponent = useCallbackRef((props) => (
    <Pre {...getPreProps(props)} />
  ));

  const getCodeProps = withDefaultProps<any>(codeProps);
  const WrappedCode: CodeComponent = useCallbackRef((props) => (
    <Code {...getCodeProps(props)} />
  ));

  const language = /language-(\w+)/.exec(codeProps.className || "")?.[1] ?? "";

  // if the code content is not string (due to rehype plugins), return a default code block
  if (typeof children !== "string") {
    return (
      <DefaultCodeBlockContent
        node={node}
        components={{ Pre: WrappedPre, Code: WrappedCode }}
        code={children}
      />
    );
  }

  const SyntaxHighlighter: ComponentType<SyntaxHighlighterProps> =
    componentsByLanguage[language]?.SyntaxHighlighter ??
    FallbackSyntaxHighlighter;

  const CodeHeader: ComponentType<CodeHeaderProps> =
    componentsByLanguage[language]?.CodeHeader ?? FallbackCodeHeader;

  return (
    <DefaultCodeBlock
      node={node}
      components={{
        Pre: WrappedPre,
        Code: WrappedCode,
        SyntaxHighlighter,
        CodeHeader,
      }}
      language={language || "unknown"}
      code={children}
    />
  );
};

export type CodeOverrideProps = ComponentPropsWithoutRef<CodeComponent> & {
  components: {
    Pre: PreComponent;
    Code: CodeComponent;
    CodeHeader: ComponentType<CodeHeaderProps>;
    SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>;
  };
  componentsByLanguage?:
    | Record<
        string,
        {
          CodeHeader?: ComponentType<CodeHeaderProps>;
          SyntaxHighlighter?: ComponentType<SyntaxHighlighterProps>;
        }
      >
    | undefined;
};

const CodeOverrideImpl: FC<CodeOverrideProps> = ({
  node,
  components,
  componentsByLanguage,
  ...props
}) => {
  const isCodeBlock = useIsMarkdownCodeBlock();
  if (!isCodeBlock) return <components.Code {...props} />;
  return (
    <CodeBlockOverride
      node={node}
      components={components}
      componentsByLanguage={componentsByLanguage}
      {...props}
    />
  );
};

export const CodeOverride = memo(CodeOverrideImpl, (prev, next) => {
  const isEqual =
    prev.components === next.components &&
    prev.componentsByLanguage === next.componentsByLanguage &&
    memoCompareNodes(prev, next);
  return isEqual;
});
