import type { ProviderCapabilities, ProviderOperation } from '../contracts/shared/provider.js';

export class RegistryConfigurationError extends Error {
  constructor(
    readonly code: 'DUPLICATE_PROVIDER' | 'UNKNOWN_PROVIDER' | 'UNAVAILABLE_CAPABILITY',
    message: string,
  ) {
    super(message);
    this.name = 'RegistryConfigurationError';
  }
}

export type ProviderRegistration<T, TFactoryContext = void> = Readonly<{
  id: string;
  capabilities: ProviderCapabilities;
  validate: () => void;
  create: (context: TFactoryContext) => T;
}>;

export type ProviderSelectionContext = Readonly<{
  environment: ProviderCapabilities['environments'][number];
  piiMode: ProviderCapabilities['supportedPiiModes'][number];
  jurisdiction: string;
}>;

export class ProviderRegistry<T, TFactoryContext = void> {
  readonly #entries = new Map<string, ProviderRegistration<T, TFactoryContext>>();

  register(entry: ProviderRegistration<T, TFactoryContext>): this {
    if (this.#entries.has(entry.id)) {
      throw new RegistryConfigurationError('DUPLICATE_PROVIDER', `Provider ${entry.id} is registered more than once`);
    }
    this.#entries.set(entry.id, Object.freeze(entry));
    return this;
  }

  validateSelection(id: string, operation: ProviderOperation, context?: ProviderSelectionContext): void {
    const entry = this.#get(id);
    entry.validate();
    if (!entry.capabilities.operations.includes(operation)) {
      throw new RegistryConfigurationError('UNAVAILABLE_CAPABILITY', `Provider ${id} does not support ${operation}`);
    }
    if (context !== undefined && !entry.capabilities.environments.includes(context.environment)) {
      throw new RegistryConfigurationError(
        'UNAVAILABLE_CAPABILITY',
        `Provider ${id} does not support environment ${context.environment}`,
      );
    }
    if (context !== undefined && !entry.capabilities.supportedPiiModes.includes(context.piiMode)) {
      throw new RegistryConfigurationError(
        'UNAVAILABLE_CAPABILITY',
        `Provider ${id} does not support PII mode ${context.piiMode}`,
      );
    }
    if (context !== undefined && !entry.capabilities.jurisdictions.includes(context.jurisdiction)) {
      throw new RegistryConfigurationError(
        'UNAVAILABLE_CAPABILITY',
        `Provider ${id} does not support jurisdiction ${context.jurisdiction}`,
      );
    }
  }

  resolve(id: string, context: TFactoryContext): T {
    const entry = this.#get(id);
    entry.validate();
    return entry.create(context);
  }

  has(id: string): boolean {
    return this.#entries.has(id);
  }

  ids(): string[] {
    return [...this.#entries.keys()].sort();
  }

  #get(id: string): ProviderRegistration<T, TFactoryContext> {
    const entry = this.#entries.get(id);
    if (entry === undefined) {
      throw new RegistryConfigurationError('UNKNOWN_PROVIDER', `Unknown provider: ${id}`);
    }
    return entry;
  }
}
