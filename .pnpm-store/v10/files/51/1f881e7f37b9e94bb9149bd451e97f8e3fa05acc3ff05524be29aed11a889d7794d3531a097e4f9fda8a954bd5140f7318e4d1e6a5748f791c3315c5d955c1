// src/overrides/CodeBlock.tsx
import { useMemo } from "react";
import { DefaultCodeBlockContent } from "./defaultComponents.js";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var DefaultCodeBlock = ({
  node,
  components: { Pre, Code, SyntaxHighlighter, CodeHeader },
  language,
  code
}) => {
  const components = useMemo(() => ({ Pre, Code }), [Pre, Code]);
  const SH = !!language ? SyntaxHighlighter : DefaultCodeBlockContent;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(CodeHeader, { node, language, code }),
    /* @__PURE__ */ jsx(
      SH,
      {
        node,
        components,
        language: language ?? "unknown",
        code
      }
    )
  ] });
};
export {
  DefaultCodeBlock
};
//# sourceMappingURL=CodeBlock.js.map