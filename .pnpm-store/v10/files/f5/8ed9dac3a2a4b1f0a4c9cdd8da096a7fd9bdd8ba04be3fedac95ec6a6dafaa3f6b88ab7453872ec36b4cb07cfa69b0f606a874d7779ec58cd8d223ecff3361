"use client";

import {
  ComponentType,
  createContext,
  FC,
  forwardRef,
  PropsWithChildren,
  useContext,
  useState,
} from "react";
import { ReadonlyStore } from "../../context/ReadonlyStore";
import { create, UseBoundStore } from "zustand";
import {
  MessagePartStatus,
  ToolCallMessagePartStatus,
} from "../../types/AssistantTypes";
import { useMessagePartRuntime } from "../../context/react/MessagePartContext";
import { createContextStoreHook } from "../../context/react/utils/createContextStoreHook";

type SmoothContextValue = {
  useSmoothStatus: UseBoundStore<
    ReadonlyStore<MessagePartStatus | ToolCallMessagePartStatus>
  >;
};

const SmoothContext = createContext<SmoothContextValue | null>(null);

const makeSmoothContext = (
  initialState: MessagePartStatus | ToolCallMessagePartStatus,
) => {
  const useSmoothStatus = create(() => initialState);
  return { useSmoothStatus };
};

export const SmoothContextProvider: FC<PropsWithChildren> = ({ children }) => {
  const outer = useSmoothContext({ optional: true });
  const MessagePartRuntime = useMessagePartRuntime();

  const [context] = useState(() =>
    makeSmoothContext(MessagePartRuntime.getState().status),
  );

  // do not wrap if there is an outer SmoothContextProvider
  if (outer) return children;

  return (
    <SmoothContext.Provider value={context}>{children}</SmoothContext.Provider>
  );
};

export const withSmoothContextProvider = <C extends ComponentType<any>>(
  Component: C,
): C => {
  const Wrapped = forwardRef((props, ref) => {
    return (
      <SmoothContextProvider>
        <Component {...(props as any)} ref={ref} />
      </SmoothContextProvider>
    );
  });
  Wrapped.displayName = Component.displayName;
  return Wrapped as any;
};

function useSmoothContext(options?: {
  optional?: false | undefined;
}): SmoothContextValue;
function useSmoothContext(options?: {
  optional?: boolean | undefined;
}): SmoothContextValue | null;
function useSmoothContext(options?: { optional?: boolean | undefined }) {
  const context = useContext(SmoothContext);
  if (!options?.optional && !context)
    throw new Error(
      "This component must be used within a SmoothContextProvider.",
    );
  return context;
}

export const { useSmoothStatus, useSmoothStatusStore } = createContextStoreHook(
  useSmoothContext,
  "useSmoothStatus",
);
