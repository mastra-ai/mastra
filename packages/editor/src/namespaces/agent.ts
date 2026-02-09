import type { Agent } from '@mastra/core';
import type { StorageResolvedAgentType } from '@mastra/core';

import type { MastraEditor } from '../index';

export class EditorAgentNamespace {
  constructor(private editor: MastraEditor) {}

  getById(
    id: string,
    options?: { returnRaw?: false; versionId?: string; versionNumber?: number },
  ): Promise<Agent | null>;
  getById(
    id: string,
    options: { returnRaw: true; versionId?: string; versionNumber?: number },
  ): Promise<StorageResolvedAgentType | null>;
  getById(
    id: string,
    options?: { returnRaw?: boolean; versionId?: string; versionNumber?: number },
  ): Promise<Agent | StorageResolvedAgentType | null> {
    return this.editor.getStoredAgentById(id, options as any);
  }

  list(options?: { returnRaw?: false; page?: number; pageSize?: number }): Promise<{
    agents: Agent[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;
  list(options: { returnRaw: true; page?: number; pageSize?: number }): Promise<{
    agents: StorageResolvedAgentType[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;
  list(options?: { returnRaw?: boolean; page?: number; pageSize?: number }): Promise<{
    agents: Agent[] | StorageResolvedAgentType[];
    total: number;
    page: number;
    perPage: number | false;
    hasMore: boolean;
  }> {
    return this.editor.listStoredAgents(options as any);
  }

  clearCache(agentId?: string): void {
    return this.editor.clearStoredAgentCache(agentId);
  }
}
