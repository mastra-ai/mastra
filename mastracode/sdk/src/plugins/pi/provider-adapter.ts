import type { PiExtensionGeneration } from './types.js';

export interface PiProviderModel {
  id: string;
  name?: string;
}

export interface PiProviderContribution {
  name: string;
  url: string;
  apiKeyEnvVar?: string;
  models: string[];
  pluginId: string;
  extensionId: string;
}

export interface PiProviderHost {
  register(provider: PiProviderContribution): Promise<(() => void | Promise<void>) | void>;
  refresh(): Promise<void>;
}

function normalizeModels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(model => {
    if (typeof model === 'string') return [model];
    if (typeof model === 'object' && model !== null && typeof (model as PiProviderModel).id === 'string') {
      return [(model as PiProviderModel).id];
    }
    return [];
  });
}

export class PiProviderAdapter {
  readonly #owners = new Map<string, PiExtensionGeneration>();
  readonly #cleanups = new Map<string, () => void | Promise<void>>();
  readonly #operations = new Map<string, Promise<void>>();

  constructor(private readonly host: PiProviderHost) {}

  async register(generation: PiExtensionGeneration, name: string, config: unknown): Promise<void> {
    return this.#serialize(name, () => this.#register(generation, name, config));
  }

  async #register(generation: PiExtensionGeneration, name: string, config: unknown): Promise<void> {
    generation.assertActive();
    if (typeof config !== 'object' || config === null)
      throw new Error(`Pi provider "${name}" requires an object config`);
    const value = config as Record<string, unknown>;
    if ('oauth' in value) {
      generation.addDiagnostic(
        'error',
        `Pi provider "${name}" uses OAuth UI, which is unsupported in Mastra Code.`,
        'registerProvider:oauth',
      );
      return;
    }
    const url =
      typeof value.baseUrl === 'string' ? value.baseUrl : typeof value.url === 'string' ? value.url : undefined;
    if (!url) throw new Error(`Pi provider "${name}" requires baseUrl`);
    const configuredApiKey = typeof value.apiKey === 'string' ? value.apiKey : undefined;
    const apiKeyEnvVar = configuredApiKey?.startsWith('$') ? configuredApiKey.slice(1) : undefined;
    if (configuredApiKey && (!apiKeyEnvVar || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeyEnvVar))) {
      generation.addDiagnostic(
        'error',
        `Pi provider "${name}" supplied a raw credential that cannot be retained; use an environment-backed credential.`,
        'registerProvider:credential',
      );
      return;
    }
    const existing = this.#owners.get(name);
    if (existing && existing !== generation) {
      generation.addDiagnostic(
        'warning',
        `Pi provider "${name}" conflicts with ${existing.extensionId}; the first registration wins.`,
        'registerProvider',
      );
      return;
    }
    if (existing === generation) {
      generation.addDiagnostic(
        'warning',
        `Pi provider "${name}" is already registered by ${generation.extensionId}; the first registration wins.`,
        'registerProvider',
      );
      return;
    }
    let cleanup: (() => void | Promise<void>) | void;
    try {
      cleanup = await this.host.register({
        name,
        url,
        apiKeyEnvVar,
        models: normalizeModels(value.models),
        pluginId: generation.pluginId,
        extensionId: generation.extensionId,
      });
      try {
        generation.assertActive();
      } catch (error) {
        await cleanup?.();
        await this.host.refresh();
        throw error;
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Custom provider already exists:')) {
        generation.addDiagnostic(
          'warning',
          `Pi provider "${name}" conflicts with a Mastra Code provider; the Mastra Code provider wins.`,
          'registerProvider',
        );
        return;
      }
      throw error;
    }
    try {
      await this.host.refresh();
    } catch (error) {
      await cleanup?.();
      await this.host.refresh().catch(() => undefined);
      throw error;
    }
    this.#owners.set(name, generation);
    if (cleanup) this.#cleanups.set(name, cleanup);
    generation.addCleanup(() => this.#serialize(name, () => this.#unregisterOwned(generation, name)));
  }

  async unregister(generation: PiExtensionGeneration, name: string): Promise<void> {
    return this.#serialize(name, async () => {
      generation.assertActive();
      await this.#unregisterOwned(generation, name);
    });
  }

  async #unregisterOwned(generation: PiExtensionGeneration, name: string): Promise<void> {
    if (this.#owners.get(name) !== generation) return;
    const cleanup = this.#cleanups.get(name);
    this.#owners.delete(name);
    this.#cleanups.delete(name);
    await cleanup?.();
    await this.host.refresh();
  }

  async #serialize(name: string, operation: () => Promise<void>): Promise<void> {
    const prior = this.#operations.get(name) ?? Promise.resolve();
    const current = prior.catch(() => undefined).then(operation);
    this.#operations.set(name, current);
    try {
      await current;
    } finally {
      if (this.#operations.get(name) === current) this.#operations.delete(name);
    }
  }
}
