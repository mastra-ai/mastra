import type { Mastra } from '@mastra/core/mastra';
import type { NotificationProvider } from './contracts/communications/notifications.js';
import type { WebhookPublisher } from './contracts/communications/webhook-publisher.js';
import type {
  JurisdictionPolicyProvider,
  PiiProtectionPolicy,
  RiskPolicyProvider,
} from './contracts/policies/policies.js';
import type { MultimodalDocumentExtractionProvider } from './contracts/providers/document-extraction.js';
import type { DocumentStorage } from './contracts/providers/document-storage.js';
import type { RiskAssessmentProvider } from './contracts/providers/risk-assessment.js';
import type { PepScreeningProvider, SanctionsScreeningProvider } from './contracts/providers/screening.js';
import type { AddressVerificationProvider, IdentityVerificationProvider } from './contracts/providers/verification.js';
import type { AccountProvisioningProvider } from './contracts/provisioning/account-provisioning.js';

import {
  loadRuntimeSecrets,
  type AppConfig,
  type RuntimeSecretResolver,
  type RuntimeSecrets,
} from './config/load-config.js';
import { loadScreeningPolicy } from './config/policies/screening.js';
import { createKycOnboardingAgent, type KycOnboardingAgent } from './mastra/agents/kyc-onboarding-agent.js';
import { createMastra } from './mastra/create-mastra.js';
import { createStartKycApplicationTool, type StartKycApplicationTool } from './mastra/tools/start-kyc-application.js';
import {
  createDecideKycReviewTool,
  createListPendingKycActionsTool,
  createSubmitKycInformationTool,
  type DecideKycReviewTool,
  type ListPendingKycActionsTool,
  type ResumeKycDependencies,
  type SubmitKycInformationTool,
} from './mastra/tools/resume-kyc-application.js';
import {
  createAddressVerificationTool,
  createIdentityVerificationTool,
  createPepScreeningTool,
  createSanctionsScreeningTool,
  type VerificationCheckTools,
} from './mastra/tools/verification-checks.js';
import {
  createKycApplicationWorkflow,
  type KycApplicationWorkflow,
} from './mastra/workflows/kyc-application-intake.js';
import {
  createDurableKycOnboardingWorkflow,
  type DurableKycOnboardingWorkflow,
} from './mastra/workflows/durable-kyc-onboarding.js';
import {
  LocalProviderHealthCheck,
  SystemClock,
  UuidV7IdGenerator,
} from './providers/local/deterministic-primitives.js';
import { createRegistries, validateRegistrySelections } from './registries/create-registries.js';
import {
  CapturingNotificationChannel,
  CapturingWebhookNotificationChannel,
  LocalNotificationProvider,
  SafeConsoleNotificationChannel,
  SignedWebhookNotificationChannel,
} from './providers/local/local-communications.js';
import { ApplicationIntakeService } from './services/application-intake.js';
import { CompletenessAssessmentService } from './services/completeness-assessment.js';
import {
  AddressVerificationService,
  IdentityVerificationService,
  PepScreeningService,
  SanctionsScreeningService,
} from './services/check-execution.js';
import { DocumentExtractionService } from './services/document-extraction.js';
import { DocumentIntakeService } from './services/document-intake.js';
import { ExtractionRoutingService } from './services/extraction-routing.js';
import { EvidenceAggregationService } from './services/evidence-aggregation.js';
import { RiskAssessmentService } from './services/risk-assessment.js';
import { MissingInformationService } from './services/missing-information.js';
import { ComplianceReviewService } from './services/compliance-review.js';
import { KycMetricsService } from './services/kyc-metrics.js';
import { initializeStorage, type FoundationStorage } from './storage/initialize-storage.js';
import { LibSqlApplicationRepository } from './storage/libsql/application-repository.js';
import { LibSqlCaseEventRepository } from './storage/libsql/case-event-repository.js';
import { LibSqlCaseRepository } from './storage/libsql/case-repository.js';
import { LibSqlCostRecorder } from './storage/libsql/cost-recorder.js';
import { LibSqlDocumentRepository } from './storage/libsql/document-repository.js';
import { LibSqlDocumentExtractionRepository } from './storage/libsql/document-extraction-repository.js';
import {
  LibSqlCasePolicySnapshotRepository,
  LibSqlComplianceReviewRepository,
  LibSqlInformationRequestRepository,
  LibSqlRiskAssessmentRepository,
  LibSqlWorkflowResumeCommandRepository,
} from './storage/libsql/decision-repositories.js';
import { LibSqlEvidenceRepository } from './storage/libsql/evidence-repository.js';
import { LibSqlIdempotencyRepository } from './storage/libsql/idempotency-repository.js';
import { LibSqlReviewerFeedbackRepository } from './storage/libsql/reviewer-feedback-repository.js';
import { LibSqlStudioCaseLinkRepository } from './storage/libsql/studio-case-link-repository.js';
import { LibSqlWebhookReceiptRepository } from './storage/libsql/webhook-receipt-repository.js';
import type { WebhookKeyring } from './server/webhook-signing.js';
import {
  RuleBasedRiskAssessmentProvider,
  StructuredLlmRiskAssessmentProvider,
} from './providers/risk/risk-assessment.js';

