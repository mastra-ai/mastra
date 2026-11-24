import type { Client } from '@libsql/client';

import type { NotificationProvider } from '../contracts/communications/notifications.js';
import type { WebhookPublisher } from '../contracts/communications/webhook-publisher.js';
import type { MultimodalDocumentExtractionProvider } from '../contracts/providers/document-extraction.js';
import type { DocumentStorage } from '../contracts/providers/document-storage.js';
import type { PepScreeningProvider, SanctionsScreeningProvider } from '../contracts/providers/screening.js';
import type { AddressVerificationProvider, IdentityVerificationProvider } from '../contracts/providers/verification.js';
import type { AccountProvisioningProvider } from '../contracts/provisioning/account-provisioning.js';
import type { ProviderCapabilities } from '../contracts/shared/provider.js';
import { ProviderMisconfiguredError } from '../contracts/shared/provider.js';
import type { Clock, IdGenerator, ProviderMetricsRecorder } from '../contracts/technical/primitives.js';
import type { AppConfig } from '../config/app-config.schema.js';
import { loadRuntimeSecrets, type RuntimeSecretResolver } from '../config/load-config.js';
import { loadScreeningPolicy } from '../config/policies/screening.js';
import { demoDefaultPolicy, demoDefaultPolicyV1 } from '../config/policies/demo-default.js';
import { demoStrictPolicy, demoStrictPolicyV1 } from '../config/policies/demo-strict.js';
import { LocalFilesystemDocumentStorage } from '../providers/document-storage/local-filesystem.js';
import {
  OpenAiMultimodalDocumentExtractionProvider,
  openAiMultimodalCapabilities,
} from '../providers/extraction/openai-multimodal.js';
import { FixtureDocumentExtractionProvider } from '../providers/local/fixture-document-extraction.js';
import {
  FixturePepScreeningProvider,
  FixtureSanctionsScreeningProvider,
} from '../providers/local/fixture-screening.js';
import {
  FixtureAddressVerificationProvider,
  FixtureIdentityVerificationProvider,
} from '../providers/local/fixture-verification.js';
import {
  CapturingNotificationChannel,
  CapturingWebhookNotificationChannel,
  CapturingWebhookPublisher,
  LocalNotificationProvider,
  SafeConsoleNotificationChannel,
} from '../providers/local/local-communications.js';
import {
  DeterministicPiiProtectionPolicy,
  DeterministicRiskPolicyProvider,
  StaticJurisdictionPolicyProvider,
} from '../providers/local/local-policies.js';
import { SimulatedAccountProvisioningProvider } from '../providers/local/simulated-provisioning.js';
import { OpenSanctionsGateway } from '../providers/screening/opensanctions-gateway.js';
import {
  OpenSanctionsPepScreeningProvider,
  OpenSanctionsSanctionsScreeningProvider,
  openSanctionsPepCapabilities,
  openSanctionsSanctionsCapabilities,
} from '../providers/screening/opensanctions.js';
import { ModelRegistry } from './model-registry.js';
import { JurisdictionPolicyRegistry, RiskPolicyRegistry } from './policy-registry.js';
import { ProviderRegistry } from './provider-registry.js';

const openAiModelId = 'openai-gpt-5.6-luna';
const openAiRuntimeModelId = 'openai/gpt-5.6-luna';

export type RegistryFactoryContext = Readonly<{
  client: Client;
  ids: IdGenerator;
  clock: Clock;
  metrics: ProviderMetricsRecorder;
}>;

