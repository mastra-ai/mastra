import type { DatasetExperimentResult, MastraClient } from '@mastra/client-js';

const PAGE_SIZE = 100;

export const listAllExperimentResults = async (
  client: MastraClient,
  datasetId: string,
  experimentId: string,
): Promise<DatasetExperimentResult[]> => {
  const results: DatasetExperimentResult[] = [];
  for (let page = 0; ; page++) {
    const response = await client.listDatasetExperimentResults(datasetId, experimentId, { page, perPage: PAGE_SIZE });
    results.push(...response.results);
    if (!response.pagination.hasMore || response.results.length === 0) return results;
  }
};
