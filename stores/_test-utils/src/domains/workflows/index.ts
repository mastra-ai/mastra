import { MastraStorage } from "@mastra/core/storage";
import type { WorkflowRunState } from "@mastra/core/workflows";
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";

export function createTestSuiteWorkflows(storage: MastraStorage) {
    describe('Workflow Snapshots', () => {
        it('should persist and load workflow snapshots', async () => {
            const workflowName = 'test-workflow';
            const runId = `run-${randomUUID()}`;
            const snapshot = {
                status: 'running',
                context: {
                    stepResults: {},
                    attempts: {},
                    triggerData: { type: 'manual' },
                },
            } as any;

            await storage.persistWorkflowSnapshot({
                workflowName,
                runId,
                snapshot,
            });

            const loadedSnapshot = await storage.loadWorkflowSnapshot({
                workflowName,
                runId,
            });

            expect(loadedSnapshot).toEqual(snapshot);
        });

        it('should return null for non-existent workflow snapshot', async () => {
            const result = await storage.loadWorkflowSnapshot({
                workflowName: 'non-existent',
                runId: 'non-existent',
            });

            expect(result).toBeNull();
        });

        it('should update existing workflow snapshot', async () => {
            const workflowName = 'test-workflow';
            const runId = `run-${randomUUID()}`;
            const initialSnapshot = {
                status: 'running',
                context: {
                    stepResults: {},
                    attempts: {},
                    triggerData: { type: 'manual' },
                },
            };

            await storage.persistWorkflowSnapshot({
                workflowName,
                runId,
                snapshot: initialSnapshot as any,
            });

            const updatedSnapshot = {
                status: 'completed',
                context: {
                    stepResults: {
                        'step-1': { status: 'success', result: { data: 'test' } },
                    },
                    attempts: { 'step-1': 1 },
                    triggerData: { type: 'manual' },
                },
            } as any;

            await storage.persistWorkflowSnapshot({
                workflowName,
                runId,
                snapshot: updatedSnapshot,
            });

            const loadedSnapshot = await storage.loadWorkflowSnapshot({
                workflowName,
                runId,
            });

            expect(loadedSnapshot).toEqual(updatedSnapshot);
        });

        it('should handle complex workflow state', async () => {
            const workflowName = 'complex-workflow';
            const runId = `run-${randomUUID()}`;
            const complexSnapshot = {
                value: { currentState: 'running' },
                context: {
                    stepResults: {
                        'step-1': {
                            status: 'success',
                            result: {
                                nestedData: {
                                    array: [1, 2, 3],
                                    object: { key: 'value' },
                                    date: new Date().toISOString(),
                                },
                            },
                        },
                        'step-2': {
                            status: 'waiting',
                            dependencies: ['step-3', 'step-4'],
                        },
                    },
                    attempts: { 'step-1': 1, 'step-2': 0 },
                    triggerData: {
                        type: 'scheduled',
                        metadata: {
                            schedule: '0 0 * * *',
                            timezone: 'UTC',
                        },
                    },
                },
                activePaths: [
                    {
                        stepPath: ['step-1'],
                        stepId: 'step-1',
                        status: 'success',
                    },
                    {
                        stepPath: ['step-2'],
                        stepId: 'step-2',
                        status: 'waiting',
                    },
                ],
                runId: runId,
                timestamp: Date.now(),
            };

            await storage.persistWorkflowSnapshot({
                workflowName,
                runId,
                snapshot: complexSnapshot as unknown as WorkflowRunState,
            });

            const loadedSnapshot = await storage.loadWorkflowSnapshot({
                workflowName,
                runId,
            });

            expect(loadedSnapshot).toEqual(complexSnapshot);
        });
    });
}