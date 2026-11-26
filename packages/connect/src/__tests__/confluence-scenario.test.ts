import { describe, expect, it } from 'vitest';

import type { ScenarioContext, ScenarioStep } from '../../scripts/smoke-test/scenario.js';
import { confluenceScenario } from '../../scripts/smoke-test/scenarios/confluence.js';

// Drives the Confluence smoke scenario with a stand-in `call`, so the cleanup
// and preflight paths can be checked without a live Confluence site.

const TOOL_IDS = [
  'create_blog_post',
  'create_footer_comment',
  'create_inline_comment',
  'create_page',
  'create_page_property',
  'delete_attachment',
  'delete_blog_post',
  'delete_footer_comment',
  'delete_inline_comment',
  'delete_page',
  'delete_page_property',
  'get_attachment',
  'get_blog_post',
  'get_footer_comment',
  'get_inline_comment',
  'get_page',
  'get_page_property',
  'get_space',
  'list_attachments',
  'list_blog_posts',
  'list_blog_posts_for_label',
  'list_page_attachments',
  'list_page_footer_comments',
  'list_page_inline_comments',
  'list_page_properties',
  'list_pages',
  'list_pages_for_label',
  'list_space_blog_posts',
  'list_space_pages',
  'list_spaces',
  'search_content',
  'update_blog_post',
  'update_footer_comment',
  'update_inline_comment',
  'update_page',
  'update_page_property',
].map(id => `confluence_${id}`);

const RESPONSES: Record<string, unknown> = {
  confluence_list_spaces: { items: [{ id: '42', key: 'ENG', status: 'current' }] },
  confluence_get_space: { id: '42', key: 'ENG' },
  confluence_create_page: { id: '7' },
  confluence_create_page_property: { id: '11', version: { number: 1 } },
  confluence_create_footer_comment: { id: '21' },
  confluence_create_inline_comment: { id: '31' },
  confluence_create_blog_post: { id: '8' },
};

async function runScenario({
  toolIds = TOOL_IDS,
  fail = {},
}: { toolIds?: string[]; fail?: Record<string, string> } = {}) {
  const calls: Array<{ toolId: string; input: unknown }> = [];
  const errors: string[] = [];
  const tools = Object.fromEntries(toolIds.map(id => [id, {}]));
  const context = {
    integrationId: 'confluence',
    tools,
    allTools: tools,
    runId: 'run-1',
    log: { info() {}, warn() {}, error: (message: string) => errors.push(message) },
    call: async <T>(toolId: string, input: unknown): Promise<T> => {
      calls.push({ toolId, input });
      if (fail[toolId]) throw new Error(fail[toolId]);
      return (RESPONSES[toolId] ?? {}) as T;
    },
  } as unknown as ScenarioContext;
  const steps: ScenarioStep[] = await confluenceScenario.run(context);
  return { steps, calls, errors };
}

describe('confluence smoke scenario', () => {
  it('skips, rather than fails, when a required tool is missing', async () => {
    const { steps, calls } = await runScenario({ toolIds: TOOL_IDS.filter(id => id !== 'confluence_get_page') });

    expect(steps).toEqual([expect.objectContaining({ name: 'preflight', status: 'skip' })]);
    expect(calls).toEqual([]);
  });

  it.each([
    ['confluence_delete_footer_comment', 'footer comment', '21'],
    ['confluence_delete_inline_comment', 'inline comment', '31'],
    ['confluence_delete_page_property', 'page property', '11'],
  ])('logs the id of a %s it could not delete', async (toolId, kind, id) => {
    const { steps, errors } = await runScenario({ fail: { [toolId]: 'status=403 Forbidden' } });

    expect(steps).toContainEqual(expect.objectContaining({ name: `delete ${kind}`, status: 'fail' }));
    expect(errors).toContainEqual(expect.stringMatching(new RegExp(`${kind} ${id} \\(run run-1\\)`)));
  });

  it('lists footer comments with the page id as a string', async () => {
    const { calls } = await runScenario();

    expect(calls).toContainEqual({ toolId: 'confluence_list_page_footer_comments', input: { pageId: '7' } });
  });
});
