import type { MastraMessageContentV2 } from '../../agent';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '../../memory/types';
import type { Trace } from '../../telemetry';
import type { WorkflowRunState } from '../../workflows';
import { MastraStorage } from '../base';
import {
    TABLE_TRACES,
    TABLE_MESSAGES,
    TABLE_THREADS,
    TABLE_RESOURCES,
    TABLE_WORKFLOW_SNAPSHOT,
    TABLE_EVALS,
} from '../constants';
import type { TABLE_NAMES } from '../constants';
import type {
    StorageColumn,
    StorageGetMessagesArg,
    StorageGetTracesArg,
    StorageResourceType,
    PaginationInfo,
    WorkflowRun,
    EvalRow,
    WorkflowRuns,
    PaginationArgs,
} from '../types';
import type { MastraConversationsStorage } from './conversations';
import type { MastraScoresStorage } from './scores';
import type { MastraTracesStorage } from './traces';
import type { MastraWorkflowsStorage } from './workflows';

export class MastraCompositeDomain extends MastraStorage {
    #stores: {
        traces: MastraTracesStorage;
        conversations: MastraConversationsStorage;
        workflows: MastraWorkflowsStorage;
        scores: MastraScoresStorage;
    };

    constructor(stores: {
        traces: MastraTracesStorage;
        conversations: MastraConversationsStorage;
        workflows: MastraWorkflowsStorage;
        scores: MastraScoresStorage;
    }) {
        super({
            name: 'COMPOSITE_DOMAIN_STORAGE',
        });

        this.#stores = stores;
    }

    async createTable({
        tableName,
        schema,
    }: {
        tableName: TABLE_NAMES;
        schema: Record<string, StorageColumn>;
    }): Promise<void> {
        if (tableName === TABLE_TRACES) {
            await this.#stores.traces.store.initialize({ name: tableName, schema });
        } else if (tableName === TABLE_MESSAGES || tableName === TABLE_THREADS || tableName === TABLE_RESOURCES) {
            await this.#stores.conversations.store.initialize({ name: tableName, schema });
        } else if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
            await this.#stores.workflows.store.initialize({ name: tableName, schema });
        } else if (tableName === TABLE_EVALS) {
            await this.#stores.scores.store.initialize({ name: tableName, schema });
        }
    }

    async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
        if (tableName === TABLE_TRACES) {
            await this.#stores.traces.store.teardown({ name: tableName });
        } else if (tableName === TABLE_MESSAGES || tableName === TABLE_THREADS || tableName === TABLE_RESOURCES) {
            await this.#stores.conversations.store.teardown({ name: tableName });
        } else if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
            await this.#stores.workflows.store.teardown({ name: tableName });
        } else if (tableName === TABLE_EVALS) {
            await this.#stores.scores.store.teardown({ name: tableName });
        }
    }

    async alterTable(args: {
        tableName: TABLE_NAMES;
        schema: Record<string, StorageColumn>;
        ifNotExists: string[];
    }): Promise<void> {
        if (args.tableName === TABLE_TRACES) {
            await this.#stores.traces.store.migrate({
                name: args.tableName,
                schema: args.schema,
                ifNotExists: args.ifNotExists,
            });
        }
        if (args.tableName === TABLE_MESSAGES || args.tableName === TABLE_THREADS || args.tableName === TABLE_RESOURCES) {
            await this.#stores.conversations.store.migrate({
                name: args.tableName,
                schema: args.schema,
                ifNotExists: args.ifNotExists,
            });
        }
        if (args.tableName === TABLE_WORKFLOW_SNAPSHOT) {
            await this.#stores.workflows.store.migrate({
                name: args.tableName,
                schema: args.schema,
                ifNotExists: args.ifNotExists,
            });
        }
        if (args.tableName === TABLE_EVALS) {
            await this.#stores.scores.store.migrate({
                name: args.tableName,
                schema: args.schema,
                ifNotExists: args.ifNotExists,
            });
        }
    }

    async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
        if (tableName === TABLE_TRACES) {
            await this.#stores.traces.store.insert({ name: tableName, record });
        } else if (tableName === TABLE_MESSAGES || tableName === TABLE_THREADS || tableName === TABLE_RESOURCES) {
            await this.#stores.conversations.store.insert({ name: tableName, record });
        } else if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
            await this.#stores.workflows.store.insert({ name: tableName, record });
        } else if (tableName === TABLE_EVALS) {
            await this.#stores.scores.store.insert({ name: tableName, record });
        }
    }

    async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
        if (tableName === TABLE_TRACES) {
            await this.#stores.traces.store.batchInsert({ name: tableName, records });
        } else if (tableName === TABLE_MESSAGES || tableName === TABLE_THREADS || tableName === TABLE_RESOURCES) {
            await this.#stores.conversations.store.batchInsert({ name: tableName, records });
        } else if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
            await this.#stores.workflows.store.batchInsert({ name: tableName, records });
        } else if (tableName === TABLE_EVALS) {
            await this.#stores.scores.store.batchInsert({ name: tableName, records });
        }
    }

    async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
        if (tableName === TABLE_TRACES) {
            return this.#stores.traces.store.load({ name: tableName, keys });
        }
        if (tableName === TABLE_MESSAGES || tableName === TABLE_THREADS || tableName === TABLE_RESOURCES) {
            return this.#stores.conversations.store.load({ name: tableName, keys });
        }
        if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
            return this.#stores.workflows.store.load({ name: tableName, keys });
        }
        if (tableName === TABLE_EVALS) {
            return this.#stores.scores.store.load({ name: tableName, keys });
        }
        return null;
    }

    async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
        return this.#stores.conversations.getThreadById({ threadId });
    }

    async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
        return this.#stores.conversations.getThreadsByResourceId({ resourceId });
    }

    async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
        return this.#stores.conversations.saveThread({ thread });
    }

    async updateThread({
        id,
        title,
        metadata,
    }: {
        id: string;
        title: string;
        metadata: Record<string, unknown>;
    }): Promise<StorageThreadType> {
        return this.#stores.conversations.updateThread({ id, title, metadata });
    }

    async deleteThread({ threadId }: { threadId: string }): Promise<void> {
        return this.#stores.conversations.deleteThread({ threadId });
    }

    async getResourceById(_: { resourceId: string }): Promise<StorageResourceType | null> {
        return this.#stores.conversations.getResourceById(_);
    }

    async saveResource(args: { resource: StorageResourceType }): Promise<StorageResourceType> {
        return this.#stores.conversations.saveResource(args);
    }

    async updateResource(args: {
        resourceId: string;
        workingMemory?: string;
        metadata?: Record<string, unknown>;
    }): Promise<StorageResourceType> {
        return this.#stores.conversations.updateResource(args);
    }

    async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
    async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
    async getMessages({
        threadId,
        resourceId,
        selectBy,
        format,
    }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
        return this.#stores.conversations.getMessages({ threadId, resourceId, selectBy, format });
    }

    async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
    async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
    async saveMessages(
        args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
    ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
        return this.#stores.conversations.saveMessages(args);
    }

    async updateMessages(args: {
        messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
        {
            id: string;
            content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
        }[];
    }): Promise<MastraMessageV2[]> {
        return this.#stores.conversations.updateMessages(args);
    }

    async getTraces(args: StorageGetTracesArg): Promise<any[]> {
        return this.#stores.traces.getTraces(args);
    }

    async persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
    }: {
        workflowName: string;
        runId: string;
        snapshot: WorkflowRunState;
    }): Promise<void> {
        return await this.#stores.workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
    }

    async loadWorkflowSnapshot({
        workflowName,
        runId,
    }: {
        workflowName: string;
        runId: string;
    }): Promise<WorkflowRunState | null> {
        return this.#stores.workflows.loadWorkflowSnapshot({ workflowName, runId });
    }

    async getEvals(args: {
        agentName?: string;
        type?: 'test' | 'live';
    } & PaginationArgs): Promise<PaginationInfo & { evals: EvalRow[] }> {
        return this.#stores.scores.getEvals(args);
    }

    async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
        return this.#stores.scores.getEvalsByAgentName(agentName, type);
    }

    async getWorkflowRuns(args?: {
        workflowName?: string;
        fromDate?: Date;
        toDate?: Date;
        limit?: number;
        offset?: number;
        resourceId?: string;
    }): Promise<WorkflowRuns> {
        return this.#stores.workflows.getWorkflowRuns(args);
    }

    async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null> {
        return this.#stores.workflows.getWorkflowRunById(args);
    }

    async getTracesPaginated(args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[] }> {
        return this.#stores.traces.getTracesPaginated(args);
    }

    async getThreadsByResourceIdPaginated(args: {
        resourceId: string;
        page: number;
        perPage: number;
    }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
        return this.#stores.conversations.getThreadsByResourceIdPaginated(args);
    }

    async getMessagesPaginated(
        args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
    ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
        return this.#stores.conversations.getMessagesPaginated(args);
    }
}
