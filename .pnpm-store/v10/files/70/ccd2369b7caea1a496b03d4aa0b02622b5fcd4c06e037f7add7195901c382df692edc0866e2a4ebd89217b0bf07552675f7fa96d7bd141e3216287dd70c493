import { ComponentType, PropsWithChildren } from "react";
import { AssistantRuntime } from "../../api";
import { AssistantStream } from "assistant-stream";
import { ThreadMessage } from "../../types";

export type RemoteThreadInitializeResponse = {
  remoteId: string;
  externalId: string | undefined;
};

export type RemoteThreadMetadata = {
  readonly status: "regular" | "archived";
  readonly remoteId: string;
  readonly externalId?: string | undefined;
  readonly title?: string | undefined;
};

export type RemoteThreadListResponse = {
  threads: RemoteThreadMetadata[];
};

export type RemoteThreadListAdapter = {
  list(): Promise<RemoteThreadListResponse>;

  rename(remoteId: string, newTitle: string): Promise<void>;
  archive(remoteId: string): Promise<void>;
  unarchive(remoteId: string): Promise<void>;
  delete(remoteId: string): Promise<void>;
  initialize(threadId: string): Promise<RemoteThreadInitializeResponse>;
  generateTitle(
    remoteId: string,
    unstable_messages: readonly ThreadMessage[],
  ): Promise<AssistantStream>;

  unstable_Provider?: ComponentType<PropsWithChildren>;
};

export type RemoteThreadListOptions = {
  runtimeHook: () => AssistantRuntime;
  adapter: RemoteThreadListAdapter;
};
