"use client";

import { FC, useCallback, useEffect, useState } from "react";
import { ToolCallMessagePartProps } from "../types";
import { create } from "zustand";

export const useInlineRender = <TArgs, TResult>(
  toolUI: FC<ToolCallMessagePartProps<TArgs, TResult>>,
): FC<ToolCallMessagePartProps<TArgs, TResult>> => {
  const [useToolUIStore] = useState(() =>
    create(() => ({
      toolUI,
    })),
  );

  useEffect(() => {
    useToolUIStore.setState({ toolUI });
  }, [toolUI, useToolUIStore]);

  return useCallback(
    function ToolUI(args) {
      const store = useToolUIStore();
      return store.toolUI(args);
    },
    [useToolUIStore],
  );
};
