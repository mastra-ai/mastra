import { randomInt } from 'node:crypto';

import type { Scenario, ScenarioContext, ScenarioLogger, ScenarioStep } from '../scenario.js';
import { errorMessage, makeStep, probeTool, requireTools, runReadBatch } from '../scenario.js';

/**
 * Confluence scenario: creates a page and a blog post in one space, exercises
 * properties, footer comments, and inline comments on the page, reads
 * attachments and labels, then deletes and purges everything it created.
 *
 * The space is `MASTRA_SMOKE_CONFLUENCE_SPACE_ID` when set, otherwise the first
 * current space the connection can see. The connected user must be able to add
 * pages and blog posts there.
 *
 * Nothing here can upload an attachment or add a label, so:
 * - `get_attachment` reads an existing attachment when one is visible and
 *   otherwise probes a made-up id; `delete_attachment` always probes a made-up
 *   id so the run never deletes someone's file.
 * - the label listings probe a made-up label id.
 *
 * Confluence ids are numeric strings, but `get_space` and
 * `delete_page_property` type them as numbers, so those calls convert.
 */

const CONFLUENCE_TOOLS = [
  'confluence_create_blog_post',
  'confluence_create_footer_comment',
  'confluence_create_inline_comment',
  'confluence_create_page',
  'confluence_create_page_property',
  'confluence_delete_attachment',
  'confluence_delete_blog_post',
  'confluence_delete_footer_comment',
  'confluence_delete_inline_comment',
  'confluence_delete_page',
  'confluence_delete_page_property',
  'confluence_get_attachment',
  'confluence_get_blog_post',
  'confluence_get_footer_comment',
  'confluence_get_inline_comment',
  'confluence_get_page',
  'confluence_get_page_property',
  'confluence_get_space',
  'confluence_list_attachments',
  'confluence_list_blog_posts',
  'confluence_list_blog_posts_for_label',
  'confluence_list_page_attachments',
  'confluence_list_page_footer_comments',
  'confluence_list_page_inline_comments',
  'confluence_list_page_properties',
  'confluence_list_pages',
  'confluence_list_pages_for_label',
  'confluence_list_space_blog_posts',
  'confluence_list_space_pages',
  'confluence_list_spaces',
  'confluence_search_content',
  'confluence_update_blog_post',
  'confluence_update_footer_comment',
  'confluence_update_inline_comment',
  'confluence_update_page',
  'confluence_update_page_property',
] as const;

/** The page text the inline comment highlights; it must appear exactly once. */
const MARKER = 'smoke marker';

interface Space {
  id: string;
  key: string;
  status?: string;
}

type Call = ScenarioContext['call'];

/** Large enough that a real Confluence id won't match. */
function syntheticId(): string {
  return `9${randomInt(10 ** 11, 10 ** 12 - 1)}`;
}

async function step(steps: ScenarioStep[], name: string, toolId: string, run: () => Promise<string | void>) {
  try {
    const detail = await run();
    steps.push(makeStep(name, toolId, 'pass', detail ?? undefined));
    return true;
  } catch (error) {
    steps.push(makeStep(name, toolId, 'fail', errorMessage(error)));
    return false;
  }
}

/**
 * Deletes a child record (property or comment). The page purge afterwards
 * removes it anyway, but a failed delete is still logged with its id so the
 * cleanup failure is visible.
 */
async function cleanupChild(
  steps: ScenarioStep[],
  log: ScenarioLogger,
  runId: string,
  kind: string,
  toolId: string,
  recordId: string,
  run: () => Promise<void>,
) {
  if (!(await step(steps, `delete ${kind}`, toolId, run))) {
    log.error(`Failed to delete smoke ${kind} ${recordId} (run ${runId}); the page purge should remove it.`);
  }
}

async function pickSpace(call: Call): Promise<Space | undefined> {
  const pinned = process.env.MASTRA_SMOKE_CONFLUENCE_SPACE_ID?.trim();
  const listed = await call<{ items: Space[] }>('confluence_list_spaces', {});
  if (pinned) return listed.items.find(space => space.id === pinned) ?? { id: pinned, key: '' };
  return listed.items.find(space => space.status === 'current') ?? listed.items[0];
}

