import type { GetWorkflowRunByIdResponse, StreamVNextChunkType } from '@mastra/client-js';
import { suspendedRunState } from './workflow-run-states';
import type { AuthCapabilities } from '@/domains/auth/types';

export const readOnlyWorkflowUser: AuthCapabilities = {
  enabled: true,
  login: { type: 'credentials' },
  user: { id: 'viewer' },
  capabilities: { user: true, session: false, sso: false, rbac: true, acl: false },
  access: { roles: ['viewer'], permissions: ['workflows:read'] },
};

export const noWorkflowAuth: AuthCapabilities = { enabled: false, login: null };

export const falsySuspension: GetWorkflowRunByIdResponse = {
  ...suspendedRunState,
  steps: {
    transform: {
      status: 'suspended',
      payload: {},
      suspendPayload: false,
      startedAt: 100,
      suspendedAt: 110,
    },
  },
};

export const suspendedChunk: StreamVNextChunkType = {
  type: 'workflow-step-suspended',
  runId: suspendedRunState.runId,
  from: 'WORKFLOW',
  payload: {
    id: 'transform',
    stepCallId: 'transform-call',
    status: 'suspended',
    payload: {},
    suspendPayload: { question: 'continue?' },
    startedAt: 100,
    suspendedAt: 110,
  },
};
