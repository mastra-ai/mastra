// src/overrides/CodeOverride.tsx
import {
  memo,
  useContext
} from "react";
import { PreContext, useIsMarkdownCodeBlock } from "./PreOverride.js";
import { DefaultCodeBlock } from "./CodeBlock.js";
import { useCallbackRef } from "@radix-ui/react-use-callback-ref";
import { withDefaultProps } from "./withDefaults.js";
import { DefaultCodeBlockContent } from "./defaultComponents.js";
import { memoCompareNodes } from "../memoization.js";
import { jsx } from "react/jsx-runtime";
var CodeBlockOverride = ({
  node,
  components: {
    Pre,
    Code,
    SyntaxHighlighter: FallbackSyntaxHighlighter,
    CodeHeader: FallbackCodeHeader
  },
  componentsByLanguage = {},
  children,
  ...codeProps
}) => {
  const preProps = useContext(PreContext);
  const getPreProps = withDefaultProps(preProps);
  const WrappedPre = useCallbackRef((props) => /* @__PURE__ */ jsx(Pre, { ...getPreProps(props) }));
  const getCodeProps = withDefaultProps(codeProps);
  const WrappedCode = useCallbackRef((props) => /* @__PURE__ */ jsx(Code, { ...getCodeProps(props) }));
  const language = /language-(\w+)/.exec(codeProps.className || "")?.[1] ?? "";
  if (typeof children !== "string") {
    return /* @__PURE__ */ jsx(
      DefaultCodeBlockContent,
      {
        node,
        components: { Pre: WrappedPre, Code: WrappedCode },
        code: children
      }
    );
  }
  const SyntaxHighlighter = componentsByLanguage[language]?.SyntaxHighlighter ?? FallbackSyntaxHighlighter;
  const CodeHeader = componentsByLanguage[language]?.CodeHeader ?? FallbackCodeHeader;
  return /* @__PURE__ */ jsx(
    DefaultCodeBlock,
    {
      node,
      components: {
        Pre: WrappedPre,
        Code: WrappedCode,
        SyntaxHighlighter,
        CodeHeader
      },
      language: language || "unknown",
      code: children
    }
  );
};
var CodeOverrideImpl = ({
  node,
  components,
  componentsByLanguage,
  ...props
}) => {
  const isCodeBlock = useIsMarkdownCodeBlock();
  if (!isCodeBlock) return /* @__PURE__ */ jsx(components.Code, { ...props });
  return /* @__PURE__ */ jsx(
    CodeBlockOverride,
    {
      node,
      components,
      componentsByLanguage,
      ...props
    }
  );
};
var CodeOverride = memo(CodeOverrideImpl, (prev, next) => {
  const isEqual = prev.components === next.components && prev.componentsByLanguage === next.componentsByLanguage && memoCompareNodes(prev, next);
  return isEqual;
});
export {
  CodeOverride
};
//# sourceMappingURL=CodeOverride.js.map