/** Trashes a page or blog post, then purges it from the trash. */
async function removeContent(
  call: Call,
  steps: ScenarioStep[],
  log: ScenarioContext['log'],
  kind: 'page' | 'blog post',
  id: string,
  runId: string,
) {
  const toolId = kind === 'page' ? 'confluence_delete_page' : 'confluence_delete_blog_post';
  const trashed = await step(steps, `trash ${kind}`, toolId, async () => {
    await call(toolId, { id });
  });
  if (!trashed) {
    log.error(`confluence: leaked ${kind} ${id} (${runId}); delete it manually`);
    return;
  }
  const purged = await step(steps, `purge ${kind}`, toolId, async () => {
    await call(toolId, { id, purge: true });
  });
  if (!purged) log.error(`confluence: ${kind} ${id} (${runId}) is still in the space trash; purge it manually`);
}

async function runPageLifecycle(
  { call, runId, log, tools }: ScenarioContext,
  steps: ScenarioStep[],
  space: Space,
): Promise<void> {
  let pageId: string | undefined;
  await step(steps, 'create page', 'confluence_create_page', async () => {
    const page = await call<{ id: string }>('confluence_create_page', {
      spaceId: space.id,
      title: `${runId} smoke page`,
      status: 'current',
      body: `<p>${runId} ${MARKER} text.</p>`,
    });
    pageId = page.id;
    return pageId;
  });
  if (!pageId) return;
  const page = pageId;

  try {
    await step(steps, 'read page', 'confluence_get_page', async () => {
      const got = await call<{ id: string; title?: string }>('confluence_get_page', { id: page });
      if (got.id !== page) throw new Error(`read back page ${got.id}`);
    });
    await step(steps, 'update page', 'confluence_update_page', async () => {
      const updated = await call<{ title: string; versionNumber?: number }>('confluence_update_page', {
        id: page,
        title: `${runId} smoke page (renamed)`,
        status: 'current',
        body: `<p>${runId} ${MARKER} text, updated.</p>`,
        versionMessage: 'smoke test',
      });
      if (!updated.title.endsWith('(renamed)')) throw new Error(`title is ${updated.title}`);
      return `version ${updated.versionNumber ?? '?'}`;
    });

    await runPropertyLifecycle(call, steps, log, page, runId);
    await runFooterCommentLifecycle(call, steps, log, page, runId);
    await runInlineCommentLifecycle(call, steps, log, page, runId);

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['confluence_list_page_attachments', { pageId: page }],
          ['confluence_list_space_pages', { space_id: space.id, limit: 5 }],
        ],
        tools,
      )),
    );
  } finally {
    await removeContent(call, steps, log, 'page', page, runId);
  }
}

async function runPropertyLifecycle(
  call: Call,
  steps: ScenarioStep[],
  log: ScenarioLogger,
  pageId: string,
  runId: string,
) {
  const key = `${runId}-smoke`;
  let propertyId: string | undefined;
  let version = 1;
  await step(steps, 'create page property', 'confluence_create_page_property', async () => {
    const created = await call<{ id?: string; version?: { number?: number } }>('confluence_create_page_property', {
      page_id: pageId,
      key,
      value: { smoke: true },
    });
    propertyId = created.id;
    version = created.version?.number ?? 1;
    if (!propertyId) throw new Error('Confluence returned no property id');
    return propertyId;
  });
  if (!propertyId) return;
  const property = propertyId;
  try {
    await runPropertyReads(call, steps, pageId, property, key, version);
  } finally {
    await cleanupChild(steps, log, runId, 'page property', 'confluence_delete_page_property', property, async () => {
      await call('confluence_delete_page_property', { pageId: String(pageId), propertyId: String(property) });
    });
  }
}

