"use client";

import { createContext, FC, ReactNode, useContext } from "react";
import { ThreadHistoryAdapter } from "./thread-history/ThreadHistoryAdapter";
import { AttachmentAdapter } from "./attachment/AttachmentAdapter";
import { ModelContextProvider } from "../../model-context";

export type RuntimeAdapters = {
  modelContext?: ModelContextProvider;
  history?: ThreadHistoryAdapter;
  attachments?: AttachmentAdapter;
};

const RuntimeAdaptersContext = createContext<RuntimeAdapters | null>(null);

namespace RuntimeAdapterProvider {
  export type Props = {
    adapters: RuntimeAdapters;
    children: ReactNode;
  };
}

export const RuntimeAdapterProvider: FC<RuntimeAdapterProvider.Props> = ({
  adapters,
  children,
}) => {
  const context = useContext(RuntimeAdaptersContext);
  return (
    <RuntimeAdaptersContext.Provider
      value={{
        ...context,
        ...adapters,
      }}
    >
      {children}
    </RuntimeAdaptersContext.Provider>
  );
};

export const useRuntimeAdapters = () => {
  const adapters = useContext(RuntimeAdaptersContext);
  return adapters;
};
