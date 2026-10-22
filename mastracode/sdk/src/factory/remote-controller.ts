import type { AvailableModel, ModelAuthStatus } from '@mastra/core/agent-controller';

import type { FactoryAddress } from './client.js';
import { createFactoryClient, FACTORY_CONTROLLER_ID } from './client.js';

export interface RemoteMode {
  id: string;
  name?: string;
  description?: string;
  default?: boolean;
  defaultModelId?: string;
  metadata?: Record<string, unknown>;
}

type ControllerHandle = ReturnType<ReturnType<typeof createFactoryClient>['getAgentController']>;

/**
 * The Factory-side counterpart to the local agent controller. Modes, models, and
 * provider auth come from the Factory, never from local settings or auth storage.
 */
export class RemoteController {
  readonly id = FACTORY_CONTROLLER_ID;
  readonly #remote: ControllerHandle;
  #modes: RemoteMode[] = [];
  #models: Promise<AvailableModel[]> | undefined;

  constructor(address: FactoryAddress, remote?: ControllerHandle) {
    this.#remote = remote ?? createFactoryClient(address).getAgentController(FACTORY_CONTROLLER_ID);
  }

  /** Load the mode list; `listModes()` is synchronous so it must be primed. */
  async connect(): Promise<void> {
    this.#modes = (await this.#remote.listModes()) as RemoteMode[];
  }

  listModes(): RemoteMode[] {
    return this.#modes;
  }

  listAvailableModels(): Promise<AvailableModel[]> {
    this.#models ??= this.#remote.listModels().then(models => models as AvailableModel[]);
    this.#models.catch(() => (this.#models = undefined));
    return this.#models;
  }

  invalidateAvailableModelsCache(): void {
    this.#models = undefined;
  }

  /** Auth is the Factory's: report what it reports, or assume ok and let the run surface errors. */
  async getCurrentModelAuthStatus(session: { model: { get(): string } }): Promise<ModelAuthStatus> {
    const modelId = session.model.get();
    const models = await this.listAvailableModels().catch(() => []);
    const model = models.find(m => m.id === modelId);
    return model ? { hasAuth: model.hasApiKey, apiKeyEnvVar: model.apiKeyEnvVar } : { hasAuth: true };
  }
}
