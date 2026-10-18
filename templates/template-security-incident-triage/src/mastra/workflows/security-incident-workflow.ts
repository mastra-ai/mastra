import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createHash } from 'node:crypto';
import type { ToolObserve } from '@mastra/core/tools';
import { z } from 'zod';

import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import {
  SECURITY_INCIDENT_WORKFLOW_ID,
  markWorkflowRunFailed,
  materializeInvestigationStart,
} from '../../db/workflow-run-operations.js';
import { opaqueId, tenantIdSchema } from '../../schemas/common.js';
import { CorrelationSchema } from '../../evidence/contracts.js';
import {
  createRetrieveRunbookStep,
  InvestigationStartedSchema,
  type RetrieveStepDependencies,
} from '../steps/retrieve-runbook.js';
import { createLoadInvestigationContextStep } from '../steps/load-investigation-context.js';
import { createValidateSupervisorScopeStep } from '../steps/validate-supervisor-scope.js';
import { createGatherIdentityEvidenceStep } from '../steps/gather-identity-evidence.js';
import { createGatherEndpointEvidenceStep } from '../steps/gather-endpoint-evidence.js';
import { createGatherCloudEvidenceStep } from '../steps/gather-cloud-evidence.js';
import { createCorrelateEventsStep } from '../steps/correlate-events.js';
import type {
  CloudEvidenceProvider,
  EndpointEvidenceProvider,
  IdentityEvidenceProvider,
} from '../../providers/evidence-provider.js';
import type { Clock } from '../../domain/clock.js';
import type { IdGenerator } from '../../domain/id-generator.js';
import { readAgentConfig, readApprovalConfig } from '../../env.js';
import type { InvestigatorInvoker } from '../agents/investigator-output.js';
import type { SupervisorInvoker } from '../agents/soc-supervisor.js';
import { socSupervisor } from '../agents/soc-supervisor.js';
import { createDelegatedInvestigator } from '../agents/bounded-delegation.js';
import type { CorrelationAnalystInvoker } from '../agents/correlation-analyst.js';
import type { EvidenceReadTool } from '../tools/evidence-read-tool.js';
import { createClassifySeverityStep, type TriageStepDependencies } from '../steps/classify-severity.js';
import { createGenerateSummaryStep } from '../steps/generate-summary.js';
import { createProposeContainmentStep } from '../steps/propose-containment.js';
import { createValidateContainmentStep } from '../steps/validate-containment.js';
import { TriageResultSchema } from '../../triage/decision-contracts.js';
import { IncidentResponseResultSchema } from '../../approval/contracts.js';
import { createRequestApprovalStep } from '../steps/request-approval.js';
import { createOpenExternalIncidentStep } from '../steps/open-external-incident.js';
import { createAwaitApprovalStep } from '../steps/await-approval.js';
import { createExecuteContainmentStep } from '../steps/execute-containment.js';
import { createVerifyContainmentStep } from '../steps/verify-containment.js';
import { createUpdateExternalIncidentStep } from '../steps/update-external-incident.js';
import { createFinalizeIncidentStep } from '../steps/finalize-incident.js';
import type { IncidentProvider } from '../../providers/incident-provider.js';
import { LocalIncidentProvider } from '../../providers/local-incident-provider.js';
import type { LocalContainmentState } from '../../containment/local-state.js';
import type { IdentityProvider } from '../../providers/identity-provider.js';
import { AlertWebhookSchema } from '../../app/webhooks/schemas.js';
import { normalizeAlertWebhook } from '../../app/webhooks/normalizers.js';
import { createIncidentFromAlertResult } from '../../db/incident-operations.js';
import type { ContainmentActionType } from '../../schemas/containment.js';

const WORKOS_CONTAINMENT_ACTION_TYPES: readonly ContainmentActionType[] = Object.freeze([
  'restore_previous_role',
  'revoke_session',
]);

export const DurableIncidentReferenceSchema = z
  .object({
    eventId: opaqueId,
    incidentId: opaqueId,
    tenantId: tenantIdSchema,
    alertId: opaqueId,
    correlationId: opaqueId,
  })
  .strict();

/**
 * The durable reference is used by the Hono outbox worker. The webhook shape
 * is accepted as a Studio-friendly reference path and is persisted through
 * the same incident boundary before any investigation step can run.
 */
export const SecurityIncidentWorkflowInputSchema = z.union([DurableIncidentReferenceSchema, AlertWebhookSchema]);