export type KycRepositories = Readonly<{
  cases: LibSqlCaseRepository;
  applications: LibSqlApplicationRepository;
  documents: LibSqlDocumentRepository;
  documentExtractions: LibSqlDocumentExtractionRepository;
  evidence: LibSqlEvidenceRepository;
  reviewerFeedback: LibSqlReviewerFeedbackRepository;
  caseEvents: LibSqlCaseEventRepository;
  idempotency: LibSqlIdempotencyRepository;
  studioCaseLinks: LibSqlStudioCaseLinkRepository;
  casePolicySnapshots: LibSqlCasePolicySnapshotRepository;
  informationRequests: LibSqlInformationRequestRepository;
  riskAssessments: LibSqlRiskAssessmentRepository;
  complianceReviews: LibSqlComplianceReviewRepository;
  workflowResumeCommands: LibSqlWorkflowResumeCommandRepository;
  webhookReceipts: LibSqlWebhookReceiptRepository;
}>;

export type KycProviders = Readonly<{
  documentExtraction: MultimodalDocumentExtractionProvider;
  identityVerification: IdentityVerificationProvider;
  addressVerification: AddressVerificationProvider;
  sanctionsScreening: SanctionsScreeningProvider;
  pepScreening: PepScreeningProvider;
  documentStorage: DocumentStorage;
  notification: NotificationProvider;
  webhookPublisher: WebhookPublisher;
  provisioning: AccountProvisioningProvider;
  riskAssessment: RiskAssessmentProvider;
}>;

export type KycPolicies = Readonly<{
  jurisdiction: JurisdictionPolicyProvider;
  risk: RiskPolicyProvider;
  pii: PiiProtectionPolicy;
}>;

export type KycServices = Readonly<{
  applicationIntake: ApplicationIntakeService;
  documentIntake: DocumentIntakeService;
  documentExtraction: DocumentExtractionService;
  extractionRouting: ExtractionRoutingService;
  identityVerification: IdentityVerificationService;
  addressVerification: AddressVerificationService;
  sanctionsScreening: SanctionsScreeningService;
  pepScreening: PepScreeningService;
  completeness: CompletenessAssessmentService;
  evidenceAggregation: EvidenceAggregationService;
  riskAssessment: RiskAssessmentService;
  missingInformation: MissingInformationService;
  complianceReview: ComplianceReviewService;
  metrics: KycMetricsService;
}>;

export type KycWorkflows = Readonly<{
  kycApplication: KycApplicationWorkflow;
  durableKycOnboarding: DurableKycOnboardingWorkflow;
}>;