async function runPropertyReads(
  call: Call,
  steps: ScenarioStep[],
  pageId: string,
  property: string,
  key: string,
  version: number,
) {
  await step(steps, 'read page property', 'confluence_get_page_property', async () => {
    const got = await call<{ key: string }>('confluence_get_page_property', { pageId, propertyId: property });
    if (got.key !== key) throw new Error(`read back key ${got.key}`);
  });
  await step(steps, 'list page properties', 'confluence_list_page_properties', async () => {
    const listed = await call<{ properties: Array<{ id?: string }> }>('confluence_list_page_properties', { pageId });
    if (!listed.properties.some(item => item.id === property)) throw new Error('created property not listed');
  });
  await step(steps, 'update page property', 'confluence_update_page_property', async () => {
    await call('confluence_update_page_property', {
      page_id: pageId,
      property_id: property,
      key,
      value: { smoke: 'updated' },
      version_number: version + 1,
    });
  });
}

async function runFooterCommentLifecycle(
  call: Call,
  steps: ScenarioStep[],
  log: ScenarioLogger,
  pageId: string,
  runId: string,
) {
  let commentId: string | undefined;
  let version = 1;
  await step(steps, 'create footer comment', 'confluence_create_footer_comment', async () => {
    const created = await call<{ id: string; version?: { number: number } }>('confluence_create_footer_comment', {
      pageId,
      bodyValue: `<p>${runId} smoke footer comment</p>`,
    });
    commentId = created.id;
    version = created.version?.number ?? 1;
    return commentId;
  });
  if (!commentId) return;
  const comment = commentId;
  try {
    await step(steps, 'read footer comment', 'confluence_get_footer_comment', async () => {
      const got = await call<{ id: string }>('confluence_get_footer_comment', { commentId: comment });
      if (got.id !== comment) throw new Error(`read back comment ${got.id}`);
    });
    await step(steps, 'list footer comments', 'confluence_list_page_footer_comments', async () => {
      await call('confluence_list_page_footer_comments', { pageId });
    });
    await step(steps, 'update footer comment', 'confluence_update_footer_comment', async () => {
      await call('confluence_update_footer_comment', {
        comment_id: comment,
        version_number: version + 1,
        body: `<p>${runId} smoke footer comment, edited</p>`,
      });
    });
  } finally {
    // The page is purged afterwards, which takes its comments with it.
    await cleanupChild(steps, log, runId, 'footer comment', 'confluence_delete_footer_comment', comment, async () => {
      await call('confluence_delete_footer_comment', { comment_id: comment });
    });
  }
}

async function runInlineCommentLifecycle(
  call: Call,
  steps: ScenarioStep[],
  log: ScenarioLogger,
  pageId: string,
  runId: string,
) {
  let commentId: string | undefined;
  await step(steps, 'create inline comment', 'confluence_create_inline_comment', async () => {
    const created = await call<{ id: string }>('confluence_create_inline_comment', {
      pageId,
      body: { representation: 'storage', value: `<p>${runId} smoke inline comment</p>` },
      inlineCommentProperties: {
        textSelection: MARKER,
        textSelectionMatchCount: 1,
        textSelectionMatchIndex: 0,
      },
    });
    commentId = created.id;
    return commentId;
  });
  if (!commentId) return;
  const comment = commentId;
  try {
    await step(steps, 'read inline comment', 'confluence_get_inline_comment', async () => {
      const got = await call<{ id: string }>('confluence_get_inline_comment', { commentId: comment });
      if (got.id !== comment) throw new Error(`read back comment ${got.id}`);
    });
    await step(steps, 'list inline comments', 'confluence_list_page_inline_comments', async () => {
      await call('confluence_list_page_inline_comments', { pageId });
    });
    await step(steps, 'update inline comment', 'confluence_update_inline_comment', async () => {
      await call('confluence_update_inline_comment', {
        commentId: comment,
        body: { representation: 'storage', value: `<p>${runId} smoke inline comment, edited</p>` },
      });
    });
  } finally {
    await cleanupChild(steps, log, runId, 'inline comment', 'confluence_delete_inline_comment', comment, async () => {
      await call('confluence_delete_inline_comment', { commentId: comment });
    });
  }
}

