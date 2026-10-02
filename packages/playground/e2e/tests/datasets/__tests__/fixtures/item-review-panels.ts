import type { MastraClient } from '@mastra/client-js';
import type { Page } from '@playwright/test';
import {
  dataset,
  items,
} from '../../../../../src/domains/datasets/components/dataset-detail/__tests__/fixtures/dataset-items';
import {
  experiment,
  experimentsResponse,
  resultsResponse,
  emptyScoresResponse,
  experimentTraceSpans,
  experimentSpanDetailById,
  experimentTraceScores,
  experimentTraceFeedback,
} from '../../../../../src/domains/experiments/__tests__/fixtures/experiment-item-route';
import { setupMockAuth } from '../../../__utils__/auth';

export { dataset, experiment };

export const panelItems: Awaited<ReturnType<MastraClient['listDatasetItems']>> = {
  items,
  pagination: { total: items.length, page: 0, perPage: 100, hasMore: false },
};
export const longPanelItems: typeof panelItems = {
  ...panelItems,
  items: items.map(item => ({
    ...item,
    input: Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`question-${index}`, `Line ${index}`])),
    groundTruth: { answer: 'Expected answer' },
    metadata: { note: 'End of item content' },
  })),
};

export const longPanelResults: Awaited<ReturnType<MastraClient['listDatasetExperimentResults']>> = {
  ...resultsResponse,
  results: resultsResponse.results.map(result => ({
    ...result,
    input: longPanelItems.items[0].input,
    output: longPanelItems.items[0].input,
  })),
};

const versions: Awaited<ReturnType<MastraClient['listDatasetVersions']>> = {
  versions: [],
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
};

export async function mockPanelRequests(page: Page) {
  await setupMockAuth(page, { role: 'admin' });
  await page.route(
    url => url.pathname === '/api/experiments',
    route => route.fulfill({ json: experimentsResponse }),
  );
  await page.route(`**/api/datasets/${dataset.id}`, route => route.fulfill({ json: dataset }));
  await page.route(`**/api/datasets/${dataset.id}/items?*`, route => route.fulfill({ json: panelItems }));
  await page.route(`**/api/datasets/${dataset.id}/items/*`, route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    const item = items.find(item => item.id === id);
    return route.fulfill(item ? { json: item } : { status: 404, json: { error: 'Item not found' } });
  });
  await page.route(`**/api/datasets/${dataset.id}/versions?*`, route => route.fulfill({ json: versions }));
  await page.route(`**/api/datasets/${dataset.id}/experiments?*`, route =>
    route.fulfill({ json: experimentsResponse }),
  );
  await page.route(`**/api/datasets/${dataset.id}/experiments/${experiment.id}`, route =>
    route.fulfill({ json: experiment }),
  );
  await page.route(
    url => url.pathname === `/api/datasets/${dataset.id}/experiments/${experiment.id}/results`,
    route => route.fulfill({ json: resultsResponse }),
  );
  await page.route(`**/api/scores/run/${experiment.id}?*`, route => route.fulfill({ json: emptyScoresResponse }));
  await page.route('**/api/observability/traces/*/light', route => route.fulfill({ json: experimentTraceSpans }));
  await page.route('**/api/observability/traces/*/spans/*', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    return route.fulfill({ json: experimentSpanDetailById[id] });
  });
  await page.route('**/api/observability/traces/*/*/scores?*', route => route.fulfill({ json: experimentTraceScores }));
  await page.route('**/api/observability/feedback?*', route => route.fulfill({ json: experimentTraceFeedback }));
}
