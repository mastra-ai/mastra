import type { Scenario, ScenarioContext, ScenarioStep } from '../scenario.js';
import { errorMessage, makeStep, probeTool, refusedByPlatform, requireTools, runReadBatch } from '../scenario.js';

/**
 * Figma scenario: reads the connected user, then works in one test file the
 * tester owns. It reads the file's nodes, versions, comments, published
 * library, and dev resources; renders a frame; posts a comment, reacts to it,
 * replies, and deletes all three; attaches a dev resource link to a frame,
 * renames it, and deletes it; and creates and deletes a variable collection.
 *
 * Figma's REST API cannot create files or publish libraries, so the file is
 * `MASTRA_SMOKE_FIGMA_FILE_KEY` and the scenario skips its file tools when it
 * is unset. Team library listings need `MASTRA_SMOKE_FIGMA_TEAM_ID`, and run
 * without a file. When the file and team publish no components, component
 * sets, or styles, reading one by key probes a made-up key.
 *
 * Variables need a Figma Enterprise organization; elsewhere Figma answers 403
 * "Limited by Figma plan" (or "Incorrect account type" for a seat that can't
 * use them), which the variable reads accept as the endpoint being reached,
 * and the write deletes a made-up collection instead of creating one. Any
 * other 403, such as a missing scope or an expired token, fails.
 *
 * Everything the run creates is named or tagged `mastra-smoke-<runId>`. Writes
 * are sent once, so when a create fails the scenario looks for a record with
 * its tag and deletes it, in case Figma kept it. Comments are visible to the
 * file's collaborators, so use a test file.
 */

const FIGMA_TOOLS = [
  'figma_create_comment',
  'figma_create_comment_reaction',
  'figma_create_dev_resources',
  'figma_delete_comment',
  'figma_delete_comment_reaction',
  'figma_delete_dev_resource',
  'figma_get_comment',
  'figma_get_component',
  'figma_get_component_set',
  'figma_get_current_user',
  'figma_get_file_component_sets',
  'figma_get_file_components',
  'figma_get_file_node',
  'figma_get_file_styles',
  'figma_get_local_variables',
  'figma_get_published_variables',
  'figma_get_style',
  'figma_get_version',
  'figma_list_comment_reactions',
  'figma_list_comments',
  'figma_list_component_sets',
  'figma_list_components',
  'figma_list_dev_resources',
  'figma_list_file_nodes',
  'figma_list_styles',
  'figma_list_versions',
  'figma_render_images',
  'figma_update_dev_resources',
  'figma_update_variables',
] as const;

/** Figma's 403 for variables outside an Enterprise organization or on a seat that can't use them. */
const ENTERPRISE_ONLY = /Limited by Figma plan|Incorrect account type/i;
/** A made-up library key Figma does not know. */
const MISSING_KEY = /status=(400|404)|not found/i;

type Call = ScenarioContext['call'];
type Log = ScenarioContext['log'];

interface TreeNode {
  id?: string;
  type?: string;
  children?: TreeNode[];
}

async function attempt(
  steps: ScenarioStep[],
  name: string,
  toolId: string,
  run: () => Promise<string | undefined | void>,
): Promise<boolean> {
  try {
    const detail = await run();
    steps.push(makeStep(name, toolId, 'pass', detail || undefined));
    return true;
  } catch (error) {
    steps.push(makeStep(name, toolId, 'fail', errorMessage(error)));
    return false;
  }
}

/** Deletes a record the run created; a failed delete is a leak, logged with its id. */
async function cleanup(
  steps: ScenarioStep[],
  log: Log,
  runId: string,
  name: string,
  toolId: string,
  what: string,
  remove: () => Promise<unknown>,
): Promise<void> {
  try {
    await remove();
    steps.push(makeStep(name, toolId, 'pass'));
  } catch (error) {
    log.error(`Figma smoke run ${runId} left ${what}; delete it by hand.`, errorMessage(error));
    steps.push(makeStep(name, toolId, 'fail', `${what} leaked: ${errorMessage(error)}`));
  }
}

/**
 * After a create failed, finds any record Figma kept anyway by its run tag and
 * deletes it. The create is never repeated. A failed lookup is a possible leak.
 */
