import type { RouteResponse } from '@mastra/client-js';
import type { AIV5Type, MastraDBMessage } from '@mastra/core/agent/message-list';

export const hitlUser: RouteResponse<'GET /auth/me'> = { id: 'user-1' };
export const hitlMemoryConfig: RouteResponse<'GET /memory/config'> = { config: {} };
export const hitlMcpServers: RouteResponse<'GET /mcp/v0/servers'> = { servers: [], totalCount: 0 };
const continuedReply: AIV5Type.UIMessage = {
  id: 'continued-reply',
  role: 'assistant',
  parts: [{ type: 'text', text: 'The run continued after your decision.' }],
};
export const hitlGenerateResponse = {
  response: { uiMessages: [continuedReply] },
} satisfies RouteResponse<'POST /agents/:agentId/approve-tool-call-generate'>;

export const approvalMessage: MastraDBMessage = {
  id: 'approval-message',
  role: 'assistant',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  content: {
    format: 2,
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'approval-call', toolName: 'search', args: { query: 'Mastra' } },
      },
    ],
    metadata: {
      mode: 'stream',
      requireApprovalMetadata: {
        search: { toolCallId: 'approval-call', toolName: 'search', args: { query: 'Mastra' }, runId: 'approval-run' },
      },
    },
  },
};
