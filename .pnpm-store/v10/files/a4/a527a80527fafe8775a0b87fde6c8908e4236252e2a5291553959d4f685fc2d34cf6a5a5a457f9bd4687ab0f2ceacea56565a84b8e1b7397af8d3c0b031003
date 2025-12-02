"use client";

// src/runtimes/remote-thread-list/RemoteThreadListHookInstanceManager.tsx
import {
  useCallback,
  useRef,
  useEffect,
  memo,
  useMemo
} from "react";
import { create } from "zustand";
import { useAssistantRuntime } from "../../context/index.js";
import { ThreadListItemRuntimeProvider } from "../../context/providers/ThreadListItemRuntimeProvider.js";
import {
  useThreadListItem,
  useThreadListItemRuntime
} from "../../context/react/ThreadListItemContext.js";
import { BaseSubscribable } from "./BaseSubscribable.js";
import { jsx } from "react/jsx-runtime";
var RemoteThreadListHookInstanceManager = class extends BaseSubscribable {
  useRuntimeHook;
  instances = /* @__PURE__ */ new Map();
  useAliveThreadsKeysChanged = create(() => ({}));
  constructor(runtimeHook) {
    super();
    this.useRuntimeHook = create(() => ({ useRuntime: runtimeHook }));
  }
  startThreadRuntime(threadId) {
    if (!this.instances.has(threadId)) {
      this.instances.set(threadId, {});
      this.useAliveThreadsKeysChanged.setState({}, true);
    }
    return new Promise((resolve, reject) => {
      const callback = () => {
        const instance = this.instances.get(threadId);
        if (!instance) {
          dispose();
          reject(new Error("Thread was deleted before runtime was started"));
        } else if (!instance.runtime) {
          return;
        } else {
          dispose();
          resolve(instance.runtime);
        }
      };
      const dispose = this.subscribe(callback);
      callback();
    });
  }
  getThreadRuntimeCore(threadId) {
    const instance = this.instances.get(threadId);
    if (!instance) return void 0;
    return instance.runtime;
  }
  stopThreadRuntime(threadId) {
    this.instances.delete(threadId);
    this.useAliveThreadsKeysChanged.setState({}, true);
  }
  setRuntimeHook(newRuntimeHook) {
    const prevRuntimeHook = this.useRuntimeHook.getState().useRuntime;
    if (prevRuntimeHook !== newRuntimeHook) {
      this.useRuntimeHook.setState({ useRuntime: newRuntimeHook }, true);
    }
  }
  _InnerActiveThreadProvider = () => {
    const { id } = useThreadListItem();
    const { useRuntime } = this.useRuntimeHook();
    const runtime = useRuntime();
    const threadBinding = runtime.thread.__internal_threadBinding;
    const updateRuntime = useCallback(() => {
      const aliveThread = this.instances.get(id);
      if (!aliveThread)
        throw new Error("Thread not found. This is a bug in assistant-ui.");
      aliveThread.runtime = threadBinding.getState();
      if (isMounted) {
        this._notifySubscribers();
      }
    }, [id, threadBinding]);
    const isMounted = useRef(false);
    if (!isMounted.current) {
      updateRuntime();
    }
    useEffect(() => {
      isMounted.current = true;
      updateRuntime();
      return threadBinding.outerSubscribe(updateRuntime);
    }, [threadBinding, updateRuntime]);
    const threadListItemRuntime = useThreadListItemRuntime();
    useEffect(() => {
      return runtime.threads.main.unstable_on("initialize", () => {
        if (threadListItemRuntime.getState().status === "new") {
          threadListItemRuntime.initialize();
          const dispose = runtime.thread.unstable_on("run-end", () => {
            dispose();
            threadListItemRuntime.generateTitle();
          });
        }
      });
    }, [runtime, threadListItemRuntime]);
    return null;
  };
  _OuterActiveThreadProvider = memo(({ threadId, provider: Provider }) => {
    const assistantRuntime = useAssistantRuntime();
    const threadListItemRuntime = useMemo(
      () => assistantRuntime.threads.getItemById(threadId),
      [assistantRuntime, threadId]
    );
    return /* @__PURE__ */ jsx(ThreadListItemRuntimeProvider, { runtime: threadListItemRuntime, children: /* @__PURE__ */ jsx(Provider, { children: /* @__PURE__ */ jsx(this._InnerActiveThreadProvider, {}) }) });
  });
  __internal_RenderThreadRuntimes = ({ provider }) => {
    this.useAliveThreadsKeysChanged();
    return Array.from(this.instances.keys()).map((threadId) => /* @__PURE__ */ jsx(
      this._OuterActiveThreadProvider,
      {
        threadId,
        provider
      },
      threadId
    ));
  };
};
export {
  RemoteThreadListHookInstanceManager
};
//# sourceMappingURL=RemoteThreadListHookInstanceManager.js.map