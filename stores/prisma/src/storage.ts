import type { PrismaClient, Prisma } from '@prisma/client';
import { createPrismaClient, disconnectPrisma } from './client';
import type { PrismaConfig } from './client';

// Re-export Prisma types for external use
export type {
  WorkflowSnapshot,
  Thread,
  Message,
  AISpan,
  Trace,
  Scorer,
  Eval,
  Resource,
} from '@prisma/client';

export type PrismaStoreConfig = PrismaConfig;

/**
 * Prisma-native storage implementation for Mastra
 * Uses Prisma's generated types directly without conversion
 */
export class PrismaStore {
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  constructor(config?: PrismaStoreConfig) {
    this.prisma = createPrismaClient(config);
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.prisma.$connect();
      this.isConnected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await disconnectPrisma();
      this.isConnected = false;
    }
  }

  // ============================================
  // Workflow Methods
  // ============================================

  async saveWorkflowSnapshot(data: Prisma.WorkflowSnapshotCreateInput) {
    return this.prisma.workflowSnapshot.create({ data });
  }

  async getWorkflowSnapshot(workflowName: string, runId: string) {
    return this.prisma.workflowSnapshot.findUnique({
      where: {
        workflowName_runId: {
          workflowName,
          runId,
        },
      },
    });
  }

  async updateWorkflowSnapshot(
    workflowName: string,
    runId: string,
    data: Prisma.WorkflowSnapshotUpdateInput
  ) {
    return this.prisma.workflowSnapshot.update({
      where: {
        workflowName_runId: {
          workflowName,
          runId,
        },
      },
      data,
    });
  }

  async getWorkflowRuns(args?: {
    workflowName?: string;
    resourceId?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.WorkflowSnapshotWhereInput = {};

    if (args?.workflowName) where.workflowName = args.workflowName;
    if (args?.resourceId) where.resourceId = args.resourceId;
    if (args?.fromDate || args?.toDate) {
      where.createdAt = {};
      if (args.fromDate) where.createdAt.gte = args.fromDate;
      if (args.toDate) where.createdAt.lte = args.toDate;
    }

    const [runs, total] = await Promise.all([
      this.prisma.workflowSnapshot.findMany({
        where,
        take: args?.limit,
        skip: args?.offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflowSnapshot.count({ where }),
    ]);

    return { runs, total };
  }

  // ============================================
  // Thread & Message Methods
  // ============================================

  async createThread(data: Prisma.ThreadCreateInput) {
    return this.prisma.thread.create({ data });
  }

  async getThread(id: string) {
    return this.prisma.thread.findUnique({
      where: { id },
      include: { messages: true },
    });
  }

  async getThreadsByResourceId(resourceId: string, options?: {
    orderBy?: Prisma.ThreadOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }) {
    return this.prisma.thread.findMany({
      where: { resourceId },
      orderBy: options?.orderBy ?? { updatedAt: 'desc' },
      take: options?.take,
      skip: options?.skip,
    });
  }

  async updateThread(id: string, data: Prisma.ThreadUpdateInput) {
    return this.prisma.thread.update({
      where: { id },
      data,
    });
  }

  async deleteThread(id: string) {
    return this.prisma.thread.delete({
      where: { id },
    });
  }

  async createMessage(data: Prisma.MessageCreateInput) {
    return this.prisma.message.create({ data });
  }

  async createMessages(messages: Prisma.MessageCreateManyInput[]) {
    return this.prisma.message.createMany({
      data: messages,
      skipDuplicates: true,
    });
  }

  async getMessages(threadId: string, options?: {
    take?: number;
    skip?: number;
    orderBy?: Prisma.MessageOrderByWithRelationInput;
    where?: Prisma.MessageWhereInput;
  }) {
    return this.prisma.message.findMany({
      where: { threadId, ...options?.where },
      take: options?.take,
      skip: options?.skip,
      orderBy: options?.orderBy ?? { createdAt: 'asc' },
    });
  }

  async updateMessage(id: string, data: Prisma.MessageUpdateInput) {
    return this.prisma.message.update({
      where: { id },
      data,
    });
  }

  async deleteMessages(ids: string[]) {
    return this.prisma.message.deleteMany({
      where: { id: { in: ids } },
    });
  }

  // ============================================
  // AI Span Methods (Observability)
  // ============================================

  async createAISpan(data: Prisma.AISpanCreateInput) {
    return this.prisma.aISpan.create({ data });
  }

  async createAISpans(spans: Prisma.AISpanCreateManyInput[]) {
    return this.prisma.aISpan.createMany({
      data: spans,
      skipDuplicates: true,
    });
  }

  async updateAISpan(
    traceId: string,
    spanId: string,
    data: Prisma.AISpanUpdateInput
  ) {
    return this.prisma.aISpan.update({
      where: {
        traceId_spanId: {
          traceId,
          spanId,
        },
      },
      data,
    });
  }

  async getAISpansByTraceId(traceId: string) {
    return this.prisma.aISpan.findMany({
      where: { traceId },
      orderBy: { startedAt: 'asc' },
    });
  }

  async getAISpans(args?: {
    where?: Prisma.AISpanWhereInput;
    orderBy?: Prisma.AISpanOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }) {
    return this.prisma.aISpan.findMany({
      where: args?.where,
      orderBy: args?.orderBy ?? { startedAt: 'desc' },
      take: args?.take,
      skip: args?.skip,
    });
  }

  async deleteAISpansByTraceId(traceIds: string[]) {
    return this.prisma.aISpan.deleteMany({
      where: { traceId: { in: traceIds } },
    });
  }

  // ============================================
  // Trace Methods (Legacy Telemetry)
  // ============================================

  async createTrace(data: Prisma.TraceCreateInput) {
    return this.prisma.trace.create({ data });
  }

  async createTraces(traces: Prisma.TraceCreateManyInput[]) {
    return this.prisma.trace.createMany({
      data: traces,
      skipDuplicates: true,
    });
  }

  async getTraces(args?: {
    where?: Prisma.TraceWhereInput;
    orderBy?: Prisma.TraceOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }) {
    return this.prisma.trace.findMany({
      where: args?.where,
      orderBy: args?.orderBy ?? { createdAt: 'desc' },
      take: args?.take,
      skip: args?.skip,
    });
  }

  // ============================================
  // Scorer Methods
  // ============================================

  async createScore(data: Prisma.ScorerCreateInput) {
    return this.prisma.scorer.create({ data });
  }

  async getScore(id: string) {
    return this.prisma.scorer.findUnique({
      where: { id },
    });
  }

  async getScores(args?: {
    where?: Prisma.ScorerWhereInput;
    orderBy?: Prisma.ScorerOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }) {
    const [scores, total] = await Promise.all([
      this.prisma.scorer.findMany({
        where: args?.where,
        orderBy: args?.orderBy ?? { createdAt: 'desc' },
        take: args?.take,
        skip: args?.skip,
      }),
      this.prisma.scorer.count({ where: args?.where }),
    ]);

    return { scores, total };
  }

  // ============================================
  // Eval Methods (Legacy)
  // ============================================

  async createEval(data: Prisma.EvalCreateInput) {
    return this.prisma.eval.create({ data });
  }

  async getEvals(args?: {
    where?: Prisma.EvalWhereInput;
    orderBy?: Prisma.EvalOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }) {
    const [evals, total] = await Promise.all([
      this.prisma.eval.findMany({
        where: args?.where,
        orderBy: args?.orderBy ?? { createdAt: 'desc' },
        take: args?.take,
        skip: args?.skip,
      }),
      this.prisma.eval.count({ where: args?.where }),
    ]);

    return { evals, total };
  }

  // ============================================
  // Resource Methods
  // ============================================

  async createResource(data: Prisma.ResourceCreateInput) {
    return this.prisma.resource.create({ data });
  }

  async getResource(id: string) {
    return this.prisma.resource.findUnique({
      where: { id },
    });
  }

  async updateResource(id: string, data: Prisma.ResourceUpdateInput) {
    return this.prisma.resource.update({
      where: { id },
      data,
    });
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Execute raw SQL query
   */
  async $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Promise<T> {
    return this.prisma.$queryRaw(query, ...values);
  }

  /**
   * Execute raw SQL command
   */
  async $executeRaw(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Promise<number> {
    return this.prisma.$executeRaw(query, ...values);
  }

  /**
   * Get the underlying Prisma client for advanced use cases
   */
  getClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Run operations in a transaction
   */
  async transaction<T>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}