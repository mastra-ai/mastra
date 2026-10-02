import type { Scenario, ScenarioStep } from '../scenario.js';
import { requireTools } from '../scenario.js';

/**
 * Notion smoke: create a child page under an existing searchable page, read
 * it back, rename the title, then archive it. Notion has no hard delete for
 * pages; archive is the supported cleanup path.
 *
 * The project connection must have access to at least one page the token can
 * parent new pages under. If search returns nothing, the scenario skips rather
 * than failing — a token with search-only access is useless for a mutating
 * suite and that is worth flagging but not failing on.
 */
export const notionScenario: Scenario = {
  integrationId: 'notion',
  summary: 'create → read → update → archive page',
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

    // Find a page we can parent new pages under. Filter to page objects so a
    // data source id does not slip through — create-page accepts both but the
    // scenario reads back as a page.
    const searchResult = await call<{ results: Array<{ id?: string; object?: string }> }>('notion_search', {
      filter: { property: 'object', value: 'page' },
      page_size: 5,
    });
    const parent = searchResult.results?.find(r => r?.object === 'page' && typeof r.id === 'string') as
      | { id: string }
      | undefined;
    if (!parent) {
      steps.push({
        name: 'find parent page',
        toolId: 'notion_search',
        status: 'skip',
        detail: 'No pages visible to the connected integration — cannot parent a smoke page.',
      });
      return steps;
    }
    steps.push({ name: 'find parent page', toolId: 'notion_search', status: 'pass', detail: parent.id });

    const title = `${runId} smoke page`;

    let createdId: string | undefined;
    try {
      const created = await call<{ id: string }>('notion_create_page', {
        parent: { page_id: parent.id },
        title,
        markdown: 'Automated @mastra/connect smoke test. Safe to archive.',
      });
      createdId = created.id;
      steps.push({ name: 'create page', toolId: 'notion_create_page', status: 'pass', detail: created.id });
    } catch (error) {
      steps.push({ name: 'create page', toolId: 'notion_create_page', status: 'fail', detail: errorMessage(error) });
      return steps;
    }

    try {
      await call('notion_retrieve_page', { page_id: createdId });
      steps.push({ name: 'read back', toolId: 'notion_retrieve_page', status: 'pass' });
    } catch (error) {
      steps.push({ name: 'read back', toolId: 'notion_retrieve_page', status: 'fail', detail: errorMessage(error) });
    }

    const renamed = `${title} (renamed)`;
    try {
      await call('notion_update_page', {
        page_id: createdId,
        properties: {
          title: {
            title: [{ type: 'text', text: { content: renamed } }],
          },
        },
      });
      steps.push({ name: 'update title', toolId: 'notion_update_page', status: 'pass' });
    } catch (error) {
      steps.push({ name: 'update title', toolId: 'notion_update_page', status: 'fail', detail: errorMessage(error) });
    }

    try {
      await call('notion_archive_page', { page_id: createdId });
      steps.push({ name: 'archive page', toolId: 'notion_archive_page', status: 'pass' });
    } catch (error) {
      log.error(`Failed to archive smoke page ${createdId} — clean up manually.`, errorMessage(error));
      steps.push({ name: 'archive page', toolId: 'notion_archive_page', status: 'fail', detail: errorMessage(error) });
    }

    return steps;
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
