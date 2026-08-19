import type { PiExtensionGeneration } from './types.js';

export interface PiThreadInfo {
  id: string;
  title?: string | null;
}

export interface PiThreadHost {
  getId(): string | null;
  create(options?: { title?: string; id?: string }): Promise<PiThreadInfo>;
  switch(options: { threadId: string }): Promise<void>;
  clone(options?: { sourceThreadId?: string; title?: string }): Promise<PiThreadInfo>;
  rename(options: { title: string }): Promise<void>;
  getById(options: { threadId: string }): Promise<PiThreadInfo | null>;
}

export class PiThreadAdapter {
  constructor(
    private readonly generation: PiExtensionGeneration,
    private readonly getHost: () => PiThreadHost | undefined,
  ) {}

  async newSession(options: { name?: string } = {}): Promise<{ cancelled: false; threadId: string }> {
    this.generation.assertActive();
    const thread = await this.#host().create({ title: options.name });
    this.generation.assertActive();
    return { cancelled: false, threadId: thread.id };
  }

  async switchSession(threadId: string): Promise<{ cancelled: boolean; threadId?: string }> {
    this.generation.assertActive();
    const host = this.#host();
    try {
      await host.switch({ threadId });
      this.generation.assertActive();
      return { cancelled: false, threadId };
    } catch (error) {
      this.generation.assertActive();
      if (error instanceof Error && error.message === `Thread not found: ${threadId}`) return { cancelled: true };
      throw error;
    }
  }

  async fork(
    options: { sourceThreadId?: string; name?: string } = {},
  ): Promise<{ cancelled: false; threadId: string }> {
    this.generation.assertActive();
    const thread = await this.#host().clone({ sourceThreadId: options.sourceThreadId, title: options.name });
    this.generation.assertActive();
    return { cancelled: false, threadId: thread.id };
  }

  navigateTree(): { supported: false; reason: string } {
    this.generation.assertActive();
    const reason =
      'Pi session-tree navigation is unsupported because Mastra Code threads do not expose Pi transcript trees.';
    this.generation.addDiagnostic('warning', reason, 'navigateTree');
    return { supported: false, reason };
  }

  async setSessionName(name: string): Promise<void> {
    this.generation.assertActive();
    await this.#host().rename({ title: name });
    this.generation.assertActive();
  }

  async getSessionName(): Promise<string | undefined> {
    this.generation.assertActive();
    const host = this.#host();
    const threadId = host.getId();
    if (!threadId) return undefined;
    const thread = await host.getById({ threadId });
    this.generation.assertActive();
    return thread?.title ?? undefined;
  }

  #host(): PiThreadHost {
    const host = this.getHost();
    if (!host) throw new Error(`Pi extension "${this.generation.extensionId}" has no active thread facade.`);
    return host;
  }
}
