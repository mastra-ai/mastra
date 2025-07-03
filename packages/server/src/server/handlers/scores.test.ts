import type { ScoreRowData, StoragePagination } from '@mastra/core';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
    getScorersHandler,
    getScoresByRunIdHandler,
    getScoresByEntityIdHandler,
    saveScoreHandler,
} from './scores';

type MockedStorage = {
    getScoresByRunId: Mock<MockStore['getScoresByRunId']>;
    getScoresByEntityId: Mock<MockStore['getScoresByEntityId']>;
    saveScore: Mock<MockStore['saveScore']>;
};

function createScore(args: Partial<ScoreRowData>): ScoreRowData {
    return {
        id: 'test-score-1',
        runId: 'test-run-1',
        scorer: { name: 'test-scorer' },
        result: { score: 0.85 },
        input: { message: 'test input' },
        output: { message: 'test output' },
        source: 'test-source',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args,
    };
}

function createPagination(args: Partial<StoragePagination>): StoragePagination {
    return {
        page: 0,
        perPage: 10,
        ...args,
    };
}

describe('Scores Handlers', () => {
    let mockStorage: Omit<MockStore, keyof MockedStorage> & MockedStorage;
    let mastra: Mastra;

    beforeEach(() => {
        vi.clearAllMocks();
        mockStorage = new MockStore() as unknown as Omit<MockStore, keyof MockedStorage> & MockedStorage;
        mockStorage.getScoresByRunId = vi.fn();
        mockStorage.getScoresByEntityId = vi.fn();
        mockStorage.saveScore = vi.fn();

        mastra = new Mastra({
            logger: false,
            storage: mockStorage as unknown as MockStore,
        });
    });

    describe('getScorersHandler', () => {
        it('should return empty array', async () => {
            const result = await getScorersHandler();
            expect(result).toEqual([]);
        });
    });

    describe('getScoresByRunIdHandler', () => {
        it('should get scores by run ID successfully', async () => {
            const mockScores = [createScore({ runId: 'test-run-1' })];
            const pagination = createPagination({ page: 0, perPage: 10 });

            mockStorage.getScoresByRunId.mockResolvedValue({
                scores: mockScores,
                pagination: {
                    total: 1,
                    page: 0,
                    perPage: 10,
                    hasMore: false,
                },
            });

            const result = await getScoresByRunIdHandler({
                mastra,
                runId: 'test-run-1',
                pagination,
            });

            expect(result).toEqual({
                scores: mockScores,
                pagination: {
                    total: 1,
                    page: 0,
                    perPage: 10,
                    hasMore: false,
                },
            });
            expect(mockStorage.getScoresByRunId).toHaveBeenCalledWith({
                runId: 'test-run-1',
                pagination,
            });
        });

        it('should return empty array when storage method is not available', async () => {
            const pagination = createPagination({ page: 0, perPage: 10 });

            // Create mastra instance without storage
            const mastraWithoutStorage = new Mastra({
                logger: false,
            });

            const result = await getScoresByRunIdHandler({
                mastra: mastraWithoutStorage,
                runId: 'test-run-1',
                pagination,
            });

            expect(result).toEqual([]);
        });

        it('should handle storage errors gracefully', async () => {
            const pagination = createPagination({ page: 0, perPage: 10 });
            const error = new Error('Storage error');

            mockStorage.getScoresByRunId.mockRejectedValue(error);

            await expect(getScoresByRunIdHandler({
                mastra,
                runId: 'test-run-1',
                pagination,
            })).rejects.toThrow(HTTPException);
        });

        it('should handle API errors with status codes', async () => {
            const pagination = createPagination({ page: 0, perPage: 10 });
            const apiError = {
                message: 'Not found',
                status: 404,
            };

            mockStorage.getScoresByRunId.mockRejectedValue(apiError);

            await expect(getScoresByRunIdHandler({
                mastra,
                runId: 'test-run-1',
                pagination,
            })).rejects.toThrow(HTTPException);
        });
    });

    describe('getScoresByEntityIdHandler', () => {
        it('should get scores by entity ID successfully', async () => {
            const mockScores = [createScore({ entityType: 'agent', entity: { id: 'test-agent' } })];
            const pagination = createPagination({ page: 0, perPage: 10 });

            mockStorage.getScoresByEntityId.mockResolvedValue({
                scores: mockScores,
                pagination: {
                    total: 1,
                    page: 0,
                    perPage: 10,
                    hasMore: false,
                },
            });

            const result = await getScoresByEntityIdHandler({
                mastra,
                entityId: 'test-agent',
                entityType: 'agent',
                pagination,
            });

            expect(result).toEqual({
                scores: mockScores,
                pagination: {
                    total: 1,
                    page: 0,
                    perPage: 10,
                    hasMore: false,
                },
            });
            expect(mockStorage.getScoresByEntityId).toHaveBeenCalledWith({
                entityId: 'test-agent',
                entityType: 'agent',
                pagination,
            });
        });

        it('should return empty array when storage method is not available', async () => {
            const pagination = createPagination({ page: 0, perPage: 10 });

            // Create mastra instance without storage
            const mastraWithoutStorage = new Mastra({
                logger: false,
            });

            const result = await getScoresByEntityIdHandler({
                mastra: mastraWithoutStorage,
                entityId: 'test-agent',
                entityType: 'agent',
                pagination,
            });

            expect(result).toEqual([]);
        });

        it('should handle storage errors gracefully', async () => {
            const pagination = createPagination({ page: 0, perPage: 10 });
            const error = new Error('Storage error');

            mockStorage.getScoresByEntityId.mockRejectedValue(error);

            await expect(getScoresByEntityIdHandler({
                mastra,
                entityId: 'test-agent',
                entityType: 'agent',
                pagination,
            })).rejects.toThrow(HTTPException);
        });

        it('should handle API errors with status codes', async () => {
            const pagination = createPagination({ page: 0, perPage: 10 });
            const apiError = {
                message: 'Entity not found',
                status: 404,
            };

            mockStorage.getScoresByEntityId.mockRejectedValue(apiError);

            await expect(getScoresByEntityIdHandler({
                mastra,
                entityId: 'test-agent',
                entityType: 'agent',
                pagination,
            })).rejects.toThrow(HTTPException);
        });

        it('should work with different entity types', async () => {
            const mockScores = [createScore({ entityType: 'workflow', entity: { id: 'test-workflow' } })];
            const pagination = createPagination({ page: 0, perPage: 10 });

            mockStorage.getScoresByEntityId.mockResolvedValue({
                scores: mockScores,
                pagination: {
                    total: 1,
                    page: 0,
                    perPage: 10,
                    hasMore: false,
                },
            });

            const result = await getScoresByEntityIdHandler({
                mastra,
                entityId: 'test-workflow',
                entityType: 'workflow',
                pagination,
            });

            expect(result).toEqual({
                scores: mockScores,
                pagination: {
                    total: 1,
                    page: 0,
                    perPage: 10,
                    hasMore: false,
                },
            });
            expect(mockStorage.getScoresByEntityId).toHaveBeenCalledWith({
                entityId: 'test-workflow',
                entityType: 'workflow',
                pagination,
            });
        });
    });

    describe('saveScoreHandler', () => {
        it('should save score successfully', async () => {
            const score = createScore({ id: 'new-score-1' });
            const savedScore = { score };

            mockStorage.saveScore.mockResolvedValue(savedScore);

            const result = await saveScoreHandler({
                mastra,
                score,
            });

            expect(result).toEqual(savedScore);
            expect(mockStorage.saveScore).toHaveBeenCalledWith(score);
        });

        it('should return empty array when storage method is not available', async () => {
            const score = createScore({ id: 'new-score-1' });

            // Create mastra instance without storage
            const mastraWithoutStorage = new Mastra({
                logger: false,
            });

            const result = await saveScoreHandler({
                mastra: mastraWithoutStorage,
                score,
            });

            expect(result).toEqual([]);
        });

        it('should handle storage errors gracefully', async () => {
            const score = createScore({ id: 'new-score-1' });
            const error = new Error('Storage error');

            mockStorage.saveScore.mockRejectedValue(error);

            await expect(saveScoreHandler({
                mastra,
                score,
            })).rejects.toThrow(HTTPException);
        });

        it('should handle API errors with status codes', async () => {
            const score = createScore({ id: 'new-score-1' });
            const apiError = {
                message: 'Validation error',
                status: 400,
            };

            mockStorage.saveScore.mockRejectedValue(apiError);

            await expect(saveScoreHandler({
                mastra,
                score,
            })).rejects.toThrow(HTTPException);
        });

        it('should handle score with all optional fields', async () => {
            const score = createScore({
                id: 'complete-score-1',
                traceId: 'test-trace-1',
                metadata: { source: 'test' },
                additionalLLMContext: { context: 'test' },
                runtimeContext: { runtime: 'test' },
                entityType: 'agent',
                entity: { id: 'test-agent', name: 'Test Agent' },
                resourceId: 'test-resource',
                threadId: 'test-thread',
            });

            const savedScore = { score };

            mockStorage.saveScore.mockResolvedValue(savedScore);

            const result = await saveScoreHandler({
                mastra,
                score,
            });

            expect(result).toEqual(savedScore);
            expect(mockStorage.saveScore).toHaveBeenCalledWith(score);
        });
    });
}); 