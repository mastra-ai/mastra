import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Notion scenario: pages, blocks, databases, comments, users, and
 * search across most of the Notion tool surface.
 *
 * Notion has no hard delete for pages or databases; archive + restore is the
 * closest thing. For blocks, delete_block IS a hard removal (the block id is
 * returned so you can confirm removal).
 */
export const notionScenario: Scenario = {
  integrationId: 'notion',
  summary: 'pages + blocks + databases + comments + users + search',
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

    // Read-only inventory first — tools that don't need an owned resource.
    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['notion_get_bot_user', {}],
          ['notion_list_users', { page_size: 5 }],
          ['notion_search_pages', { query: '', page_size: 5 }],
          ['notion_search_databases', { query: '', page_size: 5 }],
        ],
        tools,
      )),
    );

    // User surface: grab a user id from list_users (every workspace has at
    // least the bot user) and round-trip it through both get_user and
    // retrieve_user. These are two generated views on the same endpoint
    // with inconsistent casing — exercise both so a schema regression on
    // either breaks the smoke run.
    let someUserId: string | undefined;
    try {
      const users = await call<{ users?: Array<{ id?: string }>; results?: Array<{ id?: string }> }>(
        'notion_list_users',
        { page_size: 5 },
      );
      someUserId = users.users?.[0]?.id ?? users.results?.[0]?.id;
    } catch {
      // list_users already recorded above.
    }
    if (someUserId && tools['notion_get_user']) {
      try {
        await call('notion_get_user', { userId: someUserId });
        steps.push(makeStep('get user', 'notion_get_user', 'pass'));
      } catch (error) {
        steps.push(makeStep('get user', 'notion_get_user', 'fail', errorMessage(error)));
      }
    }
    if (someUserId && tools['notion_retrieve_user']) {
      try {
        await call('notion_retrieve_user', { user_id: someUserId });
        steps.push(makeStep('retrieve user', 'notion_retrieve_user', 'pass'));
      } catch (error) {
        steps.push(makeStep('retrieve user', 'notion_retrieve_user', 'fail', errorMessage(error)));
      }
    }

    // Notion's search returns { results, next_cursor, has_more }, not
    // { items }. Historical gotcha: reading .items here hid real page access.
    const search = await call<{ results?: Array<{ object?: string; id?: string }> }>('notion_search', {
      query: '',
      page_size: 10,
    });
    const parentPage = (search.results ?? []).find(i => i.object === 'page' && typeof i.id === 'string');
    const title = `${runId} smoke page`;
    let pageId: string | undefined;

    if (parentPage?.id) {
      steps.push(makeStep('find parent page', 'notion_search', 'pass', parentPage.id));
      try {
        const created = await call<{ id: string }>('notion_create_page', {
          parent: { page_id: parentPage.id },
          properties: {
            title: [{ type: 'text', text: { content: title } }],
          },
        });
        pageId = created.id;
        steps.push(makeStep('create child page', 'notion_create_page', 'pass', pageId));
      } catch (error) {
        steps.push(makeStep('create child page', 'notion_create_page', 'fail', errorMessage(error)));
        return steps;
      }
    } else {
      // Empty workspace / no shared pages. Try a workspace-root page; this
      // only works for internal integrations.
      steps.push(makeStep('find parent page', 'notion_search', 'pass', 'empty workspace — bootstrapping root'));
      try {
        const created = await call<{ id: string }>('notion_create_page', {
          parent: { workspace: true },
          properties: {
            title: [{ type: 'text', text: { content: title } }],
          },
        });
        pageId = created.id;
        steps.push(makeStep('create root page', 'notion_create_page', 'pass', pageId));
      } catch (error) {
        steps.push(makeStep('create root page', 'notion_create_page', 'fail', errorMessage(error)));
        return steps;
      }
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

    // Duplicate before adding child blocks/databases. The duplicate tool
    // walks the source's block tree and replays it; a child_database block
    // can't be replayed through the public API, so duplicating later would
    // 400. Duplicating now exercises the happy path.
    let duplicateId: string | undefined;
    if (tools['notion_duplicate_page']) {
      try {
        const dup = await call<{ id: string }>('notion_duplicate_page', { page_id: pageId });
        duplicateId = dup.id;
        steps.push(makeStep('duplicate page', 'notion_duplicate_page', 'pass', duplicateId));
      } catch (error) {
        steps.push(makeStep('duplicate page', 'notion_duplicate_page', 'fail', errorMessage(error)));
      }
    }

    // Block append surface. Every append helper takes { block_id, children:
    // Array<RawBlockObject> } — the typed helpers (append_heading_block,
    // append_todo_block, etc.) are convenience wrappers around the same
    // Notion endpoint, not shortcut DSLs. Each children entry must be a real
    // Notion block object, not a flat { text, level } shape.
    const tryAppend = async (name: string, toolId: string, child: Record<string, unknown>) => {
      if (!tools[toolId]) return;
      try {
        await call(toolId, { block_id: pageId, children: [child] });
        steps.push(makeStep(name, toolId, 'pass'));
      } catch (error) {
        steps.push(makeStep(name, toolId, 'fail', errorMessage(error)));
      }
    };

    const richText = (content: string) => [{ type: 'text', text: { content } }];
    await tryAppend('append paragraph', 'notion_append_block_children', {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(`smoke body ${runId}`) },
    });
    await tryAppend('append heading', 'notion_append_heading_block', {
      heading_2: { rich_text: richText('smoke heading') },
    });
    await tryAppend('append bulleted list', 'notion_append_bulleted_list', {
      bulleted_list_item: { rich_text: richText('one') },
    });
    await tryAppend('append todo', 'notion_append_todo_block', {
      to_do: { rich_text: richText('smoke todo'), checked: false },
    });
    await tryAppend('append callout', 'notion_append_callout_block', {
      callout: { rich_text: richText('smoke callout'), icon: { type: 'emoji', emoji: '💨' } },
    });
    await tryAppend('append code', 'notion_append_code_block', {
      code: { rich_text: richText('const smoke = true;'), language: 'typescript' },
    });
    await tryAppend('append divider', 'notion_append_divider', { divider: {} });

    // Walk the block tree, update + delete the first user-created block.
    let firstBlockId: string | undefined;
    if (tools['notion_list_block_children']) {
      try {
        const blocks = await call<{ results?: Array<{ id?: string; type?: string }> }>('notion_list_block_children', {
          block_id: pageId,
        });
        firstBlockId = blocks.results?.find(b => b.id && b.type !== 'child_page')?.id;
        steps.push(
          makeStep(
            'list block children',
            'notion_list_block_children',
            'pass',
            `${blocks.results?.length ?? 0} blocks`,
          ),
        );
      } catch (error) {
        steps.push(makeStep('list block children', 'notion_list_block_children', 'fail', errorMessage(error)));
      }
    }

    if (firstBlockId && tools['notion_retrieve_block']) {
      try {
        await call('notion_retrieve_block', { block_id: firstBlockId });
        steps.push(makeStep('retrieve block', 'notion_retrieve_block', 'pass'));
      } catch (error) {
        steps.push(makeStep('retrieve block', 'notion_retrieve_block', 'fail', errorMessage(error)));
      }
    }

    if (firstBlockId && tools['notion_update_block']) {
      try {
        await call('notion_update_block', {
          block_id: firstBlockId,
          paragraph: { rich_text: [{ type: 'text', text: { content: 'edited by smoke test' } }] },
        });
        steps.push(makeStep('update block', 'notion_update_block', 'pass'));
      } catch (error) {
        steps.push(makeStep('update block', 'notion_update_block', 'fail', errorMessage(error)));
      }
    }

    if (firstBlockId && tools['notion_delete_block']) {
      try {
        await call('notion_delete_block', { block_id: firstBlockId });
        steps.push(makeStep('delete block', 'notion_delete_block', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete block', 'notion_delete_block', 'fail', errorMessage(error)));
      }
    }

    // Database CRUD under the page.
    let databaseId: string | undefined;
    if (tools['notion_create_database']) {
      try {
        const db = await call<{ id: string }>('notion_create_database', {
          parent: { page_id: pageId },
          title: [{ type: 'text', text: { content: `${runId} smoke db` } }],
          properties: {
            Name: { title: {} },
            Status: {
              select: {
                options: [
                  { name: 'todo', color: 'gray' },
                  { name: 'done', color: 'green' },
                ],
              },
            },
          },
        });
        databaseId = db.id;
        steps.push(makeStep('create database', 'notion_create_database', 'pass', databaseId));
      } catch (error) {
        steps.push(makeStep('create database', 'notion_create_database', 'fail', errorMessage(error)));
      }
    }

    if (databaseId && tools['notion_retrieve_database']) {
      try {
        await call('notion_retrieve_database', { database_id: databaseId });
        steps.push(makeStep('retrieve database', 'notion_retrieve_database', 'pass'));
      } catch (error) {
        steps.push(makeStep('retrieve database', 'notion_retrieve_database', 'fail', errorMessage(error)));
      }
    }

    if (databaseId && tools['notion_update_database']) {
      try {
        await call('notion_update_database', {
          database_id: databaseId,
          title: [{ type: 'text', text: { content: `${runId} smoke db (renamed)` } }],
        });
        steps.push(makeStep('update database', 'notion_update_database', 'pass'));
      } catch (error) {
        steps.push(makeStep('update database', 'notion_update_database', 'fail', errorMessage(error)));
      }
    }

    if (databaseId && tools['notion_query_database']) {
      try {
        await call('notion_query_database', { database_id: databaseId, page_size: 5 });
        steps.push(makeStep('query database', 'notion_query_database', 'pass'));
      } catch (error) {
        steps.push(makeStep('query database', 'notion_query_database', 'fail', errorMessage(error)));
      }
    }

    if (databaseId && tools['notion_query_database_filtered']) {
      try {
        await call('notion_query_database_filtered', {
          database_id: databaseId,
          filter: { property: 'Name', title: { contains: runId } },
          page_size: 5,
        });
        steps.push(makeStep('query database filtered', 'notion_query_database_filtered', 'pass'));
      } catch (error) {
        steps.push(makeStep('query database filtered', 'notion_query_database_filtered', 'fail', errorMessage(error)));
      }
    }

    if (databaseId && tools['notion_query_database_sorted']) {
      try {
        await call('notion_query_database_sorted', {
          database_id: databaseId,
          sorts: [{ property: 'Name', direction: 'ascending' }],
          page_size: 5,
        });
        steps.push(makeStep('query database sorted', 'notion_query_database_sorted', 'pass'));
      } catch (error) {
        steps.push(makeStep('query database sorted', 'notion_query_database_sorted', 'fail', errorMessage(error)));
      }
    }

    // Data-source surface (Notion's multi-source database API). Every
    // database has at least one implicit data source. retrieve_database
    // returns it on the `data_sources` array; use that id to drive the
    // retrieve / query / list_templates / update / create tools.
    let dataSourceId: string | undefined;
    if (databaseId && tools['notion_retrieve_database']) {
      try {
        const db = await call<{ data_sources?: Array<{ id?: string }> }>('notion_retrieve_database', {
          database_id: databaseId,
        });
        dataSourceId = db.data_sources?.[0]?.id;
      } catch {
        // retrieve_database already recorded above.
      }
    }

    if (dataSourceId && tools['notion_retrieve_data_source']) {
      try {
        await call('notion_retrieve_data_source', { data_source_id: dataSourceId });
        steps.push(makeStep('retrieve data source', 'notion_retrieve_data_source', 'pass'));
      } catch (error) {
        steps.push(makeStep('retrieve data source', 'notion_retrieve_data_source', 'fail', errorMessage(error)));
      }
    }

    if (dataSourceId && tools['notion_query_data_source']) {
      try {
        await call('notion_query_data_source', { data_source_id: dataSourceId });
        steps.push(makeStep('query data source', 'notion_query_data_source', 'pass'));
      } catch (error) {
        steps.push(makeStep('query data source', 'notion_query_data_source', 'fail', errorMessage(error)));
      }
    }

    if (dataSourceId && tools['notion_list_data_source_templates']) {
      try {
        await call('notion_list_data_source_templates', { dataSourceId });
        steps.push(makeStep('list data source templates', 'notion_list_data_source_templates', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list data source templates', 'notion_list_data_source_templates', 'fail', errorMessage(error)),
        );
      }
    }

    if (dataSourceId && tools['notion_update_data_source']) {
      try {
        await call('notion_update_data_source', {
          dataSourceId,
          title: [{ type: 'text', text: { content: `${runId} ds (renamed)` } }],
        });
        steps.push(makeStep('update data source', 'notion_update_data_source', 'pass'));
      } catch (error) {
        steps.push(makeStep('update data source', 'notion_update_data_source', 'fail', errorMessage(error)));
      }
    }

    // create_data_source adds a second source to the same database. Casing
    // of the first field is camelCase because the generated tool is
    // inconsistent with retrieve/query above — intentionally spell both.
    if (databaseId && tools['notion_create_data_source']) {
      try {
        await call('notion_create_data_source', {
          databaseId,
          title: [{ type: 'text', text: { content: `${runId} extra source` } }],
          properties: {
            Name: { title: {} },
          },
        });
        steps.push(makeStep('create data source', 'notion_create_data_source', 'pass'));
      } catch (error) {
        steps.push(makeStep('create data source', 'notion_create_data_source', 'fail', errorMessage(error)));
      }
    }

    // Page property surface. Every page has a `title` property with id
    // "title"; both tools accept it.
    if (tools['notion_retrieve_page_property']) {
      try {
        await call('notion_retrieve_page_property', { page_id: pageId, property_id: 'title' });
        steps.push(makeStep('retrieve page property', 'notion_retrieve_page_property', 'pass'));
      } catch (error) {
        steps.push(makeStep('retrieve page property', 'notion_retrieve_page_property', 'fail', errorMessage(error)));
      }
    }
    if (tools['notion_get_page_property_item']) {
      try {
        await call('notion_get_page_property_item', { page_id: pageId, property_id: 'title' });
        steps.push(makeStep('get page property item', 'notion_get_page_property_item', 'pass'));
      } catch (error) {
        steps.push(makeStep('get page property item', 'notion_get_page_property_item', 'fail', errorMessage(error)));
      }
    }

    // retrieve_block_children is an alternate view on list_block_children
    // (same endpoint, different generated wrapper). Call it on the page.
    if (tools['notion_retrieve_block_children']) {
      try {
        await call('notion_retrieve_block_children', { block_id: pageId });
        steps.push(makeStep('retrieve block children', 'notion_retrieve_block_children', 'pass'));
      } catch (error) {
        steps.push(makeStep('retrieve block children', 'notion_retrieve_block_children', 'fail', errorMessage(error)));
      }
    }

    // Move the page under the duplicate (which has the same parent, so
    // it's a valid reparent target), then move it back. Needs a second
    // page to move under; the duplicate we created earlier works.
    if (duplicateId && tools['notion_move_page'] && tools['notion_retrieve_page']) {
      let originalParent: Record<string, unknown> | undefined;
      try {
        const page = await call<{ parent?: Record<string, unknown> }>('notion_retrieve_page', { page_id: pageId });
        originalParent = page.parent;
      } catch {
        // retrieve already recorded above.
      }
      try {
        await call('notion_move_page', { page_id: pageId, parent: { page_id: duplicateId } });
        steps.push(makeStep('move page', 'notion_move_page', 'pass'));
        // Put it back where we found it so cleanup can reach it.
        if (originalParent) {
          try {
            await call('notion_move_page', { page_id: pageId, parent: originalParent });
          } catch (error) {
            log.warn(`Failed to restore smoke page parent for ${pageId}`, errorMessage(error));
          }
        }
      } catch (error) {
        steps.push(makeStep('move page', 'notion_move_page', 'fail', errorMessage(error)));
      }
    }

    // Markdown surface.
    if (tools['notion_get_page_as_markdown']) {
      try {
        await call('notion_get_page_as_markdown', { page_id: pageId });
        steps.push(makeStep('page as markdown', 'notion_get_page_as_markdown', 'pass'));
      } catch (error) {
        steps.push(makeStep('page as markdown', 'notion_get_page_as_markdown', 'fail', errorMessage(error)));
      }
    }

    if (tools['notion_update_page_markdown']) {
      try {
        await call('notion_update_page_markdown', {
          page_id: pageId,
          markdown: `## Smoke run ${runId}\n\nSome paragraph.`,
        });
        steps.push(makeStep('update page markdown', 'notion_update_page_markdown', 'pass'));
      } catch (error) {
        steps.push(makeStep('update page markdown', 'notion_update_page_markdown', 'fail', errorMessage(error)));
      }
    }

    // Comments.
    let commentId: string | undefined;
    if (tools['notion_create_comment']) {
      try {
        const comment = await call<{ id: string }>('notion_create_comment', {
          parent: { page_id: pageId },
          rich_text: [{ type: 'text', text: { content: `${runId} smoke comment` } }],
        });
        commentId = comment.id;
        steps.push(makeStep('create comment', 'notion_create_comment', 'pass', commentId));
      } catch (error) {
        steps.push(makeStep('create comment', 'notion_create_comment', 'fail', errorMessage(error)));
      }
    }

    if (tools['notion_list_comments']) {
      try {
        await call('notion_list_comments', { block_id: pageId });
        steps.push(makeStep('list comments', 'notion_list_comments', 'pass'));
      } catch (error) {
        steps.push(makeStep('list comments', 'notion_list_comments', 'fail', errorMessage(error)));
      }
    }

    if (commentId && tools['notion_retrieve_comment']) {
      try {
        await call('notion_retrieve_comment', { comment_id: commentId });
        steps.push(makeStep('retrieve comment', 'notion_retrieve_comment', 'pass'));
      } catch (error) {
        steps.push(makeStep('retrieve comment', 'notion_retrieve_comment', 'fail', errorMessage(error)));
      }
    }

    // Cleanup: archive database, duplicate, main page. restore_page then
    // re-archive verifies the restore path end-to-end.
    if (databaseId) {
      try {
        await call('notion_update_database', { database_id: databaseId, archived: true });
        steps.push(makeStep('archive database', 'notion_update_database', 'pass'));
      } catch (error) {
        log.error(`Failed to archive smoke database ${databaseId}`, errorMessage(error));
        steps.push(makeStep('archive database', 'notion_update_database', 'fail', errorMessage(error)));
      }
    }

    if (duplicateId) {
      try {
        await call('notion_archive_page', { page_id: duplicateId });
        steps.push(makeStep('archive duplicate', 'notion_archive_page', 'pass'));
      } catch (error) {
        log.error(`Failed to archive smoke duplicate ${duplicateId}`, errorMessage(error));
        steps.push(makeStep('archive duplicate', 'notion_archive_page', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('notion_archive_page', { page_id: pageId });
      steps.push(makeStep('archive page', 'notion_archive_page', 'pass'));
    } catch (error) {
      log.error(`Failed to archive smoke page ${pageId}`, errorMessage(error));
      steps.push(makeStep('archive page', 'notion_archive_page', 'fail', errorMessage(error)));
    }

    if (tools['notion_restore_page']) {
      try {
        await call('notion_restore_page', { page_id: pageId });
        steps.push(makeStep('restore page', 'notion_restore_page', 'pass'));
        // Re-archive after restore to leave nothing active.
        try {
          await call('notion_archive_page', { page_id: pageId });
        } catch (error) {
          log.error(`Failed to re-archive smoke page ${pageId}`, errorMessage(error));
        }
      } catch (error) {
        steps.push(makeStep('restore page', 'notion_restore_page', 'fail', errorMessage(error)));
      }
    }

    return steps;
  },
};
