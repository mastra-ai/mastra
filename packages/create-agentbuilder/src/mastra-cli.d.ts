declare module 'mastra/dist/analytics/index.js' {
  export class PosthogAnalytics {
    constructor(options: { version: string; apiKey: string; host: string });
    trackCommandExecution<T>(options: {
      command: string;
      args: Record<string, unknown>;
      execution: () => Promise<T>;
      origin?: 'mastra-cloud' | 'oss';
    }): Promise<T>;
    shutdown(timeoutMs?: number): Promise<void>;
  }

  export function setAnalytics(instance: PosthogAnalytics): void;
}

declare module 'mastra/dist/commands/create/create.js' {
  import type { PosthogAnalytics } from 'mastra/dist/analytics/index.js';

  export function create(args: {
    projectName?: string;
    components?: Array<'agents' | 'tools' | 'workflows' | 'scorers'>;
    llmProvider?: string;
    addExample?: boolean;
    llmApiKey?: string;
    createVersionTag?: string;
    timeout?: number;
    directory?: string;
    observability?: boolean;
    agentBuilder?: boolean;
    analytics?: PosthogAnalytics;
  }): Promise<void>;
}
