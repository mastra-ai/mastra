"use client";

// src/primitives/MarkdownText.tsx
import { INTERNAL, useMessagePartText } from "@assistant-ui/react";
import {
  forwardRef,
  useMemo
} from "react";
import ReactMarkdown from "react-markdown";
import { PreOverride } from "../overrides/PreOverride.js";
import {
  DefaultPre,
  DefaultCode,
  DefaultCodeBlockContent,
  DefaultCodeHeader
} from "../overrides/defaultComponents.js";
import { useCallbackRef } from "@radix-ui/react-use-callback-ref";
import { CodeOverride } from "../overrides/CodeOverride.js";
import classNames from "classnames";
import { jsx } from "react/jsx-runtime";
var { useSmooth, useSmoothStatus, withSmoothContextProvider } = INTERNAL;
var MarkdownTextInner = ({
  components: userComponents,
  componentsByLanguage,
  smooth = true,
  preprocess,
  ...rest
}) => {
  const messagePartText = useMessagePartText();
  const processedMessagePart = useMemo(() => {
    if (!preprocess) return messagePartText;
    return {
      ...messagePartText,
      text: preprocess(messagePartText.text)
    };
  }, [messagePartText, preprocess]);
  const { text } = useSmooth(processedMessagePart, smooth);
  const {
    pre = DefaultPre,
    code = DefaultCode,
    SyntaxHighlighter = DefaultCodeBlockContent,
    CodeHeader = DefaultCodeHeader
  } = userComponents ?? {};
  const useCodeOverrideComponents = useMemo(() => {
    return {
      Pre: pre,
      Code: code,
      SyntaxHighlighter,
      CodeHeader
    };
  }, [pre, code, SyntaxHighlighter, CodeHeader]);
  const CodeComponent = useCallbackRef((props) => /* @__PURE__ */ jsx(
    CodeOverride,
    {
      components: useCodeOverrideComponents,
      componentsByLanguage,
      ...props
    }
  ));
  const components = useMemo(() => {
    const { pre: pre2, code: code2, SyntaxHighlighter: SyntaxHighlighter2, CodeHeader: CodeHeader2, ...componentsRest } = userComponents ?? {};
    return {
      ...componentsRest,
      pre: PreOverride,
      code: CodeComponent
    };
  }, [CodeComponent, userComponents]);
  return /* @__PURE__ */ jsx(ReactMarkdown, { components, ...rest, children: text });
};
var MarkdownTextPrimitiveImpl = forwardRef(
  ({
    className,
    containerProps,
    containerComponent: Container = "div",
    ...rest
  }, forwardedRef) => {
    const status = useSmoothStatus();
    return /* @__PURE__ */ jsx(
      Container,
      {
        "data-status": status.type,
        ...containerProps,
        className: classNames(className, containerProps?.className),
        ref: forwardedRef,
        children: /* @__PURE__ */ jsx(MarkdownTextInner, { ...rest })
      }
    );
  }
);
MarkdownTextPrimitiveImpl.displayName = "MarkdownTextPrimitive";
var MarkdownTextPrimitive = withSmoothContextProvider(
  MarkdownTextPrimitiveImpl
);
export {
  MarkdownTextPrimitive
};
//# sourceMappingURL=MarkdownText.js.map