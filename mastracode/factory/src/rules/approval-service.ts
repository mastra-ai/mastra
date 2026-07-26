import type {
  FactoryApprovalRecord,
  FactoryApprovalStatus,
  ResolveFactoryApprovalResult,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';

export interface FactoryTransitionApprovalServiceOptions {
  storage: WorkItemsStorage;
}

export interface ResolveFactoryTransitionApprovalInput {
  orgId: string;
  factoryProjectId: string;
  approvalId: string;
  decision: 'approve' | 'reject';
  resolvedBy: string;
  resolverType: 'human' | 'agent';
  resolutionReason?: string;
  now?: Date;
}

export type FactoryTransitionApprovalResolution =
  | { status: 'missing' }
  | {
      status: Exclude<FactoryApprovalStatus, 'pending'>;
      replayed: boolean;
      approval: FactoryApprovalRecord;
      item: WorkItemRow | null;
    };

function resolution(result: ResolveFactoryApprovalResult): FactoryTransitionApprovalResolution {
  if (result.status === 'missing') return result;
  if (result.approval.status === 'pending')
    throw new Error('Factory approval resolution did not reach a terminal state.');
  return {
    status: result.approval.status,
    replayed: result.status === 'replayed',
    approval: result.approval,
    item: result.item,
  };
}

export class FactoryTransitionApprovalService {
  readonly #storage: WorkItemsStorage;

  constructor(options: FactoryTransitionApprovalServiceOptions) {
    this.#storage = options.storage;
  }

  async list(input: {
    orgId: string;
    factoryProjectId: string;
    statuses?: FactoryApprovalStatus[];
  }): Promise<FactoryApprovalRecord[]> {
    return this.#storage.listApprovals(input.orgId, input.factoryProjectId, input.statuses);
  }

  async get(input: {
    orgId: string;
    factoryProjectId: string;
    approvalId: string;
  }): Promise<FactoryApprovalRecord | null> {
    return this.#storage.getApproval(input);
  }

  async resolve(input: ResolveFactoryTransitionApprovalInput): Promise<FactoryTransitionApprovalResolution> {
    return resolution(
      await this.#storage.resolveApproval({
        orgId: input.orgId,
        factoryProjectId: input.factoryProjectId,
        approvalId: input.approvalId,
        decision: input.decision,
        resolvedBy: input.resolvedBy,
        resolverType: input.resolverType,
        ...(input.resolutionReason ? { resolutionReason: input.resolutionReason } : {}),
        now: input.now ?? new Date(),
      }),
    );
  }
}
