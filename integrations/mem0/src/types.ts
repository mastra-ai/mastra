import type { MemoryOptions } from 'mem0ai';

export interface Mem0ClientConfig {
  apiKey: string;
  host?: string;
  organizationName?: string;
  projectName?: string;
  organizationId?: string;
  projectId?: string;
}

export type Mem0Config = Mem0ClientConfig & MemoryOptions & {
  [key: string]: any;
}