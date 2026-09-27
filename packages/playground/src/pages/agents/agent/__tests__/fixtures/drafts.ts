import type {
  GetMemoryConfigResponse,
  ListFeedbackResponse,
  MastraClient,
  McpServerListResponse,
} from '@mastra/client-js';

import type { AuthenticatedCapabilities, PublicAuthCapabilities } from '@/domains/auth/types';

export const draftAuthDisabled: PublicAuthCapabilities = { enabled: false, login: null };

export const draftUser: AuthenticatedCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'draft-user-1' },
  capabilities: { user: true, session: true, sso: false, rbac: false, acl: false },
  access: null,
};

export const draftMcpServers: McpServerListResponse = { servers: [], next: null, total_count: 0 };
export const draftFeedback: ListFeedbackResponse = {
  feedback: [],
  pagination: { total: 0, page: 0, perPage: 50, hasMore: false },
};

export function draftStream() {
  let finish = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode('data: {"type":"start","runId":"draft-run","payload":{}}\n\n'));
      finish = () => {
        controller.enqueue(encoder.encode('data: {"type":"finish","runId":"draft-run","payload":{}}\n\n'));
        controller.close();
      };
    },
  });
  return { stream, finish: () => finish() };
}

export const draftMemoryConfig: GetMemoryConfigResponse = { config: {} };
export const draftWorkingMemory: Awaited<ReturnType<MastraClient['getWorkingMemory']>> = {
  workingMemory: null,
  source: 'thread',
  workingMemoryTemplate: null,
  threadExists: false,
};
