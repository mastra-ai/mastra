"use client";

import {
  FC,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { AssistantCloud } from "assistant-cloud";
import { RemoteThreadListAdapter } from "../types";
import { useAssistantCloudThreadHistoryAdapter } from "../../../cloud/AssistantCloudThreadHistoryAdapter";
import { RuntimeAdapterProvider } from "../../adapters/RuntimeAdapterProvider";
import { InMemoryThreadListAdapter } from "./in-memory";
import { CloudFileAttachmentAdapter } from "../../adapters";

type ThreadData = {
  externalId: string;
};

type CloudThreadListAdapterOptions = {
  cloud?: AssistantCloud | undefined;

  create?(): Promise<ThreadData>;
  delete?(threadId: string): Promise<void>;
};

const baseUrl =
  typeof process !== "undefined" &&
  process?.env?.["NEXT_PUBLIC_ASSISTANT_BASE_URL"];
const autoCloud = baseUrl
  ? new AssistantCloud({ baseUrl, anonymous: true })
  : undefined;

export const useCloudThreadListAdapter = (
  adapter: CloudThreadListAdapterOptions,
): RemoteThreadListAdapter => {
  const adapterRef = useRef(adapter);
  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);

  const unstable_Provider = useCallback<FC<PropsWithChildren>>(
    function Provider({ children }) {
      const history = useAssistantCloudThreadHistoryAdapter({
        get current() {
          return adapterRef.current.cloud ?? autoCloud!;
        },
      });
      const attachments = useMemo(
        () =>
          new CloudFileAttachmentAdapter(
            adapterRef.current.cloud ?? autoCloud!,
          ),
        [adapterRef.current.cloud],
      );

      const adapters = useMemo(
        () => ({
          history,
          attachments,
        }),
        [history],
      );

      return (
        <RuntimeAdapterProvider adapters={adapters}>
          {children}
        </RuntimeAdapterProvider>
      );
    },
    [],
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
          externalId: t.external_id ?? undefined,
        })),
      };
    },

    initialize: async () => {
      const createTask = adapter.create?.() ?? Promise.resolve();
      const t = await createTask;
      const external_id = t ? t.externalId : undefined;
      const { thread_id: remoteId } = await cloud.threads.create({
        last_message_at: new Date(),
        external_id,
      });

      return { externalId: external_id, remoteId: remoteId };
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
        messages: messages, // TODO serialize these to a more efficient format
      });
    },

    unstable_Provider,
  };
};