export function createSecurityIncidentWorkflow(
  openStore: () => OperationalStore = createLibSqlOperationalStore,
  retrieveDependencies: RetrieveStepDependencies = {},
  evidenceDependencies: Readonly<{
    identityProvider?: IdentityEvidenceProvider;
    endpointProvider?: EndpointEvidenceProvider;
    cloudProvider?: CloudEvidenceProvider;
    identityTool?: EvidenceReadTool;
    endpointTool?: EvidenceReadTool;
    cloudTool?: EvidenceReadTool;
    toolObserve?: ToolObserve;
    identityInvestigator?: InvestigatorInvoker;
    endpointInvestigator?: InvestigatorInvoker;
    cloudInvestigator?: InvestigatorInvoker;
    supervisor?: SupervisorInvoker;
    correlationAnalyst?: CorrelationAnalystInvoker;
    timeoutMs?: number;
    timeouts?: Partial<Record<'identity' | 'endpoint' | 'cloud', number>>;
    clock?: Clock;
    ids?: IdGenerator;
  }> = {},
  triageDependencies: TriageStepDependencies = {},
  responseDependencies: Readonly<{
    enabled?: boolean;
    provider?: IncidentProvider;
    state?: LocalContainmentState;
    mode?: 'local' | 'staging' | 'production';
    timeoutMs?: number;
    rateLimit?: number;
    identityProvider?: IdentityProvider;
    clock?: Clock;
    ids?: IdGenerator;
    allowWebhookInput?: boolean;
    studioLocalDecisions?: boolean;
  }> = {},
) {
  const startInvestigation = createStep({
    id: 'start-investigation',
    description: 'Materializes the idempotent received-to-investigating marker.',
    inputSchema: SecurityIncidentWorkflowInputSchema,
    outputSchema: InvestigationStartedSchema,
    execute: async ({ inputData, runId }) => {
      const store = openStore();
      try {
        const reference = await materializeSecurityIncidentInput(
          store,
          inputData,
          responseDependencies.allowWebhookInput === true,
          responseDependencies.studioLocalDecisions === true &&
            responseDependencies.mode === 'local' &&
            !responseDependencies.identityProvider
            ? runId
            : undefined,
        );
        const result = await materializeInvestigationStart(store, reference, {
          ...(evidenceDependencies.clock ? { clock: evidenceDependencies.clock } : {}),
          ...(evidenceDependencies.ids ? { ids: evidenceDependencies.ids } : {}),
        });
        return { ...reference, ...result };
      } finally {
        store.close();
      }
    },
  });
  const loadContext = createLoadInvestigationContextStep(openStore);
  const validateSupervisor = createValidateSupervisorScopeStep(evidenceDependencies.supervisor);
  const shared = {
    openStore,
    ...(evidenceDependencies.timeoutMs === undefined ? {} : { timeoutMs: evidenceDependencies.timeoutMs }),
    ...(evidenceDependencies.clock ? { clock: evidenceDependencies.clock } : {}),
    ...(evidenceDependencies.ids ? { ids: evidenceDependencies.ids } : {}),
    ...(evidenceDependencies.toolObserve ? { toolObserve: evidenceDependencies.toolObserve } : {}),
  };
  const gatherIdentity = createGatherIdentityEvidenceStep({
    ...shared,
    investigator: evidenceDependencies.identityInvestigator ?? createDelegatedInvestigator(socSupervisor, 'identity'),
    ...(evidenceDependencies.timeouts?.identity === undefined
      ? {}
      : { timeoutMs: evidenceDependencies.timeouts.identity }),
    ...(evidenceDependencies.identityProvider ? { provider: evidenceDependencies.identityProvider } : {}),
    ...(evidenceDependencies.identityTool ? { tool: evidenceDependencies.identityTool } : {}),
  });
  const gatherEndpoint = createGatherEndpointEvidenceStep({
    ...shared,
    investigator: evidenceDependencies.endpointInvestigator ?? createDelegatedInvestigator(socSupervisor, 'endpoint'),
    ...(evidenceDependencies.timeouts?.endpoint === undefined
      ? {}
      : { timeoutMs: evidenceDependencies.timeouts.endpoint }),
    ...(evidenceDependencies.endpointProvider ? { provider: evidenceDependencies.endpointProvider } : {}),
    ...(evidenceDependencies.endpointTool ? { tool: evidenceDependencies.endpointTool } : {}),
  });
  const gatherCloud = createGatherCloudEvidenceStep({
    ...shared,
    investigator: evidenceDependencies.cloudInvestigator ?? createDelegatedInvestigator(socSupervisor, 'cloud'),
    ...(evidenceDependencies.timeouts?.cloud === undefined ? {} : { timeoutMs: evidenceDependencies.timeouts.cloud }),
    ...(evidenceDependencies.cloudProvider ? { provider: evidenceDependencies.cloudProvider } : {}),
    ...(evidenceDependencies.cloudTool ? { tool: evidenceDependencies.cloudTool } : {}),
  });
  const correlate = createCorrelateEventsStep({
    openStore,
    ...(evidenceDependencies.clock ? { clock: evidenceDependencies.clock } : {}),
    ...(evidenceDependencies.correlationAnalyst ? { analyst: evidenceDependencies.correlationAnalyst } : {}),
  });
  const prepareRunbookRetrieval = createStep({
    id: 'prepare-runbook-retrieval',
    inputSchema: CorrelationSchema,
    outputSchema: InvestigationStartedSchema,
    execute: async ({ inputData, getStepResult }) => ({
      eventId: inputData.context.eventId,
      incidentId: inputData.context.incidentId,
      tenantId: inputData.context.tenantId,
      alertId: inputData.context.alertId,
      correlationId: inputData.context.correlationId,
      runId: inputData.context.workflowRunId,
      duplicate: getStepResult(startInvestigation).duplicate,
    }),
  });
  const approvalConfig = readApprovalConfig();
  const responseEnabled = responseDependencies.enabled === true;
  const responseMode = responseDependencies.mode ?? approvalConfig.mode;
  const providerActionTypes =
    responseEnabled && responseMode !== 'local'
      ? responseDependencies.identityProvider
        ? WORKOS_CONTAINMENT_ACTION_TYPES
        : []
      : undefined;
  const containmentActionTypes = providerActionTypes
    ? (triageDependencies.containmentActionTypes ?? providerActionTypes).filter(actionType =>
        providerActionTypes.includes(actionType),
      )
    : triageDependencies.containmentActionTypes;
  const triage = {
    ...triageDependencies,
    openStore: triageDependencies.openStore ?? openStore,
    ...(containmentActionTypes !== undefined ? { containmentActionTypes } : {}),
  };
  const externalIncidentProvider = responseDependencies.provider ?? new LocalIncidentProvider({ openStore });
  const containmentState: LocalContainmentState = responseDependencies.state ?? {
    sessions: new Map(),
    roles: new Map(),
    devices: new Map(),
    reauthentication: new Map(),
    calls: new Map(),
  };
  const responseContext = {
    openStore,
    ...(responseDependencies.clock
      ? { clock: responseDependencies.clock }
      : evidenceDependencies.clock
        ? { clock: evidenceDependencies.clock }
        : {}),
    ...(responseDependencies.ids
      ? { ids: responseDependencies.ids }
      : evidenceDependencies.ids
        ? { ids: evidenceDependencies.ids }
        : {}),
  };
  const workflow = createWorkflow({
    id: SECURITY_INCIDENT_WORKFLOW_ID,
    description:
      'Triages identity incidents through evidence-backed, approval-gated containment for privilege, country, and device signals.',
    inputSchema: SecurityIncidentWorkflowInputSchema,
    outputSchema: responseEnabled ? IncidentResponseResultSchema : TriageResultSchema,
    options: {
      onError: async ({ runId, error }) => {
        const store = openStore();
        try {
          const code = error && typeof error === 'object' && 'code' in error ? Reflect.get(error, 'code') : undefined;
          await markWorkflowRunFailed(store, {
            runId,
            ...(typeof code === 'string' ? { errorCode: code } : {}),
          });
        } finally {
          store.close();
        }
      },
    },
  })
    .then(startInvestigation)
    .then(loadContext)
    .then(validateSupervisor)
    .parallel([gatherIdentity, gatherEndpoint, gatherCloud])
    .then(correlate)
    .then(prepareRunbookRetrieval)
    .then(createRetrieveRunbookStep({ openStore, ...retrieveDependencies }))
    .then(createClassifySeverityStep(triage))
    .then(createGenerateSummaryStep(triage))
    .then(createProposeContainmentStep(triage))
    .then(createValidateContainmentStep(triage));
  if (!responseEnabled) return workflow.commit();
  return workflow
    .then(createRequestApprovalStep(responseContext))
    .then(
      createOpenExternalIncidentStep({
        ...responseContext,
        provider: externalIncidentProvider,
      }),
    )
    .then(
      createAwaitApprovalStep({
        ...responseContext,
        studioLocalDecisions:
          responseDependencies.studioLocalDecisions === true &&
          responseMode === 'local' &&
          !responseDependencies.identityProvider,
      }),
    )
    .then(
      createExecuteContainmentStep({
        ...responseContext,
        state: containmentState,
        mode: responseMode,
        timeoutMs: responseDependencies.timeoutMs ?? approvalConfig.actionTimeoutMs,
        rateLimit: responseDependencies.rateLimit ?? approvalConfig.rateLimit,
        ...(responseDependencies.identityProvider ? { identityProvider: responseDependencies.identityProvider } : {}),
      }),
    )
    .then(createVerifyContainmentStep(responseContext))
    .then(
      createUpdateExternalIncidentStep({
        ...responseContext,
        provider: externalIncidentProvider,
      }),
    )
    .then(createFinalizeIncidentStep(responseContext))
    .commit();
}

