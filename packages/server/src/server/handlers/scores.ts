import type { ScoreRowData, StoragePagination } from '@mastra/core';
import type { Context } from '../types';
import { handleError } from './error';

export async function getScorersHandler() {
    return [];
}

export async function getScoresByRunIdHandler({
    mastra,
    runId,
    pagination,
}: Context & { runId: string, pagination: StoragePagination }) {
    try {
        const scores = (await mastra.getStorage()?.getScoresByRunId?.({
            runId,
            pagination,
        })) || [];
        return scores;
    } catch (error) {
        return handleError(error, 'Error getting scores by run id');
    }
}

export async function getScoresByEntityIdHandler({
    mastra,
    entityId,
    entityType,
    pagination,
}: Context & { entityId: string; entityType: string, pagination: StoragePagination }) {
    try {
        const scores = (await mastra.getStorage()?.getScoresByEntityId?.({
            entityId,
            entityType,
            pagination,
        })) || [];
        return scores;
    } catch (error) {
        return handleError(error, 'Error getting scores by entity id');
    }
}

export async function saveScoreHandler({
    mastra,
    score,
}: Context & { score: ScoreRowData }) {
    try {
        const scores = (await mastra.getStorage()?.saveScore?.(score)) || [];
        return scores;
    } catch (error) {
        return handleError(error, 'Error saving score');
    }
}