async function runBlogPostLifecycle({ call, runId, log }: ScenarioContext, steps: ScenarioStep[], space: Space) {
  let postId: string | undefined;
  await step(steps, 'create blog post', 'confluence_create_blog_post', async () => {
    const created = await call<{ id: string }>('confluence_create_blog_post', {
      spaceId: space.id,
      title: `${runId} smoke blog post`,
      status: 'current',
      body: `<p>${runId} smoke blog post</p>`,
    });
    postId = created.id;
    return postId;
  });
  if (!postId) return;
  const post = postId;
  try {
    await step(steps, 'read blog post', 'confluence_get_blog_post', async () => {
      const got = await call<{ id: string }>('confluence_get_blog_post', { id: post });
      if (got.id !== post) throw new Error(`read back blog post ${got.id}`);
    });
    await step(steps, 'update blog post', 'confluence_update_blog_post', async () => {
      const updated = await call<{ title?: string }>('confluence_update_blog_post', {
        id: post,
        title: `${runId} smoke blog post (renamed)`,
      });
      if (!updated.title?.endsWith('(renamed)')) throw new Error(`title is ${updated.title}`);
    });
  } finally {
    await removeContent(call, steps, log, 'blog post', post, runId);
  }
}

export const confluenceScenario: Scenario = {
  integrationId: 'confluence',
  summary: 'page + property + comments + blog post lifecycle in one space',
  async run(context) {
    const { tools, call } = context;
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [...CONFLUENCE_TOOLS]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    let space: Space | undefined;
    await step(steps, 'list spaces', 'confluence_list_spaces', async () => {
      space = await pickSpace(call);
      if (!space) throw new Error('No Confluence space visible to this connection.');
      return space.key || space.id;
    });
    if (!space) return steps;
    const { id: spaceId, key: spaceKey } = space;

    await step(steps, 'read space', 'confluence_get_space', async () => {
      const got = await call<{ id: string; key: string }>('confluence_get_space', { id: Number(spaceId) });
      if (got.id !== spaceId) throw new Error(`read back space ${got.id}`);
      space = { ...space!, key: got.key };
    });

    let attachmentId: string | undefined;
    await step(steps, 'list attachments', 'confluence_list_attachments', async () => {
      const listed = await call<{ items: Array<{ id: string }> }>('confluence_list_attachments', {});
      attachmentId = listed.items[0]?.id;
      return attachmentId ? `found ${attachmentId}` : 'none visible';
    });

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['confluence_list_pages', { spaceId, limit: 5 }],
          ['confluence_list_blog_posts', { spaceId, limit: 5 }],
          ['confluence_list_space_blog_posts', { spaceId, limit: 5 }],
          ['confluence_search_content', { cql: `space = "${space.key || spaceKey}" and type = page`, limit: 5 }],
        ],
        tools,
      )),
    );

    if (attachmentId) {
      const id = attachmentId;
      await step(steps, 'read attachment', 'confluence_get_attachment', async () => {
        await call('confluence_get_attachment', { id });
      });
    } else {
      steps.push(
        await probeTool(call, tools, 'read attachment', 'confluence_get_attachment', { id: `att${syntheticId()}` }),
      );
    }
    // Never aim this at a real attachment.
    steps.push(
      await probeTool(call, tools, 'delete attachment', 'confluence_delete_attachment', { id: `att${syntheticId()}` }),
    );
    steps.push(
      await probeTool(call, tools, 'list pages for label', 'confluence_list_pages_for_label', {
        label_id: syntheticId(),
        limit: 5,
      }),
      await probeTool(call, tools, 'list blog posts for label', 'confluence_list_blog_posts_for_label', {
        label_id: syntheticId(),
        limit: 5,
      }),
    );

    await runPageLifecycle(context, steps, space);
    await runBlogPostLifecycle(context, steps, space);
    return steps;
  },
};
