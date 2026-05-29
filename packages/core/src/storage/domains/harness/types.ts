export interface SessionRecord {
  id: string;
  ownerId: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  origin: 'top-level' | 'subagent-tool';
  modeId: string;
  modelId: string;
  createdAt: Date;
  lastActivityAt: Date;
}
