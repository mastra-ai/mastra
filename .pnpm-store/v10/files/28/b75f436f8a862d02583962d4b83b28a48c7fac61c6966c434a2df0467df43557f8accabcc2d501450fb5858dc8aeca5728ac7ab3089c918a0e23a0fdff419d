"use client";

// src/primitives/composer/ComposerCancel.tsx
import {
  createActionButton
} from "../../utils/createActionButton.js";
import { useCallback } from "react";
import { useComposer, useComposerRuntime } from "../../context/index.js";
var useComposerCancel = () => {
  const composerRuntime = useComposerRuntime();
  const disabled = useComposer((c) => !c.canCancel);
  const callback = useCallback(() => {
    composerRuntime.cancel();
  }, [composerRuntime]);
  if (disabled) return null;
  return callback;
};
var ComposerPrimitiveCancel = createActionButton(
  "ComposerPrimitive.Cancel",
  useComposerCancel
);
export {
  ComposerPrimitiveCancel
};
//# sourceMappingURL=ComposerCancel.js.map