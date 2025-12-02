"use client";

// src/primitives/composer/ComposerIf.tsx
import { useComposer } from "../../context/react/ComposerContext.js";
var useComposerIf = (props) => {
  return useComposer((composer) => {
    if (props.editing === true && !composer.isEditing) return false;
    if (props.editing === false && composer.isEditing) return false;
    return true;
  });
};
var ComposerPrimitiveIf = ({
  children,
  ...query
}) => {
  const result = useComposerIf(query);
  return result ? children : null;
};
ComposerPrimitiveIf.displayName = "ComposerPrimitive.If";
export {
  ComposerPrimitiveIf
};
//# sourceMappingURL=ComposerIf.js.map