async function reconcile(
  steps: ScenarioStep[],
  log: Log,
  runId: string,
  name: string,
  toolId: string,
  what: string,
  find: () => Promise<string[]>,
  remove: (id: string) => Promise<unknown>,
): Promise<void> {
  let ids: string[];
  try {
    ids = await find();
  } catch (error) {
    log.error(
      `Figma smoke run ${runId} may have left a ${what} tagged mastra-smoke-${runId}; check by hand.`,
      errorMessage(error),
    );
    steps.push(makeStep(name, toolId, 'fail', `could not check for a kept ${what}: ${errorMessage(error)}`));
    return;
  }
  for (const id of ids) {
    await cleanup(steps, log, runId, name, toolId, `${what} ${id}`, () => remove(id));
  }
}

/** Accepts the Enterprise-only 403 as the endpoint being reached, but not a Platform refusal. */
async function enterpriseStep(steps: ScenarioStep[], name: string, toolId: string, run: () => Promise<unknown>) {
  try {
    await run();
    steps.push(makeStep(name, toolId, 'pass'));
    return true;
  } catch (error) {
    const message = errorMessage(error);
    const gated = /status=403/.test(message) && ENTERPRISE_ONLY.test(message) && !refusedByPlatform(message);
    steps.push(
      makeStep(
        name,
        toolId,
        gated ? 'pass' : 'fail',
        gated ? `Enterprise only (403): ${message.slice(0, 120)}` : message,
      ),
    );
    return false;
  }
}

async function runFileReads(call: Call, tools: ScenarioContext['tools'], fileKey: string, steps: ScenarioStep[]) {
  steps.push(
    ...(await runReadBatch(
      call,
      [
        ['figma_list_comments', { file_key: fileKey }],
        ['figma_get_file_node', { file_key: fileKey, node_id: '0:0' }],
        ['figma_list_dev_resources', { file_key: fileKey }],
      ],
      tools,
    )),
  );

  let frameId: string | undefined;
  let pageId: string | undefined;
  await attempt(steps, 'list file nodes', 'figma_list_file_nodes', async () => {
    const result = await call<{ nodes?: Record<string, { document?: TreeNode } | null> }>('figma_list_file_nodes', {
      file_key: fileKey,
      ids: ['0:0'],
      depth: 2,
    });
    const page = result.nodes?.['0:0']?.document?.children?.[0];
    pageId = page?.id;
    frameId = page?.children?.find(child => child.id)?.id;
    return frameId ? `frame ${frameId}` : `page ${pageId ?? 'none'}`;
  });

  const target = frameId ?? pageId;
  if (target) {
    await attempt(steps, 'render node', 'figma_render_images', async () => {
      // A Figma URL writes the id with a dash; the tool accepts that form too.
      await call('figma_render_images', { file_key: fileKey, node_ids: [target.replace(':', '-')], scale: 0.25 });
    });
  } else {
    steps.push(makeStep('render node', 'figma_render_images', 'fail', 'file has no page to render'));
  }

  let versionId: string | undefined;
  await attempt(steps, 'list versions', 'figma_list_versions', async () => {
    const result = await call<{ versions: Array<{ id: string }> }>('figma_list_versions', {
      file_key: fileKey,
      page_size: 5,
    });
    versionId = result.versions[0]?.id;
    if (!versionId) throw new Error('file has no versions');
  });
  if (versionId) {
    const id = versionId;
    await attempt(steps, 'read a version', 'figma_get_version', async () => {
      await call('figma_get_version', { file_key: fileKey, version_id: id });
      return id;
    });
  } else {
    steps.push(makeStep('read a version', 'figma_get_version', 'fail', 'no version to read'));
  }

  return target;
}

interface LibraryKeys {
  component?: string;
  componentSet?: string;
  style?: string;
}