export type KycTools = VerificationCheckTools &
  Readonly<{
    startKycApplication: StartKycApplicationTool;
    listPendingKycActions: ListPendingKycActionsTool;
    submitKycInformation: SubmitKycInformationTool;
    decideKycReview: DecideKycReviewTool;
  }>;

export type FoundationDependencies = Readonly<{
  config: AppConfig;
  mastra: Mastra;
  storage: FoundationStorage;
  clock: SystemClock;
  ids: UuidV7IdGenerator;
  repositories: KycRepositories;
  providers: KycProviders;
  policies: KycPolicies;
  providerHealth: LocalProviderHealthCheck;
  costRecorder: LibSqlCostRecorder;
  services: KycServices;
  workflows: KycWorkflows;
  tools: KycTools;
  agents: Readonly<{ kycOnboarding: KycOnboardingAgent }>;
  resume: ResumeKycDependencies;
  webhooks: Readonly<{
    customerResponse: WebhookKeyring;
    complianceDecision: Readonly<{
      reviewer: WebhookKeyring;
      seniorReviewer: WebhookKeyring;
    }>;
    outboundNotification: WebhookKeyring;
    outboundUrl?: string | undefined;
  }>;
}>;

export const createDependencies = async (
  config: AppConfig,
  resolveSecrets: RuntimeSecretResolver = loadRuntimeSecrets,
): Promise<FoundationDependencies> => {
  let resolvedSecrets: RuntimeSecrets | undefined;
  const memoizedSecrets = (): RuntimeSecrets => {
    resolvedSecrets ??= resolveSecrets();
    return resolvedSecrets;
  };
  const registries = createRegistries(config, memoizedSecrets);
  validateRegistrySelections(config, registries);
  const requiresWebhookSecrets =
    config.environment === 'live' ||
    config.credentials.customerWebhookSecretConfigured ||
    config.credentials.complianceReviewerWebhookSecretConfigured ||
    config.credentials.complianceSeniorWebhookSecretConfigured ||
    config.credentials.outboundWebhookSecretConfigured ||
    config.credentials.outboundWebhookUrl !== undefined;
  const runtimeSecrets = requiresWebhookSecrets ? memoizedSecrets() : {};
  const localSecret = (purpose: string): string => `local-demo-${purpose}-secret-material-2026`;
  const requiredSecret = (value: string | undefined, purpose: string): string => {
    if (value !== undefined) return value;
    if (config.environment !== 'live') return localSecret(purpose);
    throw new Error(`${purpose} webhook secret is required in live mode`);
  };
  const keyring = (
    purpose: 'customer' | 'compliance-reviewer' | 'compliance-senior' | 'outbound',
    current: string | undefined,
    previous: string | undefined,
  ): WebhookKeyring => ({
    current: { keyId: `${purpose}-v1`, secret: requiredSecret(current, purpose) },
    ...(previous === undefined ? {} : { previous: { keyId: `${purpose}-v0`, secret: previous } }),
  });
  const customerWebhookKeyring = keyring(
    'customer',
    runtimeSecrets.customerWebhookCurrentSecret,
    runtimeSecrets.customerWebhookPreviousSecret,
  );
  const complianceReviewerWebhookKeyring = keyring(
    'compliance-reviewer',
    runtimeSecrets.complianceReviewerWebhookCurrentSecret,
    runtimeSecrets.complianceReviewerWebhookPreviousSecret,
  );
  const complianceSeniorWebhookKeyring = keyring(
    'compliance-senior',
    runtimeSecrets.complianceSeniorWebhookCurrentSecret,
    runtimeSecrets.complianceSeniorWebhookPreviousSecret,
  );
  const outboundWebhookKeyring = keyring(
    'outbound',
    runtimeSecrets.outboundWebhookCurrentSecret,
    runtimeSecrets.outboundWebhookPreviousSecret,
  );
  const storage = await initializeStorage(config);
  const clock = new SystemClock();
  const ids = new UuidV7IdGenerator(clock);
  const costRecorder = new LibSqlCostRecorder(storage.operational);
  const idempotency = new LibSqlIdempotencyRepository(storage.operational);
  const metrics = new KycMetricsService(storage.operational, storage.analytics, clock);
  const factoryContext = { client: storage.operational, ids, clock, metrics };
  const providers = Object.freeze({
    documentExtraction: registries.documentExtraction.resolve(config.providers.documentExtraction, factoryContext),
    identityVerification: registries.identityVerification.resolve(
      config.providers.identityVerification,
      factoryContext,
    ),
    addressVerification: registries.addressVerification.resolve(config.providers.addressVerification, factoryContext),
    sanctionsScreening: registries.sanctionsScreening.resolve(config.providers.sanctionsScreening, factoryContext),
    pepScreening: registries.pepScreening.resolve(config.providers.pepScreening, factoryContext),
    documentStorage: registries.documentStorage.resolve(config.providers.documentStorage, factoryContext),
    notification:
      runtimeSecrets.outboundWebhookUrl === undefined
        ? registries.notification.resolve(config.providers.notification, factoryContext)
        : new LocalNotificationProvider(storage.operational, [
            new CapturingNotificationChannel(),
            new SafeConsoleNotificationChannel(message => process.stdout.write(`${message}\n`)),
            new CapturingWebhookNotificationChannel(),
            new SignedWebhookNotificationChannel(runtimeSecrets.outboundWebhookUrl, outboundWebhookKeyring, fetch, () =>
              clock.now(),
            ),
          ]),
    webhookPublisher: registries.webhookPublisher.resolve(config.providers.webhookPublisher, factoryContext),
    provisioning: registries.provisioning.resolve(config.providers.provisioning, factoryContext),
    riskAssessment:
      config.providers.riskAssessment === 'structured-llm'
        ? new StructuredLlmRiskAssessmentProvider(
            registries.model.resolve(config.model.riskAssessment).runtimeId,
            clock,
            undefined,
            costRecorder,
            idempotency,
            metrics,
          )
        : new RuleBasedRiskAssessmentProvider(),
  });
  const providerHealth = new LocalProviderHealthCheck(
    clock,
    new Set([
      config.providers.documentExtraction,
      config.providers.identityVerification,
      config.providers.addressVerification,
      config.providers.sanctionsScreening,
      config.providers.pepScreening,
      config.providers.documentStorage,
      config.providers.notification,
      config.providers.webhookPublisher,
      config.providers.provisioning,
    ]),
  );
  const repositories = Object.freeze({
    cases: new LibSqlCaseRepository(storage.operational),
    applications: new LibSqlApplicationRepository(storage.operational),
    documents: new LibSqlDocumentRepository(storage.operational),
    documentExtractions: new LibSqlDocumentExtractionRepository(storage.operational),
    evidence: new LibSqlEvidenceRepository(storage.operational),
    reviewerFeedback: new LibSqlReviewerFeedbackRepository(storage.operational),
    caseEvents: new LibSqlCaseEventRepository(storage.operational),
    idempotency,
    studioCaseLinks: new LibSqlStudioCaseLinkRepository(storage.operational),
    casePolicySnapshots: new LibSqlCasePolicySnapshotRepository(storage.operational),
    informationRequests: new LibSqlInformationRequestRepository(storage.operational),
    riskAssessments: new LibSqlRiskAssessmentRepository(storage.operational),
    complianceReviews: new LibSqlComplianceReviewRepository(storage.operational),
    workflowResumeCommands: new LibSqlWorkflowResumeCommandRepository(storage.operational),
    webhookReceipts: new LibSqlWebhookReceiptRepository(storage.operational),
  });
  const policies = Object.freeze({
    jurisdiction: registries.jurisdictionPolicy.resolve(
      `${config.jurisdiction.defaultJurisdiction}/${config.jurisdiction.defaultPolicyProfile}@1.1.0`,
    ),
    risk: registries.riskPolicy.resolve(config.providers.riskPolicy),
    pii: registries.piiPolicy,
  });
  const screeningPolicy = loadScreeningPolicy(config.jurisdiction.defaultPolicyProfile);
  const sharedCheckServiceDependencies = [
    repositories.cases,
    repositories.applications,
    repositories.documentExtractions,
    repositories.evidence,
    repositories.idempotency,
    policies.pii,
    clock,
    config.pii.externalProviderAllowlist,
    metrics,
  ] as const;
  const completeness = new CompletenessAssessmentService(repositories.documents, repositories.documentExtractions);
  const evidenceAggregation = new EvidenceAggregationService(repositories.evidence);
  const riskAssessment = new RiskAssessmentService(
    repositories.casePolicySnapshots,
    completeness,
    evidenceAggregation,
    policies.risk,
    providers.riskAssessment,
    repositories.riskAssessments,
    clock,
  );
  const missingInformation = new MissingInformationService(
    repositories.informationRequests,
    repositories.workflowResumeCommands,
    providers.notification,
    clock,
  );
  const complianceReview = new ComplianceReviewService(
    repositories.casePolicySnapshots,
    repositories.riskAssessments,
    repositories.complianceReviews,
    repositories.workflowResumeCommands,
    providers.notification,
    clock,
  );
  const services = Object.freeze({
    applicationIntake: new ApplicationIntakeService(repositories.cases, repositories.applications, clock, ids),
    documentIntake: new DocumentIntakeService(
      repositories.cases,
      repositories.documents,
      providers.documentStorage,
      clock,
      ids,
    ),
    documentExtraction: new DocumentExtractionService(
      providers.documentExtraction,
      policies.pii,
      repositories.documentExtractions,
      repositories.evidence,
      repositories.idempotency,
      costRecorder,
      clock,
      config.pii.externalProviderAllowlist,
      metrics,
    ),
    extractionRouting: new ExtractionRoutingService(repositories.cases, clock, ids),
    identityVerification: new IdentityVerificationService(
      providers.identityVerification,
      screeningPolicy,
      ...sharedCheckServiceDependencies,
    ),
    addressVerification: new AddressVerificationService(
      providers.addressVerification,
      screeningPolicy,
      ...sharedCheckServiceDependencies,
    ),
    sanctionsScreening: new SanctionsScreeningService(
      providers.sanctionsScreening,
      screeningPolicy,
      ...sharedCheckServiceDependencies,
    ),
    pepScreening: new PepScreeningService(providers.pepScreening, screeningPolicy, ...sharedCheckServiceDependencies),
    completeness,
    evidenceAggregation,
    riskAssessment,
    missingInformation,
    complianceReview,
    metrics,
  });
  const checkTools = Object.freeze({
    identityVerification: createIdentityVerificationTool(services.identityVerification, config.retry.timeoutMs),
    addressVerification: createAddressVerificationTool(services.addressVerification, config.retry.timeoutMs),
    sanctionsScreening: createSanctionsScreeningTool(services.sanctionsScreening, config.retry.timeoutMs),
    pepScreening: createPepScreeningTool(services.pepScreening, config.retry.timeoutMs),
  });
  const kycApplicationWorkflow = createKycApplicationWorkflow({
    ...services,
    cases: repositories.cases,
    documents: repositories.documents,
    documentExtractions: repositories.documentExtractions,
    casePolicySnapshots: repositories.casePolicySnapshots,
    studioCaseLinks: repositories.studioCaseLinks,
    jurisdictionPolicy: policies.jurisdiction,
    clock,
    modelId: config.model.documentExtraction,
    schemaVersion: '1.0.0',
    timeoutMs: config.retry.timeoutMs,
    ...checkTools,
  });
  const durableKycOnboardingWorkflow = createDurableKycOnboardingWorkflow({
    initialWorkflow: kycApplicationWorkflow,
    cases: repositories.cases,
    snapshots: repositories.casePolicySnapshots,
    informationRequests: repositories.informationRequests,
    reviews: repositories.complianceReviews,
    resumeCommands: repositories.workflowResumeCommands,
    completeness: services.completeness,
    evidence: services.evidenceAggregation,
    missingInformation: services.missingInformation,
    riskAssessment: services.riskAssessment,
    complianceReview: services.complianceReview,
    provisioning: providers.provisioning,
    providerMetrics: metrics,
    clock,
    timeoutMs: config.retry.timeoutMs,
    ...checkTools,
  });
  const workflows = Object.freeze({
    kycApplication: kycApplicationWorkflow,
    durableKycOnboarding: durableKycOnboardingWorkflow,
  });
  const defaultJurisdictionPolicy = await policies.jurisdiction.resolve({
    jurisdiction: config.jurisdiction.defaultJurisdiction,
    profile: config.jurisdiction.defaultPolicyProfile,
  });
  const trustedStudioDefaults = Object.freeze({
    tenantId: config.tenant.defaultTenantId,
    jurisdiction: config.jurisdiction.defaultJurisdiction,
    piiMode: config.pii.mode,
    policy: {
      id: defaultJurisdictionPolicy.id,
      version: defaultJurisdictionPolicy.version,
      checksum: defaultJurisdictionPolicy.checksum,
    },
    locale: config.locale,
    policyProfile: config.jurisdiction.defaultPolicyProfile,
  });
  const resumeToolDependencies = Object.freeze({
    workflow: durableKycOnboardingWorkflow,
    cases: repositories.cases,
    applications: repositories.applications,
    snapshots: repositories.casePolicySnapshots,
    informationRequests: repositories.informationRequests,
    reviews: repositories.complianceReviews,
    commands: repositories.workflowResumeCommands,
    documents: repositories.documents,
    studioCaseLinks: repositories.studioCaseLinks,
    documentIntake: services.documentIntake,
    documentExtraction: services.documentExtraction,
    complianceReview: services.complianceReview,
    clock,
    modelId: config.model.documentExtraction,
    schemaVersion: '1.0.0',
    timeoutMs: config.retry.timeoutMs,
    trustedDefaults: trustedStudioDefaults,
  });
  const tools = Object.freeze({
    ...checkTools,
    startKycApplication: createStartKycApplicationTool(
      durableKycOnboardingWorkflow,
      repositories.studioCaseLinks,
      trustedStudioDefaults,
    ),
    listPendingKycActions: createListPendingKycActionsTool(resumeToolDependencies),
    submitKycInformation: createSubmitKycInformationTool(resumeToolDependencies),
    decideKycReview: createDecideKycReviewTool(resumeToolDependencies),
  });
  const agents = Object.freeze({
    kycOnboarding: createKycOnboardingAgent(
      {
        startKycApplication: tools.startKycApplication,
        listPendingKycActions: tools.listPendingKycActions,
        submitKycInformation: tools.submitKycInformation,
        decideKycReview: tools.decideKycReview,
      },
      registries.model.resolve(config.model.agent).runtimeId,
    ),
  });
  return Object.freeze({
    config,
    mastra: createMastra(storage.mastra, kycApplicationWorkflow, durableKycOnboardingWorkflow, agents.kycOnboarding),
    storage,
    clock,
    ids,
    repositories,
    providers,
    policies,
    providerHealth,
    costRecorder,
    services,
    workflows,
    tools,
    agents,
    resume: resumeToolDependencies,
    webhooks: Object.freeze({
      customerResponse: customerWebhookKeyring,
      complianceDecision: {
        reviewer: complianceReviewerWebhookKeyring,
        seniorReviewer: complianceSeniorWebhookKeyring,
      },
      outboundNotification: outboundWebhookKeyring,
      ...(runtimeSecrets.outboundWebhookUrl === undefined ? {} : { outboundUrl: runtimeSecrets.outboundWebhookUrl }),
    }),
  });
};