/** Named configuration used by the runtime; the positional factory stays compatible. */
export type SecurityIncidentWorkflowOptions = Readonly<{
  openStore?: Parameters<typeof createSecurityIncidentWorkflow>[0];
  retrieval?: RetrieveStepDependencies;
  evidence?: Parameters<typeof createSecurityIncidentWorkflow>[2];
  triage?: TriageStepDependencies;
  response?: Parameters<typeof createSecurityIncidentWorkflow>[4];
}>;

export function createConfiguredSecurityIncidentWorkflow(options: SecurityIncidentWorkflowOptions = {}) {
  return createSecurityIncidentWorkflow(
    options.openStore,
    options.retrieval,
    options.evidence,
    options.triage,
    options.response,
  );
}

const agentConfig = readAgentConfig();
/** Compatibility default. Hono and Studio register the configured runtime instance. */
export const securityIncidentWorkflow = createSecurityIncidentWorkflow(
  createLibSqlOperationalStore,
  {},
  { timeouts: agentConfig.timeouts },
  {},
  { enabled: true },
);

export async function materializeSecurityIncidentInput(
  store: OperationalStore,
  input: z.infer<typeof SecurityIncidentWorkflowInputSchema>,
  allowWebhookInput = true,
  studioRunId?: string,
): Promise<z.infer<typeof DurableIncidentReferenceSchema>> {
  const durable = DurableIncidentReferenceSchema.safeParse(input);
  if (durable.success) return durable.data;
  if (!allowWebhookInput) {
    throw new Error('STUDIO_WEBHOOK_INPUT_DISABLED');
  }

  const webhook = AlertWebhookSchema.parse(input);
  if (studioRunId && webhook.source === 'studio-demo') {
    // Fresh per Studio run, stable under retries of the same run.
    webhook.sourceEventId = `studio-demo-${createHash('sha256').update(`${webhook.tenantId}:${studioRunId}`).digest('hex')}`;
    const previous = await store.execute({
      sql: 'SELECT occurred_at FROM alerts WHERE tenant_id=? AND source=? AND source_event_id=?',
      args: [webhook.tenantId, webhook.source, webhook.sourceEventId],
    });
    webhook.occurredAt = previous.rows[0] ? String(previous.rows[0].occurred_at) : new Date().toISOString();
  }
  const rawBody = new TextEncoder().encode(JSON.stringify(webhook));
  const normalized = normalizeAlertWebhook(webhook, rawBody, new Set([webhook.source]));
  if (normalized.disposition !== 'alert') {
    throw new Error('ALERT_NORMALIZATION_FAILED');
  }
  const persisted = await createIncidentFromAlertResult(store, normalized.alert, {
    correlationId: normalized.alert.idempotencyKey,
    enforceAlertOrdering: true,
    scheduleWorkflow: false,
  });
  const event = await store.execute({
    sql: `SELECT id, correlation_id FROM outbox_events
      WHERE tenant_id = ? AND incident_id = ?
        AND type = 'security.alert.received'
      ORDER BY occurred_at ASC LIMIT 1`,
    args: [webhook.tenantId, persisted.incident.incidentId],
  });
  const row = event.rows[0];
  return DurableIncidentReferenceSchema.parse({
    eventId: row?.id,
    incidentId: persisted.incident.incidentId,
    tenantId: webhook.tenantId,
    alertId: normalized.alert.alertId,
    correlationId: row?.correlation_id,
  });
}
