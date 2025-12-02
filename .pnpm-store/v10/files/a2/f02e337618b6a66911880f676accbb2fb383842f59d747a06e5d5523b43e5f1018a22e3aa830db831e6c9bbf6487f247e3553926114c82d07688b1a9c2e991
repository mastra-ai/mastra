"use client";

// src/model-context/useInlineRender.tsx
import { useCallback, useEffect, useState } from "react";
import { create } from "zustand";
var useInlineRender = (toolUI) => {
  const [useToolUIStore] = useState(
    () => create(() => ({
      toolUI
    }))
  );
  useEffect(() => {
    useToolUIStore.setState({ toolUI });
  }, [toolUI, useToolUIStore]);
  return useCallback(
    function ToolUI(args) {
      const store = useToolUIStore();
      return store.toolUI(args);
    },
    [useToolUIStore]
  );
};
export {
  useInlineRender
};
//# sourceMappingURL=useInlineRender.js.map