import { RequestContext } from '@mastra/core/request-context';

import type { JurisdictionPolicyProvider } from '../contracts/policies/policies.js';
import type { CaseRepository } from '../contracts/repositories/case-repository.js';
import type { DocumentRepository } from '../contracts/repositories/document-repository.js';
import type {
  ComplianceReviewRepository,
  InformationRequestRepository,
  WorkflowResumeCommandRepository,
} from '../contracts/repositories/decision-repositories.js';
import type { Clock } from '../contracts/technical/primitives.js';
import { publicSchemaVersion, type CaseSummary } from '../contracts/http/public-api.js';
import type { DemoSessionRecord } from '../server/demo-session.js';
import type { createDurableKycOnboardingWorkflow } from '../mastra/workflows/durable-kyc-onboarding.js';
import { durableKycWorkflowStateSchema } from '../mastra/workflows/durable-kyc-onboarding.js';
import type { KycWorkflowRequestContext } from '../mastra/workflows/kyc-application-intake.js';
import { DomainInvariantError, WorkflowExecutionError } from '../domain/errors.js';
import { kycTracingOptions } from '../observability/tracing.js';

type Dependencies = Readonly<{
  workflow: ReturnType<typeof createDurableKycOnboardingWorkflow>;
  cases: CaseRepository;
  documents: DocumentRepository;
  informationRequests: InformationRequestRepository;
  reviews: ComplianceReviewRepository;
  commands: WorkflowResumeCommandRepository;
  jurisdictionPolicy: JurisdictionPolicyProvider;
  clock: Clock;
  jurisdiction: 'US';
  policyProfile: 'demo-default' | 'demo-strict';
  piiMode: 'demo-default' | 'demo-strict';
  locale: string;
}>;

export const apiThreadIdFor = (caseId: string): string => `api-${caseId}`;

const isTerminal = (status: string): boolean => ['ACTIVE', 'REJECTED', 'PROVISIONING_FAILED'].includes(status);

export class KycWorkflowCoordinator {
  constructor(private readonly dependencies: Dependencies) {}

  async requestContext(session: DemoSessionRecord, correlationId: string) {
    const policy = await this.dependencies.jurisdictionPolicy.resolve({
      jurisdiction: this.dependencies.jurisdiction,
      profile: this.dependencies.policyProfile,
    });
    return new RequestContext<KycWorkflowRequestContext>([
      ['tenantId', session.tenantId],
      ['jurisdiction', this.dependencies.jurisdiction],
      ['piiMode', this.dependencies.piiMode],
      ['policy', { id: policy.id, version: policy.version, checksum: policy.checksum }],
      ['locale', this.dependencies.locale],
      ['correlationId', correlationId],
      ['actor', session.actor],
      ['policyProfile', this.dependencies.policyProfile],
    ]);
  }

  async start(
    input: Readonly<{
      tenantId: string;
      caseId: string;
      idempotencyKey: string;
      session: DemoSessionRecord;
      correlationId: string;
    }>,
  ): Promise<CaseSummary> {
    const current = await this.dependencies.cases.get({
      tenantId: input.tenantId,
      caseId: input.caseId,
    });
    if (current.workflowRunId === null) {
      throw new DomainInvariantError('Case is not bound to a durable workflow run');
    }
    const existing = await this.dependencies.workflow.getWorkflowRunById(current.workflowRunId, {
      fields: ['result', 'steps', 'suspendedPaths', 'resumeLabels'],
    });
    if (existing == null) {
      if (current.status !== 'EXTRACTING') {
        throw new DomainInvariantError('Case must contain at least one document before start');
      }
      const run = await this.dependencies.workflow.createRun({ runId: current.workflowRunId });
      const result = await run.start({
        inputData: {
          source: 'persisted-case',
          caseId: current.id,
          idempotencyKey: input.idempotencyKey,
          studioThreadKey: apiThreadIdFor(current.id),
        },
        initialState: durableKycWorkflowStateSchema.parse({}),
        requestContext: await this.requestContext(input.session, input.correlationId),
        tracingOptions: kycTracingOptions({
          operation: 'kyc.workflow.start',
          tenantId: input.tenantId,
          caseId: input.caseId,
          correlationId: input.correlationId,
        }),
      });
      if (result.status !== 'success' && result.status !== 'suspended') {
        throw new WorkflowExecutionError();
      }
    } else if (!['success', 'suspended', 'running', 'pending'].includes(existing.status)) {
      throw new WorkflowExecutionError();
    }
    return this.status(input.tenantId, input.caseId);
  }

  async status(tenantId: string, caseId: string): Promise<CaseSummary> {
    const current = await this.dependencies.cases.get({ tenantId, caseId });
    const commands = await this.dependencies.commands.listForThread({
      tenantId,
      threadId: apiThreadIdFor(caseId),
    });
    const pendingCommand = commands
      .filter(command => command.status === 'PENDING' || command.status === 'EXECUTING')
      .at(-1);
    let pendingAction: CaseSummary['pendingAction'] = null;
    if (pendingCommand?.actionType === 'MISSING_INFORMATION') {
      const request = await this.dependencies.informationRequests.get({
        tenantId,
        requestId: pendingCommand.targetId,
      });
      pendingAction = {
        type: 'MISSING_INFORMATION',
        requestId: request.id,
        requestedItems: request.requestedItems,
        safeMessage: request.safeMessage,
        expiresAt: request.expiresAt,
      };
    } else if (pendingCommand?.actionType === 'COMPLIANCE_REVIEW') {
      const review = await this.dependencies.reviews.get({
        tenantId,
        reviewId: pendingCommand.targetId,
      });
      pendingAction = {
        type: 'COMPLIANCE_REVIEW',
        reviewId: review.id,
        level: review.level,
        expiresAt: review.expiresAt,
      };
    }
    const storedRun =
      current.workflowRunId === null
        ? undefined
        : await this.dependencies.workflow.getWorkflowRunById(current.workflowRunId, {
            fields: ['result', 'steps', 'suspendedPaths', 'resumeLabels'],
          });
    const workflowStatus =
      storedRun == null
        ? 'NOT_STARTED'
        : storedRun.status === 'suspended'
          ? 'SUSPENDED'
          : storedRun.status === 'success' || isTerminal(current.status)
            ? 'COMPLETED'
            : 'RUNNING';
    const storedDocumentCount = (await this.dependencies.documents.list({ tenantId, caseId })).length;
    return {
      schemaVersion: publicSchemaVersion,
      caseId: current.id,
      status: current.status,
      workflowStatus,
      documentReadiness: {
        storedDocumentCount,
        canStart: workflowStatus === 'NOT_STARTED' && current.status === 'EXTRACTING' && storedDocumentCount > 0,
      },
      pendingAction,
      updatedAt: current.updatedAt,
    };
  }
}