export type Registries = Readonly<{
  documentExtraction: ProviderRegistry<MultimodalDocumentExtractionProvider, RegistryFactoryContext>;
  identityVerification: ProviderRegistry<IdentityVerificationProvider, RegistryFactoryContext>;
  addressVerification: ProviderRegistry<AddressVerificationProvider, RegistryFactoryContext>;
  sanctionsScreening: ProviderRegistry<SanctionsScreeningProvider, RegistryFactoryContext>;
  pepScreening: ProviderRegistry<PepScreeningProvider, RegistryFactoryContext>;
  documentStorage: ProviderRegistry<DocumentStorage, RegistryFactoryContext>;
  notification: ProviderRegistry<NotificationProvider, RegistryFactoryContext>;
  webhookPublisher: ProviderRegistry<WebhookPublisher, RegistryFactoryContext>;
  provisioning: ProviderRegistry<AccountProvisioningProvider, RegistryFactoryContext>;
  jurisdictionPolicy: JurisdictionPolicyRegistry;
  riskPolicy: RiskPolicyRegistry;
  model: ModelRegistry;
  piiPolicy: DeterministicPiiProtectionPolicy;
}>;

const localCapabilities = (
  operation: Parameters<Registries['documentExtraction']['validateSelection']>[1],
): ProviderCapabilities => ({
  operations: [operation],
  environments: ['test', 'demo-default', 'demo-strict'],
  externalNetwork: false,
  idempotent: true,
  supportedPiiModes: ['demo-default', 'demo-strict'],
  acceptedPii: [],
  documentMimeTypes: [],
  jurisdictions: ['US'],
});

