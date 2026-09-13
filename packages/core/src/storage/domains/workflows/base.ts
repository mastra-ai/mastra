import type { StepResult, WorkflowRunState } from '../../../workflows';
import type {
  AdvanceWorkflowTerminalizationInput,
  AdvanceWorkflowTerminalizationResult,
  ClaimWorkflowTerminalizationInput,
  ClaimWorkflowTerminalizationResult,
  DeleteCompletedWorkflowTerminalizationsInput,
  DeleteCompletedWorkflowTerminalizationsResult,
  GetWorkflowTerminalizationInput,
  GetWorkflowTerminalizationResult,
  GetWorkflowRunTerminalStatusInput,
  GetWorkflowRunTerminalStatusResult,
  GetWorkflowTerminalEffectForDispatchInput,
  GetWorkflowTerminalEffectForDispatchResult,
  GetWorkflowTerminalDestinationReceiptInput,
  GetWorkflowTerminalDestinationReceiptResult,
  GetWorkflowTerminalParentContextInput,
  GetWorkflowTerminalParentContextResult,
  GetWorkflowTerminalContinuationPlanInput,
  GetWorkflowTerminalContinuationPlanResult,
  PersistWorkflowTerminalStateInput,
  PersistWorkflowTerminalStateResult,
  PrepareWorkflowTerminalEffectInput,
  PrepareWorkflowTerminalEffectResult,
  ReserveWorkflowTerminalDestinationReceiptInput,
  ReserveWorkflowTerminalDestinationReceiptResult,
  ApplyWorkflowTerminalParentEffectInput,
  ApplyWorkflowTerminalParentEffectResult,
  BindWorkflowNestedRunOwnershipInput,
  BindWorkflowNestedRunOwnershipResult,
  PersistWorkflowTerminalRecoveryAncestryInput,
  PersistWorkflowTerminalRecoveryAncestryResult,
  GetWorkflowTerminalRecoveryAncestryResult,
  AdmitWorkflowNestedRunInput,
  AdmitWorkflowNestedRunResult,
  AdmitWorkflowResumeInput,
  AdmitWorkflowResumeResult,
  ConsumeWorkflowResumeResult,
  ConsumeWorkflowResumeResultInput,
  PersistWorkflowStepUpdateInput,
  PersistWorkflowStepUpdateResult,
  FinalizeWorkflowResumeInput,
  FinalizeWorkflowResumeResult,
  RollbackWorkflowResumeInput,
  RollbackWorkflowResumeResult,
  ReleaseWorkflowTerminalizationInput,
  ReleaseWorkflowTerminalizationResult,
  UpdateWorkflowStateOptions,
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  WorkflowTerminalizationCapabilities,
  WorkflowResumeCapabilities,
  WorkflowExecutionState,
} from '../../types';
import { StorageDomain } from '../base';

