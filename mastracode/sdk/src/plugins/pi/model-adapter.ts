import type { PiExtensionGeneration } from './types.js';

export interface PiModelInfo {
  id: string;
  provider?: string;
  modelName?: string;
  hasApiKey?: boolean;
}

export interface PiModelHost {
  getCurrentModelId(): string;
  listAvailableModels(): Promise<PiModelInfo[]>;
  switchModel(modelId: string): Promise<void>;
  getThinkingLevel(): string | undefined;
  setThinkingLevel(level: string): Promise<void> | void;
}

export class PiModelAdapter {
  constructor(
    private readonly generation: PiExtensionGeneration,
    private readonly getHost: () => PiModelHost | undefined,
  ) {}

  getModel(): string | undefined {
    this.generation.assertActive();
    return this.#host().getCurrentModelId() || undefined;
  }

  async getScopedModels(): Promise<PiModelInfo[]> {
    this.generation.assertActive();
    return (await this.#host().listAvailableModels()).filter(model => model.hasApiKey !== false);
  }

  async setModel(model: string | { id?: string; provider?: string; modelName?: string }): Promise<boolean> {
    this.generation.assertActive();
    const requested =
      typeof model === 'string'
        ? [model]
        : [
            model.id,
            model.provider && model.id ? `${model.provider}/${model.id}` : undefined,
            [model.provider, model.modelName].filter(Boolean).join('/'),
          ].filter((value): value is string => Boolean(value));
    const available = await this.getScopedModels();
    const modelId = requested.find(value => available.some(candidate => candidate.id === value));
    if (!modelId) {
      this.generation.addDiagnostic(
        'warning',
        `Pi extension requested unavailable model "${requested[0] ?? ''}".`,
        'setModel',
      );
      return false;
    }
    await this.#host().switchModel(modelId);
    return true;
  }

  getThinkingLevel(): string | undefined {
    this.generation.assertActive();
    return this.#host().getThinkingLevel();
  }

  async setThinkingLevel(level: string): Promise<void> {
    this.generation.assertActive();
    await this.#host().setThinkingLevel(level);
  }

  #host(): PiModelHost {
    const host = this.getHost();
    if (!host) throw new Error(`Pi extension "${this.generation.extensionId}" has no active model facade.`);
    return host;
  }
}
