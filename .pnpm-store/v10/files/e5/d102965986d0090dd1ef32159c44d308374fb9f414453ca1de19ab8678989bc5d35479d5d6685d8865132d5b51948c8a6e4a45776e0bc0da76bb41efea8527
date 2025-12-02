"use client";

import { type FC, type PropsWithChildren, useEffect, useState } from "react";
import { create } from "zustand";
import {
  ThreadListItemContext,
  type ThreadListItemContextValue,
} from "../react/ThreadListItemContext";
import { writableStore } from "../ReadonlyStore";
import { ThreadListItemRuntime } from "../../api/ThreadListItemRuntime";
import { ensureBinding } from "../react/utils/ensureBinding";

export namespace ThreadListItemRuntimeProvider {
  export type Props = PropsWithChildren<{
    runtime: ThreadListItemRuntime;
  }>;
}

const useThreadListItemRuntimeStore = (runtime: ThreadListItemRuntime) => {
  const [store] = useState(() => create(() => runtime));

  useEffect(() => {
    ensureBinding(runtime);
    writableStore(store).setState(runtime, true);
  }, [runtime, store]);

  return store;
};

export const ThreadListItemRuntimeProvider: FC<
  ThreadListItemRuntimeProvider.Props
> = ({ runtime, children }) => {
  const useThreadListItemRuntime = useThreadListItemRuntimeStore(runtime);
  const [context] = useState<ThreadListItemContextValue>(() => {
    return { useThreadListItemRuntime };
  });

  return (
    <ThreadListItemContext.Provider value={context}>
      {children}
    </ThreadListItemContext.Provider>
  );
};