export const createRegistries = (
  config: AppConfig,
  resolveSecrets: RuntimeSecretResolver = loadRuntimeSecrets,
): Registries => {
  const screeningPolicy = loadScreeningPolicy(config.jurisdiction.defaultPolicyProfile);
  let openSanctionsGateway: OpenSanctionsGateway | undefined;
  let openSanctionsApiKey: string | undefined;
  let secretsResolved = false;
  const resolveOpenSanctionsApiKey = (): string | undefined => {
    if (!secretsResolved) {
      openSanctionsApiKey = resolveSecrets().openSanctionsApiKey;
      secretsResolved = true;
    }
    return openSanctionsApiKey;
  };
  const resolveOpenSanctionsGateway = (): OpenSanctionsGateway => {
    const apiKey = resolveOpenSanctionsApiKey();
    if (apiKey === undefined) {
      throw new ProviderMisconfiguredError({
        providerId: 'opensanctions',
        operation: 'SANCTIONS_SCREENING',
        safeMessage: 'The OpenSanctions provider is not configured',
        missingKeys: ['OPENSANCTIONS_API_KEY'],
      });
    }
    openSanctionsGateway ??= new OpenSanctionsGateway(apiKey, globalThis.fetch, undefined, config.retry.baseDelayMs);
    return openSanctionsGateway;
  };
  const validateOpenSanctions = (providerId: string): void => {
    const missingKeys: string[] = [];
    if (!config.credentials.openSanctionsApiKeyConfigured || resolveOpenSanctionsApiKey() === undefined)
      missingKeys.push('OPENSANCTIONS_API_KEY');
    if (!config.pii.externalProviderAllowlist.includes(providerId))
      missingKeys.push('KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST');
    if (missingKeys.length > 0) {
      throw new ProviderMisconfiguredError({
        providerId,
        operation: providerId === 'opensanctions-sanctions' ? 'SANCTIONS_SCREENING' : 'PEP_SCREENING',
        safeMessage: 'The OpenSanctions provider is not configured',
        missingKeys,
      });
    }
  };
  const documentExtraction = new ProviderRegistry<MultimodalDocumentExtractionProvider, RegistryFactoryContext>()
    .register({
      id: 'fixture',
      capabilities: new FixtureDocumentExtractionProvider().capabilities,
      validate: () => undefined,
      create: ({ clock }) => new FixtureDocumentExtractionProvider(clock),
    })
    .register({
      id: 'openai-multimodal',
      capabilities: openAiMultimodalCapabilities,
      validate: () => {
        if (!config.credentials.openAiApiKeyConfigured) {
          throw new ProviderMisconfiguredError({
            providerId: 'openai-multimodal',
            operation: 'DOCUMENT_EXTRACTION',
            safeMessage: 'The OpenAI document extraction provider is not configured',
            missingKeys: ['OPENAI_API_KEY'],
          });
        }
      },
      create: ({ clock }) =>
        new OpenAiMultimodalDocumentExtractionProvider(
          new LocalFilesystemDocumentStorage(config.storage.documentPath),
          openAiRuntimeModelId,
          clock,
          undefined,
          config.pricing.openAiExtraction,
        ),
    });
  const identityVerification = new ProviderRegistry<IdentityVerificationProvider, RegistryFactoryContext>().register({
    id: 'local-identity',
    capabilities: new FixtureIdentityVerificationProvider().capabilities,
    validate: () => undefined,
    create: ({ clock }) => new FixtureIdentityVerificationProvider(clock),
  });
  const addressVerification = new ProviderRegistry<AddressVerificationProvider, RegistryFactoryContext>().register({
    id: 'local-address',
    capabilities: new FixtureAddressVerificationProvider().capabilities,
    validate: () => undefined,
    create: ({ clock }) => new FixtureAddressVerificationProvider(clock),
  });
  const sanctionsScreening = new ProviderRegistry<SanctionsScreeningProvider, RegistryFactoryContext>()
    .register({
      id: 'fixture-sanctions',
      capabilities: new FixtureSanctionsScreeningProvider().capabilities,
      validate: () => undefined,
      create: ({ clock }) => new FixtureSanctionsScreeningProvider(clock),
    })
    .register({
      id: 'opensanctions-sanctions',
      capabilities: openSanctionsSanctionsCapabilities,
      validate: () => validateOpenSanctions('opensanctions-sanctions'),
      create: ({ clock, metrics }) =>
        new OpenSanctionsSanctionsScreeningProvider(
          resolveOpenSanctionsGateway(),
          screeningPolicy,
          Math.min(config.retry.maxAttempts, 2),
          clock,
          metrics,
        ),
    });
  const pepScreening = new ProviderRegistry<PepScreeningProvider, RegistryFactoryContext>()
    .register({
      id: 'fixture-pep',
      capabilities: new FixturePepScreeningProvider().capabilities,
      validate: () => undefined,
      create: ({ clock }) => new FixturePepScreeningProvider(clock),
    })
    .register({
      id: 'opensanctions-pep',
      capabilities: openSanctionsPepCapabilities,
      validate: () => validateOpenSanctions('opensanctions-pep'),
      create: ({ clock, metrics }) =>
        new OpenSanctionsPepScreeningProvider(
          resolveOpenSanctionsGateway(),
          screeningPolicy,
          Math.min(config.retry.maxAttempts, 2),
          clock,
          metrics,
        ),
    });
  const documentStorage = new ProviderRegistry<DocumentStorage, RegistryFactoryContext>().register({
    id: 'local-filesystem',
    capabilities: localCapabilities('DOCUMENT_STORAGE'),
    validate: () => undefined,
    create: () => new LocalFilesystemDocumentStorage(config.storage.documentPath),
  });
  const notification = new ProviderRegistry<NotificationProvider, RegistryFactoryContext>().register({
    id: 'local-inbox',
    capabilities: localCapabilities('NOTIFICATION'),
    validate: () => undefined,
    create: ({ client }) =>
      new LocalNotificationProvider(client, [
        new CapturingNotificationChannel(),
        new SafeConsoleNotificationChannel(message => process.stdout.write(`${message}\n`)),
        new CapturingWebhookNotificationChannel(),
      ]),
  });
  const webhookPublisher = new ProviderRegistry<WebhookPublisher, RegistryFactoryContext>().register({
    id: 'capture',
    capabilities: localCapabilities('WEBHOOK_PUBLICATION'),
    validate: () => undefined,
    create: () => new CapturingWebhookPublisher(),
  });
  const provisioning = new ProviderRegistry<AccountProvisioningProvider, RegistryFactoryContext>().register({
    id: 'simulated',
    capabilities: localCapabilities('ACCOUNT_PROVISIONING'),
    validate: () => undefined,
    create: ({ client, ids, clock }) => new SimulatedAccountProvisioningProvider(client, ids, clock),
  });
  const jurisdictionPolicy = new JurisdictionPolicyRegistry()
    .register('US/demo-default@1.0.0', new StaticJurisdictionPolicyProvider(demoDefaultPolicyV1))
    .register('US/demo-strict@1.0.0', new StaticJurisdictionPolicyProvider(demoStrictPolicyV1))
    .register('US/demo-default@1.1.0', new StaticJurisdictionPolicyProvider(demoDefaultPolicy))
    .register('US/demo-strict@1.1.0', new StaticJurisdictionPolicyProvider(demoStrictPolicy));
  const riskPolicy = new RiskPolicyRegistry()
    .register('demo-default@1.0.0', new DeterministicRiskPolicyProvider())
    .register('demo-strict@1.0.0', new DeterministicRiskPolicyProvider())
    .register('demo-default@1.1.0', new DeterministicRiskPolicyProvider())
    .register('demo-strict@1.1.0', new DeterministicRiskPolicyProvider());
  const model = new ModelRegistry()
    .register({
      id: 'fixture',
      provider: 'fixture',
      runtimeId: 'fixture',
      multimodal: true,
      structuredOutput: true,
      externalNetwork: false,
    })
    .register({
      id: openAiModelId,
      provider: 'openai',
      runtimeId: openAiRuntimeModelId,
      multimodal: true,
      structuredOutput: true,
      externalNetwork: true,
    });
  return Object.freeze({
    documentExtraction,
    identityVerification,
    addressVerification,
    sanctionsScreening,
    pepScreening,
    documentStorage,
    notification,
    webhookPublisher,
    provisioning,
    jurisdictionPolicy,
    riskPolicy,
    model,
    piiPolicy: new DeterministicPiiProtectionPolicy(),
  });
};

