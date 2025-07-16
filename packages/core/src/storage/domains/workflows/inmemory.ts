import type { WorkflowRunState } from "../../../workflows";
import { TABLE_WORKFLOW_SNAPSHOT } from "../../constants";
import type { WorkflowRun, WorkflowRuns } from "../../types";
import type { StoreOperations } from "../operations";
import { WorkflowsStorage } from "./base";

export type InMemoryWorkflows = Map<string, WorkflowRun>;

export class WorkflowsInMemory extends WorkflowsStorage {
    workflows: InMemoryWorkflows;
    operations: StoreOperations;
    collection: InMemoryWorkflows;

    constructor({ collection, operations }: { collection: InMemoryWorkflows, operations: StoreOperations }) {
        super();
        this.collection = collection;
        this.workflows = collection;
        this.operations = operations;
    }

    async persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
    }: {
        workflowName: string;
        runId: string;
        snapshot: WorkflowRunState;
    }) {
        const data = {
            workflow_name: workflowName,
            run_id: runId,
            snapshot,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.logger.debug('Persisting workflow snapshot', { workflowName, runId, data });
        await this.operations.insert({
            tableName: TABLE_WORKFLOW_SNAPSHOT,
            record: data,
        });
    }

    async loadWorkflowSnapshot({
        workflowName,
        runId,
    }: {
        workflowName: string;
        runId: string;
    }): Promise<WorkflowRunState | null> {
        this.logger.debug('Loading workflow snapshot', { workflowName, runId });
        const d = await this.operations.load<{ snapshot: WorkflowRunState }>({
            tableName: TABLE_WORKFLOW_SNAPSHOT,
            keys: { workflow_name: workflowName, run_id: runId },
        });

        return d ? d.snapshot : null;
    }

    async getWorkflowRuns({
        workflowName,
        fromDate,
        toDate,
        limit,
        offset,
        resourceId,
    }: {
        workflowName?: string;
        fromDate?: Date;
        toDate?: Date;
        limit?: number;
        offset?: number;
        resourceId?: string;
    } = {}): Promise<WorkflowRuns> {
        this.logger.debug(`MockStore: getWorkflowRuns called`);
        let runs = Array.from(this.collection.values());

        if (workflowName) runs = runs.filter((run: any) => run.workflow_name === workflowName);
        if (fromDate) runs = runs.filter((run: any) => new Date(run.createdAt) >= fromDate);
        if (toDate) runs = runs.filter((run: any) => new Date(run.createdAt) <= toDate);
        if (resourceId) runs = runs.filter((run: any) => run.resourceId === resourceId);

        const total = runs.length;

        // Sort by createdAt
        runs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Apply pagination
        if (limit !== undefined && offset !== undefined) {
            const start = offset;
            const end = start + limit;
            runs = runs.slice(start, end);
        }

        // Deserialize snapshot if it's a string
        const parsedRuns = runs.map((run: any) => ({
            ...run,
            snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : { ...run.snapshot },
            createdAt: new Date(run.createdAt),
            updatedAt: new Date(run.updatedAt),
            runId: run.run_id,
            workflowName: run.workflow_name,
        }));

        return { runs: parsedRuns as WorkflowRun[], total };
    }

    async getWorkflowRunById({
        runId,
        workflowName,
    }: {
        runId: string;
        workflowName?: string;
    }): Promise<WorkflowRun | null> {
        this.logger.debug(`MockStore: getWorkflowRunById called for runId ${runId}`);
        let run = Array.from(this.collection.values()).find((r: any) => r.run_id === runId);

        if (run && workflowName && run.workflowName !== workflowName) {
            run = undefined; // Not found if workflowName doesn't match
        }

        if (!run) return null;

        // Deserialize snapshot if it's a string
        const parsedRun = {
            ...run,
            snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot,
            createdAt: new Date(run.createdAt),
            updatedAt: new Date(run.updatedAt),
            runId: run.runId,
            workflowName: run.workflowName,
        };

        return parsedRun as WorkflowRun;
    }

}