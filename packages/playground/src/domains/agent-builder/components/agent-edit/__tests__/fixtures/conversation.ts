import type { BuilderAvailableModelsResponse, ListMemoryThreadMessagesResponse } from '@mastra/client-js';

import type { AuthCapabilities } from '@/domains/auth/types';

/**
 * `GET /api/auth/capabilities` fixture. RBAC disabled, so `usePermissions`
 * grants everything and `useDefaultVisibility` resolves to `'public'`.
 */
export const authDisabledCapabilities: AuthCapabilities = { enabled: false, login: null };

/**
 * `GET /api/editor/builder/models/available` fixture. The server returns the
 * already policy-filtered provider/model list. Only `openai` is allowed here,
 * mirroring an admin policy that scopes the builder to a single provider.
 */
export const openAiOnlyModels: BuilderAvailableModelsResponse = {
  providers: [{ id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o'] }],
};

/** Empty `GET /api/memory/threads/:threadId/messages` response (fresh thread). */
export const emptyThreadMessages: ListMemoryThreadMessagesResponse = { messages: [] };
