export type SourceControlCapabilityReason =
  | 'provider-not-configured'
  | 'provider-unavailable'
  | 'missing-permissions'
  | 'project-not-linked'
  | 'unsupported';

export type SourceControlCapabilities = {
  canRead: boolean;
  canWrite: boolean;
  canListHistory: boolean;
  canOpenChangeRequest: boolean;
  reason?: SourceControlCapabilityReason | string;
};

export type SourceProviderInfo = {
  id: string;
  displayName: string;
};

export type SourceFileRef = {
  path: string;
  ref?: string;
};

export type SourceFile = SourceFileRef & {
  content: string;
  sha?: string;
};

export type SourceWriteFileInput = SourceFileRef & {
  content: string;
  message?: string;
  expectedSha?: string;
};

export type SourceWriteResult = {
  path: string;
  ref?: string;
  sha?: string;
  commitSha?: string;
  url?: string;
};

export type SourceFileHistoryInput = {
  path: string;
  ref?: string;
  limit?: number;
};

export type SourceFileListInput = {
  path: string;
  ref?: string;
};

export type SourceFileListEntry = {
  path: string;
  sha?: string;
};

export type SourceFileHistoryEntry = {
  id: string;
  ref?: string;
  message?: string;
  author?: string;
  createdAt: string;
  url?: string;
};

export type SourceChangeRequestInput = {
  title: string;
  body?: string;
  files: SourceWriteFileInput[];
  baseRef?: string;
  headRef?: string;
  inspectOnly?: boolean;
};

export type SourceChangeRequestResult = {
  id?: string | number;
  url: string;
  ref?: string;
};

export const SOURCE_CONTROL_AGENTS_DIR = 'agents';

export function getSourceControlEntityFilePath(directory: string, entityId: string): string {
  return `${directory}/${encodeURIComponent(entityId)}.json`;
}

export function getSourceAgentFilePath(agentId: string): string {
  return getSourceControlEntityFilePath(SOURCE_CONTROL_AGENTS_DIR, agentId);
}

export interface SourceControlProvider extends SourceProviderInfo {
  getCapabilities(): Promise<SourceControlCapabilities>;
  readFile(input: SourceFileRef): Promise<SourceFile | null>;
  writeFile(input: SourceWriteFileInput): Promise<SourceWriteResult>;
  listFileHistory(input: SourceFileHistoryInput): Promise<SourceFileHistoryEntry[]>;
  listFiles?(input: SourceFileListInput): Promise<SourceFileListEntry[]>;
  openChangeRequest?(input: SourceChangeRequestInput): Promise<SourceChangeRequestResult>;
}

export type EditorSourceCapabilities = {
  source: 'db' | 'code';
  storage: 'database' | 'filesystem' | 'source-control' | 'unavailable';
  provider?: SourceProviderInfo;
  canSave: boolean;
  canOpenChangeRequest: boolean;
  unavailableReason?: string;
};
