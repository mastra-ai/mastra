"use client";

import { type FC, type PropsWithChildren, useEffect, useState } from "react";
import { create } from "zustand";
import { AttachmentContext } from "../react/AttachmentContext";
import { writableStore } from "../ReadonlyStore";
import { AttachmentRuntime } from "../../api/AttachmentRuntime";
import { ensureBinding } from "../react/utils/ensureBinding";

export namespace AttachmentRuntimeProvider {
  export type Props = PropsWithChildren<{
    runtime: AttachmentRuntime;
  }>;
}

const useAttachmentRuntimeStore = (runtime: AttachmentRuntime) => {
  const [store] = useState(() => create(() => runtime));

  useEffect(() => {
    ensureBinding(runtime);

    writableStore(store).setState(runtime, true);
  }, [runtime, store]);

  return store;
};

export const AttachmentRuntimeProvider: FC<AttachmentRuntimeProvider.Props> = ({
  runtime,
  children,
}) => {
  const useAttachmentRuntime = useAttachmentRuntimeStore(runtime);
  const [context] = useState(() => {
    return {
      useAttachmentRuntime,
    };
  });

  return (
    <AttachmentContext.Provider value={context}>
      {children}
    </AttachmentContext.Provider>
  );
};
