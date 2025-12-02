import { AssistantStream, AssistantStreamChunk } from "assistant-stream";
import {
  RemoteThreadInitializeResponse,
  RemoteThreadListAdapter,
  RemoteThreadListResponse,
} from "../types";

export class InMemoryThreadListAdapter implements RemoteThreadListAdapter {
  list(): Promise<RemoteThreadListResponse> {
    return Promise.resolve({
      threads: [],
    });
  }

  rename(): Promise<void> {
    return Promise.resolve();
  }

  archive(): Promise<void> {
    return Promise.resolve();
  }

  unarchive(): Promise<void> {
    return Promise.resolve();
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }

  initialize(threadId: string): Promise<RemoteThreadInitializeResponse> {
    return Promise.resolve({ remoteId: threadId, externalId: undefined });
  }

  generateTitle(): Promise<AssistantStream> {
    return Promise.resolve(new ReadableStream<AssistantStreamChunk>());
  }
}
