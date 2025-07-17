import type { MetricResult } from "@mastra/core/eval";
import type { MastraStorage } from "@mastra/core/storage";
import { describe, it, expect } from "vitest";
import { createSampleEval } from "./data";
import { TABLE_EVALS } from "@mastra/core/storage";
import { randomUUID } from "crypto";

export function createEvalsTests(storage: MastraStorage) {
    describe('getEvals with pagination', () => {
        it('should return paginated evals with total count (page/perPage)', async () => {
            const agentName = 'libsql-pagination-agent-evals';
            const evalRecords = Array.from({ length: 25 }, (_, i) => createSampleEval(agentName, i % 2 === 0));
            await storage.batchInsert({ tableName: TABLE_EVALS, records: evalRecords.map(r => r as any) });

            const page1 = await storage.getEvals({ agentName, page: 0, perPage: 10 });
            expect(page1.evals).toHaveLength(10);
            expect(page1.total).toBe(25);
            expect(page1.page).toBe(0);
            expect(page1.perPage).toBe(10);
            expect(page1.hasMore).toBe(true);

            const page3 = await storage.getEvals({ agentName, page: 2, perPage: 10 });
            expect(page3.evals).toHaveLength(5);
            expect(page3.total).toBe(25);
            expect(page3.page).toBe(2);
            expect(page3.hasMore).toBe(false);
        });

        it('should support limit/offset pagination for getEvals', async () => {
            const agentName = 'libsql-pagination-lo-evals';
            const evalRecords = Array.from({ length: 15 }, () => createSampleEval(agentName));
            await storage.batchInsert({ tableName: TABLE_EVALS, records: evalRecords.map(r => r as any) });

            const result = await storage.getEvals({ agentName, page: 2, perPage: 5 });
            expect(result.evals).toHaveLength(5);
            expect(result.total).toBe(15);
            expect(result.page).toBe(2);
            expect(result.perPage).toBe(5);
            expect(result.hasMore).toBe(false);
        });

        it('should filter by type with pagination for getEvals', async () => {
            const agentName = 'libsql-pagination-type-evals';
            const testEvals = Array.from({ length: 10 }, () => createSampleEval(agentName, true));
            const liveEvals = Array.from({ length: 8 }, () => createSampleEval(agentName, false));
            await storage.batchInsert({ tableName: TABLE_EVALS, records: [...testEvals, ...liveEvals].map(r => r as any) });

            const testResults = await storage.getEvals({ agentName, type: 'test', page: 0, perPage: 5 });
            expect(testResults.evals).toHaveLength(5);
            expect(testResults.total).toBe(10);

            const liveResults = await storage.getEvals({ agentName, type: 'live', page: 1, perPage: 3 });
            expect(liveResults.evals).toHaveLength(3);
            expect(liveResults.total).toBe(8);
            expect(liveResults.hasMore).toBe(true);
        });

        it('should filter by date with pagination for getEvals', async () => {
            const agentName = 'libsql-pagination-date-evals';
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const dayBeforeYesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);

            const recordsToInsert = [
                createSampleEval(agentName, false, dayBeforeYesterday),
                createSampleEval(agentName, false, dayBeforeYesterday),
                createSampleEval(agentName, false, yesterday),
                createSampleEval(agentName, false, yesterday),
                createSampleEval(agentName, false, now),
                createSampleEval(agentName, false, now),
            ];
            await storage.batchInsert({ tableName: TABLE_EVALS, records: recordsToInsert.map(r => r as any) });

            const fromYesterday = await storage.getEvals({ agentName, dateRange: { start: yesterday }, page: 0, perPage: 3 });
            expect(fromYesterday.total).toBe(4);
            expect(fromYesterday.evals).toHaveLength(3); // Should get 2 from 'now', 1 from 'yesterday' due to DESC order and limit 3
            fromYesterday.evals.forEach(e =>
                expect(new Date(e.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(yesterday.toISOString()).getTime()),
            );
            // Check if the first item is from 'now' if possible (because of DESC order)
            if (fromYesterday.evals.length > 0) {
                expect(new Date(fromYesterday.evals[0]!.createdAt).toISOString().slice(0, 10)).toEqual(
                    now.toISOString().slice(0, 10),
                );
            }

            const onlyDayBefore = await storage.getEvals({
                agentName,
                dateRange: { end: new Date(yesterday.getTime() - 1) },
                page: 0,
                perPage: 5,
            });
            expect(onlyDayBefore.total).toBe(2);
            expect(onlyDayBefore.evals).toHaveLength(2);
        });
    });

    describe('Eval Operations', () => {
        const createSampleEval = (agentName: string, isTest = false) => {
            const testInfo = isTest ? { testPath: 'test/path.ts', testName: 'Test Name' } : undefined;

            return {
                id: randomUUID(),
                agentName,
                input: 'Sample input',
                output: 'Sample output',
                result: { score: 0.8 } as MetricResult,
                metricName: 'sample-metric',
                instructions: 'Sample instructions',
                testInfo,
                globalRunId: `global-${randomUUID()}`,
                runId: `run-${randomUUID()}`,
                createdAt: new Date().toISOString(),
            };
        };

        it('should retrieve evals by agent name', async () => {
            const agentName = `test-agent-${randomUUID()}`;

            // Create sample evals
            const liveEval = createSampleEval(agentName, false);
            const testEval = createSampleEval(agentName, true);
            const otherAgentEval = createSampleEval(`other-agent-${randomUUID()}`, false);

            // Insert evals
            await storage.insert({
                tableName: TABLE_EVALS,
                record: {
                    agent_name: liveEval.agentName,
                    input: liveEval.input,
                    output: liveEval.output,
                    result: liveEval.result,
                    metric_name: liveEval.metricName,
                    instructions: liveEval.instructions,
                    test_info: null,
                    global_run_id: liveEval.globalRunId,
                    run_id: liveEval.runId,
                    created_at: liveEval.createdAt,
                    createdAt: new Date(liveEval.createdAt),
                },
            });

            await storage.insert({
                tableName: TABLE_EVALS,
                record: {
                    agent_name: testEval.agentName,
                    input: testEval.input,
                    output: testEval.output,
                    result: testEval.result,
                    metric_name: testEval.metricName,
                    instructions: testEval.instructions,
                    test_info: JSON.stringify(testEval.testInfo),
                    global_run_id: testEval.globalRunId,
                    run_id: testEval.runId,
                    created_at: testEval.createdAt,
                    createdAt: new Date(testEval.createdAt),
                },
            });

            await storage.insert({
                tableName: TABLE_EVALS,
                record: {
                    agent_name: otherAgentEval.agentName,
                    input: otherAgentEval.input,
                    output: otherAgentEval.output,
                    result: otherAgentEval.result,
                    metric_name: otherAgentEval.metricName,
                    instructions: otherAgentEval.instructions,
                    test_info: null,
                    global_run_id: otherAgentEval.globalRunId,
                    run_id: otherAgentEval.runId,
                    created_at: otherAgentEval.createdAt,
                    createdAt: new Date(otherAgentEval.createdAt),
                },
            });

            // Test getting all evals for the agent
            const allEvals = await storage.getEvalsByAgentName(agentName);
            expect(allEvals).toHaveLength(2);
            expect(allEvals.map((e: any) => e.runId)).toEqual(expect.arrayContaining([liveEval.runId, testEval.runId]));

            // Test getting only live evals
            const liveEvals = await storage.getEvalsByAgentName(agentName, 'live');
            expect(liveEvals).toHaveLength(1);
            expect(liveEvals?.[0]?.runId).toBe(liveEval.runId);

            // Test getting only test evals
            const testEvals = await storage.getEvalsByAgentName(agentName, 'test');
            expect(testEvals).toHaveLength(1);
            expect(testEvals?.[0]?.runId).toBe(testEval.runId);
            expect(testEvals?.[0]?.testInfo).toEqual(testEval.testInfo);

            // Test getting evals for non-existent agent
            const nonExistentEvals = await storage.getEvalsByAgentName('non-existent-agent');
            expect(nonExistentEvals).toHaveLength(0);
        });
    });
}   