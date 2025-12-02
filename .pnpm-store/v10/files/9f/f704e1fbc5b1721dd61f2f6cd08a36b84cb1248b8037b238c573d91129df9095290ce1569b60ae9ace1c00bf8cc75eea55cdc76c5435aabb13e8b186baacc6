"use client";

// src/runtimes/remote-thread-list/adapter/cloud.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef
} from "react";
import { AssistantCloud } from "assistant-cloud";
import { useAssistantCloudThreadHistoryAdapter } from "../../../cloud/AssistantCloudThreadHistoryAdapter.js";
import { RuntimeAdapterProvider } from "../../adapters/RuntimeAdapterProvider.js";
import { InMemoryThreadListAdapter } from "./in-memory.js";
import { CloudFileAttachmentAdapter } from "../../adapters/index.js";
import { jsx } from "react/jsx-runtime";
var baseUrl = typeof process !== "undefined" && process?.env?.["NEXT_PUBLIC_ASSISTANT_BASE_URL"];
var autoCloud = baseUrl ? new AssistantCloud({ baseUrl, anonymous: true }) : void 0;
var useCloudThreadListAdapter = (adapter) => {
  const adapterRef = useRef(adapter);
  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);
  const unstable_Provider = useCallback(
    function Provider({ children }) {
      const history = useAssistantCloudThreadHistoryAdapter({
        get current() {
          return adapterRef.current.cloud ?? autoCloud;
        }
      });
      const attachments = useMemo(
        () => new CloudFileAttachmentAdapter(
          adapterRef.current.cloud ?? autoCloud
        ),
        [adapterRef.current.cloud]
      );
      const adapters = useMemo(
        () => ({
          history,
          attachments
        }),
        [history]
      );
      return /* @__PURE__ */ jsx(RuntimeAdapterProvider, { adapters, children });
    },
    []
  );
  const cloud = adapter.cloud ?? autoCloud;
  if (!cloud) return new InMemoryThreadListAdapter();
  return {
    list: async () => {
      const { threads } = await cloud.threads.list();
      return {
        threads: threads.map((t) => ({
          status: t.is_archived ? "archived" : "regular",
          remoteId: t.id,
          title: t.title,
          externalId: t.external_id ?? void 0
        }))
      };
    },
    initialize: async () => {
      const createTask = adapter.create?.() ?? Promise.resolve();
      const t = await createTask;
      const external_id = t ? t.externalId : void 0;
      const { thread_id: remoteId } = await cloud.threads.create({
        last_message_at: /* @__PURE__ */ new Date(),
        external_id
      });
      return { externalId: external_id, remoteId };
    },
    rename: async (threadId, newTitle) => {
      return cloud.threads.update(threadId, { title: newTitle });
    },
    archive: async (threadId) => {
      return cloud.threads.update(threadId, { is_archived: true });
    },
    unarchive: async (threadId) => {
      return cloud.threads.update(threadId, { is_archived: false });
    },
    delete: async (threadId) => {
      await adapter.delete?.(threadId);
      return cloud.threads.delete(threadId);
    },
    generateTitle: async (threadId, messages) => {
      return cloud.runs.stream({
        thread_id: threadId,
        assistant_id: "system/thread_title",
        messages
        // TODO serialize these to a more efficient format
      });
    },
    unstable_Provider
  };
};
export {
  useCloudThreadListAdapter
};
//# sourceMappingURL=cloud.js.map