async function runFileLibrary(call: Call, fileKey: string, keys: LibraryKeys, steps: ScenarioStep[]) {
  await attempt(steps, 'file components', 'figma_get_file_components', async () => {
    const result = await call<{ components: Array<{ key: string }> }>('figma_get_file_components', {
      file_key: fileKey,
    });
    keys.component ??= result.components[0]?.key;
  });
  await attempt(steps, 'file component sets', 'figma_get_file_component_sets', async () => {
    const result = await call<{ meta: { component_sets: Array<{ key: string }> } }>('figma_get_file_component_sets', {
      file_key: fileKey,
    });
    keys.componentSet ??= result.meta.component_sets[0]?.key;
  });
  await attempt(steps, 'file styles', 'figma_get_file_styles', async () => {
    const result = await call<{ meta: { styles: Array<{ key: string }> } }>('figma_get_file_styles', {
      file_key: fileKey,
    });
    keys.style ??= result.meta.styles[0]?.key;
  });
}

/** Team listings take only a team id, so they run with or without a test file. */
async function runTeamLibrary(call: Call, teamId: string | undefined, keys: LibraryKeys, steps: ScenarioStep[]) {
  if (teamId) {
    await attempt(steps, 'team components', 'figma_list_components', async () => {
      const result = await call<{ components: Array<{ key: string }> }>('figma_list_components', {
        team_id: teamId,
        page_size: 5,
      });
      keys.component ??= result.components[0]?.key;
    });
    await attempt(steps, 'team component sets', 'figma_list_component_sets', async () => {
      const result = await call<{ component_sets: Array<{ key: string }> }>('figma_list_component_sets', {
        team_id: teamId,
        page_size: 5,
      });
      keys.componentSet ??= result.component_sets[0]?.key;
    });
    await attempt(steps, 'team styles', 'figma_list_styles', async () => {
      const result = await call<{ styles: Array<{ key: string }> }>('figma_list_styles', {
        team_id: teamId,
        page_size: 5,
      });
      keys.style ??= result.styles[0]?.key;
    });
  } else {
    for (const toolId of ['figma_list_components', 'figma_list_component_sets', 'figma_list_styles']) {
      steps.push(makeStep(toolId.slice('figma_'.length), toolId, 'skip', 'MASTRA_SMOKE_FIGMA_TEAM_ID is unset'));
    }
  }
}

async function runByKey(call: Call, tools: ScenarioContext['tools'], keys: LibraryKeys, steps: ScenarioStep[]) {
  const byKey: Array<[string, string, string | undefined]> = [
    ['component by key', 'figma_get_component', keys.component],
    ['component set by key', 'figma_get_component_set', keys.componentSet],
    ['style by key', 'figma_get_style', keys.style],
  ];
  for (const [name, toolId, key] of byKey) {
    if (key) {
      await attempt(steps, name, toolId, async () => {
        await call(toolId, { key });
        return key;
      });
    } else {
      steps.push(
        await probeTool(call, tools, `${name} (made-up key)`, toolId, { key: 'mastrasmokenotakey' }, MISSING_KEY),
      );
    }
  }
}

