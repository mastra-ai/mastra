import { Render } from '@renderinc/sdk';

export interface ProviderRun {
  id: string;
  status: string;
  results?: unknown[];
  error?: unknown;
}
export interface RenderTransport {
  start(taskSlug: string, input: unknown): Promise<string>;
  get(taskRunId: string): Promise<ProviderRun>;
  cancel(taskRunId: string): Promise<void>;
  /** Completion notification only. The caller reconciles authoritative task state afterward. */
  waitForEvent?(taskRunId: string, signal: AbortSignal): Promise<void>;
}
/** Adapt the public Render SDK to provider operations, constructing its client only when needed. */
export function createRenderTransport(options?: ConstructorParameters<typeof Render>[0]): RenderTransport {
  let client: Render | undefined;
  const getClient = () => (client ??= new Render(options));
  return {
    /** Submit one root envelope as the native task's single positional argument. */
    async start(slug, input) {
      return (await getClient().workflows.startTask(slug, [input])).taskRunId;
    },
    /** Fetch authoritative native task state by its persisted provider ID. */
    async get(id) {
      return getClient().workflows.getTaskRun(id);
    },
    /** Request native task cancellation without inventing a local terminal outcome. */
    async cancel(id) {
      await getClient().workflows.cancelTaskRun(id);
    },
    /** Wake on a matching completion event; callers must still reconcile authoritative task state. */
    async waitForEvent(id, signal) {
      for await (const event of getClient().workflows.taskRunEvents([id], signal, { maxRetries: 0 })) {
        if (event.id === id) return;
      }
    },
  };
}
