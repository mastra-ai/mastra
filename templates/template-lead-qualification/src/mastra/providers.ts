import type { Client } from '@libsql/client';
import { attioConfig, attioConfigSchema, attioConnectionConfig, attioConnectionSchema } from './config/attio';
import type { AttioConnectionConfig } from './config/attio';
import { intakeConfig, intakeConfigSchema } from './config/lead-ingestion';
import type { IntakeConfig } from './config/lead-ingestion';
import type { QualificationConfig } from './config/qualification';
import type { RuntimeConfig } from './config/runtime';
import type { LeadIntake } from './intake';
import type { LeadEventStore } from './persistence/lead-event-store';
import type { ReviewService } from './review/service';
import { AttioClient } from './providers/attio/client';
import { AttioInputProvider } from './providers/attio/input';
import { AttioStore } from './providers/attio/store';
import { AttioOutputProvider } from './providers/attio/output';
import { evidenceProviders } from './providers/evidence';
import type { EvidenceProvider } from './providers/evidence';
import type { EventInputProvider } from './providers/input';
import { LocalInputProvider } from './providers/local/input';
import { LocalOutputProvider } from './providers/local/output';
import type { OutputProvider } from './providers/output';

export type InputContext = {
  config: IntakeConfig;
  store: LeadEventStore;
  intake: LeadIntake;
  reviews: ReviewService;
};
export type InputFactory = (context: InputContext) => EventInputProvider | Promise<EventInputProvider>;
export type OutputFactory = (client: Client) => OutputProvider;
export interface ProviderOptions {
  /** Explicit additional custom transports, such as signed CRM commands alongside JSON intake. */
  additionalInputs?: readonly string[];
  input?: ReadonlyMap<string, EventInputProvider>;
  output?: OutputProvider[];
  inputFactories?: ReadonlyMap<string, InputFactory>;
  outputFactories?: ReadonlyMap<string, OutputFactory>;
  attio?: (AttioConnectionConfig & { webhookSecret?: string }) | null;
  attioTransport?: typeof fetch;
}

/** Resolve explicit selections before reading optional integration configuration or opening storage. */
export function initializeProviders(
  options: ProviderOptions & {
    mode: RuntimeConfig['mode'];
    config?: IntakeConfig;
    qualification: QualificationConfig;
    evidence?: EvidenceProvider[];
  },
) {
  const selected = options.config ?? {
    ...intakeConfig,
    source: {
      ...intakeConfig.source,
      ...(options.mode === 'production' ? { inputProviderId: 'attio', destinationProviderId: 'attio' } : {}),
    },
  };
  const inputIds = new Set([selected.source.inputProviderId, ...(options.additionalInputs ?? [])]);
  const needsAttioInput = inputIds.has('attio');
  const needsAttio = needsAttioInput || selected.source.destinationProviderId === 'attio';
  const inputSettings = needsAttioInput
    ? options.attio
      ? attioConfigSchema.parse(options.attio)
      : options.attio !== null
        ? attioConfig()
        : undefined
    : undefined;
  const settings =
    inputSettings ??
    (needsAttio
      ? options.attio
        ? attioConnectionSchema.parse(
            Object.fromEntries(Object.entries(options.attio).filter(([key]) => key !== 'webhookSecret')),
          )
        : options.attio !== null
          ? attioConnectionConfig()
          : undefined
      : undefined);
  if (needsAttio && !settings) throw new Error('Selected Attio drivers require Attio configuration');
  const config = intakeConfigSchema.parse({
    ...selected,
    source: {
      ...selected.source,
      ...(!options.config && selected.source.inputProviderId === 'attio' ? { id: `attio:${settings!.listId}` } : {}),
    },
  });
  const client = settings ? new AttioClient(settings, options.attioTransport) : undefined;
  const attioOutput = client ? new AttioOutputProvider(client) : undefined;
  const inputFactories = new Map<string, InputFactory>([['generic', () => new LocalInputProvider(config.source)]]);
  const outputFactories = new Map<string, OutputFactory>([['local', db => new LocalOutputProvider(db)]]);
  if (inputSettings && attioOutput) {
    inputFactories.set('attio', async context => {
      const inbox = new AttioStore(context.store.client);
      await inbox.init();
      return new AttioInputProvider(
        context.store,
        attioOutput.client,
        context.reviews,
        config,
        context.intake,
        attioOutput,
        inputSettings,
        inbox,
      );
    });
  }
  if (attioOutput) outputFactories.set('attio', () => attioOutput);
  for (const [id, factory] of options.inputFactories ?? []) inputFactories.set(id, factory);
  for (const [id, provider] of options.input ?? []) inputFactories.set(id, () => provider);
  for (const [id, factory] of options.outputFactories ?? []) outputFactories.set(id, factory);
  const outputs = options.output;
  if (outputs && new Set(outputs.map(provider => provider.id)).size !== outputs.length)
    throw new Error('Output provider IDs must be distinct');
  for (const provider of outputs ?? []) outputFactories.set(provider.id, () => provider);
  for (const id of inputIds) if (!inputFactories.has(id)) throw new Error('Configured input provider is unavailable');
  if (!outputFactories.has(config.source.destinationProviderId))
    throw new Error('Configured output provider is unavailable');
  const evidence = evidenceProviders(options.evidence);
  for (const id of options.qualification.sources.providerIds)
    if (!evidence.has(id)) throw new Error('Configured evidence provider is unavailable');
  return {
    config,
    salesMapped: Boolean(inputSettings?.sales),
    evidence,
    createOutputs(db: Client) {
      const ids = new Set([config.source.destinationProviderId, ...(outputs?.map(provider => provider.id) ?? [])]);
      return new Map(
        [...ids].map(id => {
          const provider = outputFactories.get(id)!(db);
          if (provider.id !== id) throw new Error('Output driver ID does not match its registration');
          return [id, provider];
        }),
      );
    },
    async createInputs(context: InputContext) {
      const inputs = new Map<string, EventInputProvider>();
      const sources = new Set<string>();
      for (const id of inputIds) {
        const provider = await inputFactories.get(id)!(context);
        const source = intakeConfigSchema.shape.source.parse(provider.source);
        if (
          provider.id !== id ||
          source.inputProviderId !== id ||
          source.destinationProviderId !== config.source.destinationProviderId ||
          sources.has(source.id)
        )
          throw new Error('Input driver binding does not match its registration');
        if (id !== config.source.inputProviderId && provider.transport !== 'custom')
          throw new Error('Additional inputs require their own custom transport');
        sources.add(source.id);
        inputs.set(id, provider);
      }
      return inputs;
    },
  };
}