async function runCommentLifecycle(call: Call, log: Log, runId: string, fileKey: string, steps: ScenarioStep[]) {
  const tag = `mastra-smoke-${runId}`;
  const findComments = (message: string) => async () => {
    const result = await call<{ items: Array<{ id: string; message: string }> }>('figma_list_comments', {
      file_key: fileKey,
    });
    return result.items.filter(item => item.message === message).map(item => item.id);
  };
  const deleteComment = (commentId: string) =>
    call('figma_delete_comment', { file_key: fileKey, comment_id: commentId });
  let commentId: string | undefined;
  await attempt(steps, 'create comment', 'figma_create_comment', async () => {
    commentId = (await call<{ id: string }>('figma_create_comment', { file_key: fileKey, message: tag })).id;
    return commentId;
  });
  if (!commentId) {
    await reconcile(
      steps,
      log,
      runId,
      'delete kept comment',
      'figma_delete_comment',
      'comment',
      findComments(tag),
      deleteComment,
    );
    return;
  }
  const id = commentId;
  try {
    await attempt(steps, 'read comment', 'figma_get_comment', async () => {
      await call('figma_get_comment', { file_key: fileKey, comment_id: id });
    });

    const emoji = ':eyes:';
    const reacted = await attempt(steps, 'react', 'figma_create_comment_reaction', async () => {
      await call('figma_create_comment_reaction', { file_key: fileKey, comment_id: id, emoji });
    });
    await attempt(steps, 'list reactions', 'figma_list_comment_reactions', async () => {
      const result = await call<{ reactions: Array<{ emoji: string }> }>('figma_list_comment_reactions', {
        file_key: fileKey,
        comment_id: id,
      });
      if (reacted && !result.reactions.some(reaction => reaction.emoji === emoji)) {
        throw new Error(`reaction ${emoji} missing from the list`);
      }
    });
    if (reacted) {
      await cleanup(
        steps,
        log,
        runId,
        'remove reaction',
        'figma_delete_comment_reaction',
        `reaction on comment ${id}`,
        () => call('figma_delete_comment_reaction', { file_key: fileKey, comment_id: id, emoji }),
      );
    }

    let replyId: string | undefined;
    await attempt(steps, 'reply', 'figma_create_comment', async () => {
      replyId = (
        await call<{ id: string }>('figma_create_comment', {
          file_key: fileKey,
          comment_id: id,
          message: `${tag} reply`,
        })
      ).id;
    });
    if (replyId) {
      const reply = replyId;
      await cleanup(steps, log, runId, 'delete reply', 'figma_delete_comment', `reply ${reply}`, () =>
        deleteComment(reply),
      );
    } else {
      await reconcile(
        steps,
        log,
        runId,
        'delete kept reply',
        'figma_delete_comment',
        'reply',
        findComments(`${tag} reply`),
        deleteComment,
      );
    }
  } finally {
    await cleanup(steps, log, runId, 'delete comment', 'figma_delete_comment', `comment ${id}`, () =>
      deleteComment(id),
    );
  }
}

async function runDevResourceLifecycle(
  call: Call,
  log: Log,
  runId: string,
  fileKey: string,
  nodeId: string,
  steps: ScenarioStep[],
) {
  let resourceId: string | undefined;
  await attempt(steps, 'attach dev resource', 'figma_create_dev_resources', async () => {
    const result = await call<{ links_created: Array<{ id: string }>; errors?: Array<{ error: string }> }>(
      'figma_create_dev_resources',
      {
        dev_resources: [
          {
            name: `mastra-smoke-${runId}`,
            url: `https://example.com/mastra-smoke-${runId}`,
            file_key: fileKey,
            node_id: nodeId,
          },
        ],
      },
    );
    resourceId = result.links_created[0]?.id;
    if (!resourceId)
      throw new Error(`no link created: ${result.errors?.map(error => error.error).join('; ') ?? 'no error'}`);
    return resourceId;
  });
  if (!resourceId) {
    await reconcile(
      steps,
      log,
      runId,
      'delete kept dev resource',
      'figma_delete_dev_resource',
      'dev resource',
      async () => {
        const result = await call<{ dev_resources: Array<{ id: string; name: string }> }>('figma_list_dev_resources', {
          file_key: fileKey,
          node_ids: [nodeId],
        });
        return result.dev_resources
          .filter(resource => resource.name === `mastra-smoke-${runId}`)
          .map(resource => resource.id);
      },
      resource => call('figma_delete_dev_resource', { file_key: fileKey, dev_resource_id: resource }),
    );
    return;
  }
  const id = resourceId;
  try {
    await attempt(steps, 'list node dev resources', 'figma_list_dev_resources', async () => {
      const result = await call<{ dev_resources: Array<{ id: string }> }>('figma_list_dev_resources', {
        file_key: fileKey,
        node_ids: [nodeId],
      });
      if (!result.dev_resources.some(resource => resource.id === id)) throw new Error(`dev resource ${id} not listed`);
    });
    await attempt(steps, 'rename dev resource', 'figma_update_dev_resources', async () => {
      const result = await call<{ links_updated: string[]; errors?: Array<{ error: string }> }>(
        'figma_update_dev_resources',
        { dev_resources: [{ id, name: `mastra-smoke-${runId} renamed` }] },
      );
      if (!result.links_updated.includes(id)) {
        throw new Error(`not updated: ${result.errors?.map(error => error.error).join('; ') ?? 'no error'}`);
      }
    });
  } finally {
    await cleanup(steps, log, runId, 'delete dev resource', 'figma_delete_dev_resource', `dev resource ${id}`, () =>
      call('figma_delete_dev_resource', { file_key: fileKey, dev_resource_id: id }),
    );
  }
}