export abstract class WorkflowsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKFLOWS',
    });
  }

  abstract supportsConcurrentUpdates(): boolean;

  /** Whether this adapter provides atomic terminalization claim/phase CAS. */
  supportsWorkflowTerminalizationJournal(): boolean {
    return false;
  }

  /** Exact protocol versions implemented by this adapter. */
  getWorkflowTerminalizationCapabilities(): WorkflowTerminalizationCapabilities {
    return {};
  }

  /** Exact atomic resume protocol versions implemented by this adapter. */
  getWorkflowResumeCapabilities(): WorkflowResumeCapabilities {
    return {};
  }

  async admitWorkflowResume(_input: AdmitWorkflowResumeInput): Promise<AdmitWorkflowResumeResult> {
    return { status: 'unsupported' };
  }

  async rollbackWorkflowResume(_input: RollbackWorkflowResumeInput): Promise<RollbackWorkflowResumeResult> {
    return { status: 'unsupported' };
  }

  async finalizeWorkflowResume(_input: FinalizeWorkflowResumeInput): Promise<FinalizeWorkflowResumeResult> {
    return { status: 'unsupported' };
  }

  async consumeWorkflowResumeResult(_input: ConsumeWorkflowResumeResultInput): Promise<ConsumeWorkflowResumeResult> {
    return { status: 'unsupported' };
  }

  async persistWorkflowStepUpdate(_input: PersistWorkflowStepUpdateInput): Promise<PersistWorkflowStepUpdateResult> {
    return { status: 'unsupported' };
  }

  async claimWorkflowTerminalization(
    _input: ClaimWorkflowTerminalizationInput,
  ): Promise<ClaimWorkflowTerminalizationResult> {
    return { status: 'unsupported' };
  }

  async getWorkflowTerminalization(_input: GetWorkflowTerminalizationInput): Promise<GetWorkflowTerminalizationResult> {
    return { status: 'unsupported' };
  }

  async getWorkflowRunTerminalStatus(
    _input: GetWorkflowRunTerminalStatusInput,
  ): Promise<GetWorkflowRunTerminalStatusResult> {
    return { status: 'unsupported' };
  }

  async advanceWorkflowTerminalization(
    _input: AdvanceWorkflowTerminalizationInput,
  ): Promise<AdvanceWorkflowTerminalizationResult> {
    return { status: 'unsupported' };
  }

  async releaseWorkflowTerminalization(
    _input: ReleaseWorkflowTerminalizationInput,
  ): Promise<ReleaseWorkflowTerminalizationResult> {
    return { status: 'unsupported' };
  }

  async deleteCompletedWorkflowTerminalizations(
    _input: DeleteCompletedWorkflowTerminalizationsInput,
  ): Promise<DeleteCompletedWorkflowTerminalizationsResult> {
    return { status: 'unsupported', count: 0 };
  }

  async persistWorkflowTerminalState(
    _input: PersistWorkflowTerminalStateInput,
  ): Promise<PersistWorkflowTerminalStateResult> {
    return { status: 'unsupported' };
  }

  async persistWorkflowTerminalRecoveryAncestry(
    _input: PersistWorkflowTerminalRecoveryAncestryInput,
  ): Promise<PersistWorkflowTerminalRecoveryAncestryResult> {
    return { status: 'unsupported' };
  }

  async getWorkflowTerminalRecoveryAncestry(
    _input: GetWorkflowTerminalizationInput,
  ): Promise<GetWorkflowTerminalRecoveryAncestryResult> {
    return { status: 'unsupported' };
  }

  async bindWorkflowNestedRunOwnership(
    _input: BindWorkflowNestedRunOwnershipInput,
  ): Promise<BindWorkflowNestedRunOwnershipResult> {
    return { status: 'unsupported' };
  }

  async admitWorkflowNestedRun(_input: AdmitWorkflowNestedRunInput): Promise<AdmitWorkflowNestedRunResult> {
    return { status: 'unsupported' };
  }

  async prepareWorkflowTerminalEffect(
    _input: PrepareWorkflowTerminalEffectInput,
  ): Promise<PrepareWorkflowTerminalEffectResult> {
    return { status: 'unsupported' };
  }

  async getWorkflowTerminalEffectForDispatch(
    _input: GetWorkflowTerminalEffectForDispatchInput,
  ): Promise<GetWorkflowTerminalEffectForDispatchResult> {
    return { status: 'unsupported' };
  }

  async reserveWorkflowTerminalDestinationReceipt(
    _input: ReserveWorkflowTerminalDestinationReceiptInput,
  ): Promise<ReserveWorkflowTerminalDestinationReceiptResult> {
    return { status: 'unsupported' };
  }

  async getWorkflowTerminalDestinationReceipt(
    _input: GetWorkflowTerminalDestinationReceiptInput,
  ): Promise<GetWorkflowTerminalDestinationReceiptResult> {
    return { status: 'unsupported' };
  }

  async getWorkflowTerminalParentContext(
    _input: GetWorkflowTerminalParentContextInput,
  ): Promise<GetWorkflowTerminalParentContextResult> {
    return { status: 'unsupported' };
  }

  async getWorkflowTerminalContinuationPlan(
    _input: GetWorkflowTerminalContinuationPlanInput,
  ): Promise<GetWorkflowTerminalContinuationPlanResult> {
    return { status: 'unsupported' };
  }

  async applyWorkflowTerminalParentEffect(
    _input: ApplyWorkflowTerminalParentEffectInput,
  ): Promise<ApplyWorkflowTerminalParentEffectResult> {
    return { status: 'unsupported' };
  }

  abstract updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>>;

  abstract updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined>;

  abstract persistWorkflowSnapshot(_: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void>;

  abstract loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null>;

  /**
   * Load only the workflow state required for lifecycle authority checks.
   * Adapters with status/generation projections should override this method;
   * the default preserves compatibility by projecting a full snapshot read.
   */
  async getWorkflowExecutionState({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowExecutionState | null> {
    const snapshot = await this.loadWorkflowSnapshot({ workflowName, runId });
    if (!snapshot) return null;
    return {
      status: snapshot.status,
      ...(snapshot.executionGeneration === undefined ? {} : { executionGeneration: snapshot.executionGeneration }),
    };
  }

  abstract listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns>;

  abstract getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null>;

  abstract deleteWorkflowRunById(args: { runId: string; workflowName: string }): Promise<void>;
}
