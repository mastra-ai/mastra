import { Mastra } from '@mastra/core/mastra';

import { createIdentityInvestigator } from './agents/identity-investigator.js';
import { createEndpointInvestigator } from './agents/endpoint-investigator.js';
import { createCloudInvestigator } from './agents/cloud-investigator.js';
import { createCorrelationAnalyst, createCorrelationAnalystInvoker } from './agents/correlation-analyst.js';
import { createSocSupervisor } from './agents/soc-supervisor.js';
import { createResponsePlanner } from './agents/response-planner.js';
import { storage } from './storage.js';
import { createConfiguredSecurityIncidentWorkflow } from './workflows/security-incident-workflow.js';
import { createDelegatedInvestigator } from './agents/bounded-delegation.js';
import { createResponsePlannerInvoker } from './agents/response-planner-invoker.js';
import { observability } from './observability.js';
import { securityScorers } from './scorers/security-scorers.js';
import { readIntegrationConfig, hasEnabledIntegration, type AgentConfig, type IntegrationConfig } from '../env.js';
import { createGeoIpProvider, createIdentityProvider, createIncidentProvider } from '../providers/runtime-factory.js';
import { createLibSqlOperationalStore } from '../db/libsql-operational-store.js';
import {
  DisabledIdentityEvidenceProvider,
  LocalIdentityEvidenceProvider,
  WorkOsIdentityEvidenceProvider,
} from '../providers/identity-evidence-provider.js';
import { GeoIpIdentityEvidenceProvider } from '../providers/geoip-evidence-provider.js';
import { LocalCloudEvidenceProvider } from '../providers/cloud-evidence-provider.js';
import { InProcessDomainPubSub } from '../workers/in-process-domain-pubsub.js';
import {
  DisabledEndpointEvidenceProvider,
  LocalEndpointEvidenceProvider,
  FirstPartyDeviceTrustEvidenceProvider,
} from '../providers/endpoint-evidence-provider.js';

export { storage } from './storage.js';
function assembleSecurityIncidentWorkflow(
  agentConfig: AgentConfig,
  allowWebhookInput: boolean,
  integrationConfig: IntegrationConfig,
  agents: {
    socSupervisor: ReturnType<typeof createSocSupervisor>;
    correlationAnalyst: ReturnType<typeof createCorrelationAnalyst>;
    responsePlanner: ReturnType<typeof createResponsePlanner>;
  },
) {
  const localStudio =
    allowWebhookInput && integrationConfig.mode === 'local' && !hasEnabledIntegration(integrationConfig);
  const incidentProvider = createIncidentProvider(integrationConfig);
  const geoIpProvider = createGeoIpProvider(integrationConfig, {
    openStore: createLibSqlOperationalStore,
  });
  const identityProvider = createIdentityProvider(
    integrationConfig,
    // The adapter independently verifies the active execution fence and durable
    // target-bound provider ledger before a remote mutation.
    () => true,
    { openStore: createLibSqlOperationalStore },
  );
  const identityEvidenceBase =
    integrationConfig.mode === 'local'
      ? new LocalIdentityEvidenceProvider()
      : identityProvider
        ? new WorkOsIdentityEvidenceProvider(identityProvider)
        : new DisabledIdentityEvidenceProvider();
  const identityEvidenceProvider = geoIpProvider
    ? new GeoIpIdentityEvidenceProvider({
        base: identityEvidenceBase,
        geoip: geoIpProvider,
        timeoutMs: integrationConfig.ipinfo.timeoutMs,
      })
    : identityEvidenceBase;
  // IPinfo is the only location authority in an integrated runtime. Keep the
  // reference cloud adapter only for configured policy, without inventing
  // observations when external country or session history is unavailable.
  const cloudEvidenceProvider =
    integrationConfig.mode !== 'local'
      ? new LocalCloudEvidenceProvider({
          countryByIp: {},
          includeIpPresence: false,
          includeSessionHistory: false,
        })
      : undefined;
  const endpointEvidenceProvider =
    integrationConfig.mode === 'local'
      ? localStudio
        ? new LocalEndpointEvidenceProvider({
            verifyDeviceSignature: input => input.deviceId === 'studio-demo-new-device',
          })
        : undefined
      : integrationConfig.deviceTrust.enabled
        ? new FirstPartyDeviceTrustEvidenceProvider(createLibSqlOperationalStore)
        : new DisabledEndpointEvidenceProvider();
  return createConfiguredSecurityIncidentWorkflow({
    openStore: createLibSqlOperationalStore,
    evidence: {
      identityInvestigator: createDelegatedInvestigator(agents.socSupervisor, 'identity'),
      endpointInvestigator: createDelegatedInvestigator(agents.socSupervisor, 'endpoint'),
      cloudInvestigator: createDelegatedInvestigator(agents.socSupervisor, 'cloud'),
      correlationAnalyst: createCorrelationAnalystInvoker(agents.correlationAnalyst),
      identityProvider: identityEvidenceProvider,
      ...(cloudEvidenceProvider ? { cloudProvider: cloudEvidenceProvider } : {}),
      ...(endpointEvidenceProvider ? { endpointProvider: endpointEvidenceProvider } : {}),
      timeouts: agentConfig.timeouts,
    },
    triage: { planner: createResponsePlannerInvoker(agents.responsePlanner) },
    response: {
      enabled: true,
      allowWebhookInput,
      studioLocalDecisions: localStudio,
      provider: incidentProvider,
      mode: integrationConfig.mode,
      ...(identityProvider ? { identityProvider } : {}),
    },
  });
}
/**
 * Builds the domain-event transport used only by the Hono outbox/ingestion
 * boundary. Mastra keeps its own in-process PubSub for orchestration events:
 * those events have a different contract and must never share a durable
 * external stream with webhook-derived domain messages.
 *
 * The transactional outbox remains the durable source of truth. This
 * transport only coordinates delivery to the worker in the current process.
 */
export function createDomainEventPubSub(): InProcessDomainPubSub {
  return new InProcessDomainPubSub();
}

/** Builds the Mastra application from configuration validated at boot. */
export function createRuntimeMastra(
  agentConfig: AgentConfig,
  options: Readonly<{
    allowWebhookInput?: boolean;
    integrationConfig?: IntegrationConfig;
  }> = {},
): Mastra {
  const identityInvestigator = createIdentityInvestigator(agentConfig.model);
  const endpointInvestigator = createEndpointInvestigator(agentConfig.model);
  const cloudInvestigator = createCloudInvestigator(agentConfig.model);
  const correlationAnalyst = createCorrelationAnalyst(agentConfig.model);
  const socSupervisor = createSocSupervisor(agentConfig.model, {
    identityInvestigator,
    endpointInvestigator,
    cloudInvestigator,
  });
  const responsePlanner = createResponsePlanner(agentConfig.model);
  return new Mastra({
    scorers: securityScorers,
    agents: {
      identityInvestigator,
      endpointInvestigator,
      cloudInvestigator,
      correlationAnalyst,
      socSupervisor,
      responsePlanner,
    },
    workflows: {
      securityIncidentWorkflow: assembleSecurityIncidentWorkflow(
        agentConfig,
        options.allowWebhookInput === true,
        options.integrationConfig ?? readIntegrationConfig(),
        { socSupervisor, correlationAnalyst, responsePlanner },
      ),
    },
    storage,
    observability,
  });
}