async function runVariables(
  call: Call,
  tools: ScenarioContext['tools'],
  log: Log,
  runId: string,
  fileKey: string,
  steps: ScenarioStep[],
) {
  const enterprise = await enterpriseStep(steps, 'local variables', 'figma_get_local_variables', () =>
    call('figma_get_local_variables', { file_key: fileKey }),
  );
  await enterpriseStep(steps, 'published variables', 'figma_get_published_variables', () =>
    call('figma_get_published_variables', { file_key: fileKey }),
  );
  if (!enterprise) {
    // Deleting a made-up collection writes nothing, whatever the plan.
    steps.push(
      await probeTool(
        call,
        tools,
        'update variables (made-up collection)',
        'figma_update_variables',
        { file_key: fileKey, variableCollections: [{ action: 'DELETE', id: 'VariableCollectionId:0:0' }] },
        /status=(400|403|404)/,
      ),
    );
    return;
  }

  let collectionId: string | undefined;
  await attempt(steps, 'create variable collection', 'figma_update_variables', async () => {
    const result = await call<{ meta?: { tempIdToRealId?: Record<string, string> } }>('figma_update_variables', {
      file_key: fileKey,
      variableCollections: [{ action: 'CREATE', id: 'smoke_collection', name: `mastra-smoke-${runId}` }],
    });
    collectionId = result.meta?.tempIdToRealId?.['smoke_collection'];
    if (!collectionId) throw new Error('Figma returned no id for the new collection');
    return collectionId;
  });
  const deleteCollection = (id: string) =>
    call('figma_update_variables', { file_key: fileKey, variableCollections: [{ action: 'DELETE', id }] });
  if (collectionId) {
    const id = collectionId;
    await cleanup(
      steps,
      log,
      runId,
      'delete variable collection',
      'figma_update_variables',
      `variable collection ${id}`,
      () => deleteCollection(id),
    );
  } else {
    await reconcile(
      steps,
      log,
      runId,
      'delete kept variable collection',
      'figma_update_variables',
      'variable collection',
      async () => {
        const result = await call<{ meta: { variableCollections: Record<string, { id: string; name: string }> } }>(
          'figma_get_local_variables',
          { file_key: fileKey },
        );
        return Object.values(result.meta.variableCollections)
          .filter(collection => collection.name === `mastra-smoke-${runId}`)
          .map(collection => collection.id);
      },
      deleteCollection,
    );
  }
}

export const figmaScenario: Scenario = {
  integrationId: 'figma',
  summary: 'current user + file reads → comment/reaction/reply → dev resource → variables → library',
  async run({ tools, call, runId, log }): Promise<ScenarioStep[]> {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, FIGMA_TOOLS);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    await attempt(steps, 'current user', 'figma_get_current_user', async () => {
      const me = await call<{ handle: string }>('figma_get_current_user', {});
      return me.handle;
    });

    const fileKey = process.env.MASTRA_SMOKE_FIGMA_FILE_KEY?.trim();
    const teamId = process.env.MASTRA_SMOKE_FIGMA_TEAM_ID?.trim() || undefined;
    const keys: LibraryKeys = {};
    if (fileKey) await runFileLibrary(call, fileKey, keys, steps);
    await runTeamLibrary(call, teamId, keys, steps);
    await runByKey(call, tools, keys, steps);

    if (!fileKey) {
      steps.push(
        makeStep(
          'file tools',
          undefined,
          'skip',
          "MASTRA_SMOKE_FIGMA_FILE_KEY is unset; Figma's API cannot create files",
        ),
      );
      return steps;
    }

    const nodeId = await runFileReads(call, tools, fileKey, steps);
    await runCommentLifecycle(call, log, runId, fileKey, steps);
    if (nodeId) {
      await runDevResourceLifecycle(call, log, runId, fileKey, nodeId, steps);
    } else {
      steps.push(
        makeStep('attach dev resource', 'figma_create_dev_resources', 'fail', 'file has no node to attach to'),
      );
    }
    await runVariables(call, tools, log, runId, fileKey, steps);
    return steps;
  },
};
