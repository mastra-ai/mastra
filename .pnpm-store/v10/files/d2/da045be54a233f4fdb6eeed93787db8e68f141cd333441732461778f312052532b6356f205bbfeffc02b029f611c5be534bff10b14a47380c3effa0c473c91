"use client";

// src/primitives/actionBar/useActionBarFloatStatus.tsx
import {
  useMessageRuntime,
  useMessageUtilsStore
} from "../../context/react/MessageContext.js";
import { useThreadRuntime } from "../../context/react/ThreadContext.js";
import { useCombinedStore } from "../../utils/combined/useCombinedStore.js";
var HideAndFloatStatus = /* @__PURE__ */ ((HideAndFloatStatus2) => {
  HideAndFloatStatus2["Hidden"] = "hidden";
  HideAndFloatStatus2["Floating"] = "floating";
  HideAndFloatStatus2["Normal"] = "normal";
  return HideAndFloatStatus2;
})(HideAndFloatStatus || {});
var useActionBarFloatStatus = ({
  hideWhenRunning,
  autohide,
  autohideFloat
}) => {
  const threadRuntime = useThreadRuntime();
  const messageRuntime = useMessageRuntime();
  const messageUtilsStore = useMessageUtilsStore();
  return useCombinedStore(
    [threadRuntime, messageRuntime, messageUtilsStore],
    (t, m, mu) => {
      if (hideWhenRunning && t.isRunning) return "hidden" /* Hidden */;
      const autohideEnabled = autohide === "always" || autohide === "not-last" && !m.isLast;
      if (!autohideEnabled) return "normal" /* Normal */;
      if (!mu.isHovering) return "hidden" /* Hidden */;
      if (autohideFloat === "always" || autohideFloat === "single-branch" && m.branchCount <= 1)
        return "floating" /* Floating */;
      return "normal" /* Normal */;
    }
  );
};
export {
  HideAndFloatStatus,
  useActionBarFloatStatus
};
//# sourceMappingURL=useActionBarFloatStatus.js.map