export const validateRegistrySelections = (config: AppConfig, registries: Registries): void => {
  const context = {
    environment: config.environment,
    piiMode: config.pii.mode,
    jurisdiction: config.jurisdiction.defaultJurisdiction,
  };
  registries.documentExtraction.validateSelection(config.providers.documentExtraction, 'DOCUMENT_EXTRACTION', context);
  registries.identityVerification.validateSelection(
    config.providers.identityVerification,
    'IDENTITY_VERIFICATION',
    context,
  );
  registries.addressVerification.validateSelection(
    config.providers.addressVerification,
    'ADDRESS_VERIFICATION',
    context,
  );
  registries.sanctionsScreening.validateSelection(config.providers.sanctionsScreening, 'SANCTIONS_SCREENING', context);
  registries.pepScreening.validateSelection(config.providers.pepScreening, 'PEP_SCREENING', context);
  registries.documentStorage.validateSelection(config.providers.documentStorage, 'DOCUMENT_STORAGE', context);
  registries.notification.validateSelection(config.providers.notification, 'NOTIFICATION', context);
  registries.webhookPublisher.validateSelection(config.providers.webhookPublisher, 'WEBHOOK_PUBLICATION', context);
  registries.provisioning.validateSelection(config.providers.provisioning, 'ACCOUNT_PROVISIONING', context);
  registries.model.resolve(config.model.documentExtraction);
  registries.model.resolve(config.model.agent);
  if (config.providers.riskAssessment === 'structured-llm') {
    registries.model.resolve(config.model.riskAssessment);
  }
  registries.jurisdictionPolicy.resolve(
    `${config.jurisdiction.defaultJurisdiction}/${config.jurisdiction.defaultPolicyProfile}@1.1.0`,
  );
  registries.riskPolicy.resolve(config.providers.riskPolicy);
};
