import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Notion scenario: pages (create/read/update/archive) plus the read-only
 * database/block/comment surface. Notion lacks hard delete; archive is the
 * cleanup path.
 */
export const notionScenario: Scenario = {
  integrationId: 'notion',
  summary: 'page CRUD + database/block/comment reads',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'notion_search',
      'notion_create_page',
      'notion_retrieve_page',
      'notion_update_page',
      'notion_archive_page',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const search = await call<{ items: Array<{ object?: string; id?: string }> }>('notion_search', {
      query: '',
      page_size: 10,
    });
    const parentPage = (search.items ?? []).find(i => i.object === 'page' && typeof i.id === 'string');
    if (!parentPage?.id) {
      steps.push(makeStep('find parent page', 'notion_search', 'skip', 'No searchable pages visible to the token.'));
      return steps;
    }
    steps.push(makeStep('find parent page', 'notion_search', 'pass', parentPage.id));

    const title = `${runId} smoke page`;
    let pageId: string | undefined;
    try {
      const created = await call<{ id: string }>('notion_create_page', {
        parent: { page_id: parentPage.id },
        properties: {
          title: [{ type: 'text', text: { content: title } }],
        },
      });
      pageId = created.id;
      steps.push(makeStep('create page', 'notion_create_page', 'pass', pageId));
    } catch (error) {
      steps.push(makeStep('create page', 'notion_create_page', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      const read = await call<{ id: string }>('notion_retrieve_page', { page_id: pageId });
      steps.push(makeStep('read page', 'notion_retrieve_page', read.id === pageId ? 'pass' : 'fail'));
    } catch (error) {
      steps.push(makeStep('read page', 'notion_retrieve_page', 'fail', errorMessage(error)));
    }

    try {
      await call('notion_update_page', {
        page_id: pageId,
        properties: {
          title: [{ type: 'text', text: { content: `${title} (renamed)` } }],
        },
      });
      steps.push(makeStep('update page', 'notion_update_page', 'pass'));
    } catch (error) {
      steps.push(makeStep('update page', 'notion_update_page', 'fail', errorMessage(error)));
    }

    // Opportunistic reads against the created page's children/comments.
    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['notion_retrieve_block_children', { block_id: pageId }],
          ['notion_list_comments', { block_id: pageId }],
          ['notion_search', { query: 'mastra-smoke', page_size: 5 }],
        ],
        tools,
      )),
    );

    try {
      await call('notion_archive_page', { page_id: pageId });
      steps.push(makeStep('archive page', 'notion_archive_page', 'pass'));
    } catch (error) {
      log.error(`Failed to archive smoke page ${pageId} — clean up manually.`, errorMessage(error));
      steps.push(makeStep('archive page', 'notion_archive_page', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
