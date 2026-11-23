import { randomInt } from 'node:crypto';

import type { Scenario, ScenarioContext, ScenarioStep } from '../scenario.js';
import { errorMessage, makeStep, probeTool, refusedByPlatform, requireTools, runReadBatch } from '../scenario.js';

/**
 * Zendesk scenario: reads the account's groups, fields, forms, views, macros,
 * and permission groups, then creates an organization, an end user in it, and
 * a ticket the user requested; updates and reads each one back; and deletes
 * them. It also builds a Help Center category with a section and a draft
 * article, edits and archives the article, and deletes the section and
 * category.
 *
 * A new ticket fires the account's triggers, which by default email every
 * agent, so the scenario only creates a real ticket when
 * `MASTRA_SMOKE_ZENDESK_ALLOW_TICKETS=1` says the account's ticket
 * notifications are off (a sandbox with the notify triggers deactivated).
 * Unset, ticket creation is refused by Zendesk on purpose (blank subject and
 * comment) and the other ticket tools are probed with made-up ids. Nothing
 * else notifies anyone real: the user's email is on example.com, the ticket
 * update adds an internal note, the article stays a draft, and subscribers
 * are not emailed.
 *
 * Zendesk's API archives articles rather than deleting them, so each run
 * leaves its archived draft in the Help Center archive; the run logs its id
 * so it can be deleted there, and records the missing delete as a skip.
 *
 * The Help Center locale is `MASTRA_SMOKE_ZENDESK_LOCALE` when set, otherwise
 * `en-us`; it must be one of the Help Center's enabled locales. When Help
 * Center is off, creating the category fails and the article tools are probed
 * with made-up ids instead.
 *
 * Ticket forms need a Zendesk plan that has them; without one, reading a form
 * probes a made-up id.
 */

const ZENDESK_TOOLS = [
  'zendesk_archive_article',
  'zendesk_create_article',
  'zendesk_create_category',
  'zendesk_create_organization',
  'zendesk_create_section',
  'zendesk_create_ticket',
  'zendesk_create_user',
  'zendesk_delete_category',
  'zendesk_delete_organization',
  'zendesk_delete_section',
  'zendesk_delete_ticket',
  'zendesk_delete_user',
  'zendesk_get_article',
  'zendesk_get_group',
  'zendesk_get_organization',
  'zendesk_get_ticket',
  'zendesk_get_ticket_comments',
  'zendesk_get_ticket_field',
  'zendesk_get_ticket_form',
  'zendesk_get_user',
  'zendesk_list_articles',
  'zendesk_list_groups',
  'zendesk_list_macros',
  'zendesk_list_organizations',
  'zendesk_list_permission_groups',
  'zendesk_list_ticket_fields',
  'zendesk_list_ticket_forms',
  'zendesk_list_tickets',
  'zendesk_list_users',
  'zendesk_list_views',
  'zendesk_search_tickets',
  'zendesk_update_article',
  'zendesk_update_article_translation',
  'zendesk_update_organization',
  'zendesk_update_ticket',
  'zendesk_update_user',
] as const;

/** Large enough that a real Zendesk id won't match. */
function syntheticId(): number {
  return randomInt(9 * 10 ** 12, 10 ** 13);
}

async function step(
  steps: ScenarioStep[],
  name: string,
  toolId: string,
  run: () => Promise<string | void>,
): Promise<boolean> {
  try {
    const detail = await run();
    steps.push(makeStep(name, toolId, 'pass', detail ?? undefined));
    return true;
  } catch (error) {
    steps.push(makeStep(name, toolId, 'fail', errorMessage(error)));
    return false;
  }
}

async function runAccountReads({ call, tools }: ScenarioContext, steps: ScenarioStep[]): Promise<number | undefined> {
  steps.push(
    ...(await runReadBatch(
      call,
      [
        ['zendesk_list_views', {}],
        ['zendesk_list_macros', { per_page: 5 }],
        ['zendesk_list_users', {}],
        ['zendesk_list_organizations', {}],
        ['zendesk_list_tickets', { page_size: 5 }],
      ],
      tools,
    )),
  );

  let groupId: number | undefined;
  await step(steps, 'list groups', 'zendesk_list_groups', async () => {
    const listed = await call<{ items: Array<{ id: number }> }>('zendesk_list_groups', {});
    groupId = listed.items[0]?.id;
    return `${listed.items.length} groups`;
  });
  if (groupId !== undefined) {
    const id = groupId;
    await step(steps, 'read group', 'zendesk_get_group', async () => {
      const got = await call<{ id: number }>('zendesk_get_group', { group_id: id });
      if (got.id !== id) throw new Error(`read back group ${got.id}`);
    });
  } else {
    steps.push(await probeTool(call, tools, 'read group', 'zendesk_get_group', { group_id: syntheticId() }));
  }

  let fieldId: number | undefined;
  await step(steps, 'list ticket fields', 'zendesk_list_ticket_fields', async () => {
    const listed = await call<{ items: Array<{ id: number }> }>('zendesk_list_ticket_fields', {});
    fieldId = listed.items[0]?.id;
    return `${listed.items.length} fields`;
  });
  if (fieldId !== undefined) {
    const id = fieldId;
    await step(steps, 'read ticket field', 'zendesk_get_ticket_field', async () => {
      const got = await call<{ id: number }>('zendesk_get_ticket_field', { ticketFieldId: id });
      if (got.id !== id) throw new Error(`read back field ${got.id}`);
    });
  } else {
    steps.push(
      await probeTool(call, tools, 'read ticket field', 'zendesk_get_ticket_field', { ticketFieldId: syntheticId() }),
    );
  }

  let formId: number | undefined;
  await step(steps, 'list ticket forms', 'zendesk_list_ticket_forms', async () => {
    const listed = await call<{ items: Array<{ id: number }> }>('zendesk_list_ticket_forms', {});
    formId = listed.items[0]?.id;
    return `${listed.items.length} forms`;
  });
  if (formId !== undefined) {
    const id = formId;
    await step(steps, 'read ticket form', 'zendesk_get_ticket_form', async () => {
      const got = await call<{ id: number }>('zendesk_get_ticket_form', { ticket_form_id: id });
      if (got.id !== id) throw new Error(`read back form ${got.id}`);
    });
  } else {
    steps.push(
      await probeTool(call, tools, 'read ticket form', 'zendesk_get_ticket_form', { ticket_form_id: syntheticId() }),
    );
  }

  let permissionGroupId: number | undefined;
  await step(steps, 'list permission groups', 'zendesk_list_permission_groups', async () => {
    const listed = await call<{ permission_groups: Array<{ id: number }> }>('zendesk_list_permission_groups', {});
    permissionGroupId = listed.permission_groups[0]?.id;
    return `${listed.permission_groups.length} permission groups`;
  });
  return permissionGroupId;
}

async function runTicketLifecycle(
  { call, runId, log }: ScenarioContext,
  steps: ScenarioStep[],
  requesterEmail: string | undefined,
): Promise<void> {
  let ticketId: number | undefined;
  await step(steps, 'create ticket', 'zendesk_create_ticket', async () => {
    const created = await call<{ id: number }>('zendesk_create_ticket', {
      subject: `mastra-smoke-${runId} ticket`,
      comment: `Created by the Mastra Connect smoke test (${runId}).`,
      ...(requesterEmail !== undefined && { requester_email: requesterEmail }),
      priority: 'low',
      tags: ['mastra_smoke'],
    });
    ticketId = created.id;
    return String(ticketId);
  });
  if (ticketId === undefined) return;
  const id = ticketId;

  try {
    await step(steps, 'read ticket', 'zendesk_get_ticket', async () => {
      const got = await call<{ id: number; subject: string }>('zendesk_get_ticket', { ticket_id: id });
      if (!got.subject.includes(runId)) throw new Error(`subject is ${got.subject}`);
    });
    await step(steps, 'update ticket with internal note', 'zendesk_update_ticket', async () => {
      const updated = await call<{ id: number; status: string }>('zendesk_update_ticket', {
        ticket_id: id,
        status: 'pending',
        comment: { body: `Internal note from the smoke test (${runId}).`, public: false },
      });
      if (updated.status !== 'pending') throw new Error(`status is ${updated.status}`);
    });
    await step(steps, 'read ticket comments', 'zendesk_get_ticket_comments', async () => {
      const listed = await call<{ comments: Array<{ public?: boolean }> }>('zendesk_get_ticket_comments', {
        ticket_id: id,
      });
      if (listed.comments.length < 2) throw new Error(`expected 2 comments, got ${listed.comments.length}`);
      if (listed.comments.at(-1)?.public !== false) throw new Error('the note was not internal');
    });
    // Search indexes new tickets after a delay, so this only checks the query runs.
    await step(steps, 'search tickets', 'zendesk_search_tickets', async () => {
      const found = await call<{ count: number }>('zendesk_search_tickets', { query: `tags:mastra_smoke ${runId}` });
      return `${found.count} found`;
    });
  } finally {
    const deleted = await step(steps, 'delete ticket', 'zendesk_delete_ticket', async () => {
      await call('zendesk_delete_ticket', { ticket_id: id });
    });
    if (!deleted) log.error(`zendesk: leaked ticket ${id} (${runId}); delete it manually`);
  }
}

/**
 * Without a notification-free account, exercise the ticket tools without
 * creating a ticket: Zendesk refuses a ticket with a blank subject and
 * comment, and the rest address a made-up ticket.
 */
async function runTicketProbes(context: ScenarioContext, steps: ScenarioStep[]): Promise<void> {
  const { call, tools, runId, log } = context;
  if (!tools.zendesk_create_ticket) {
    steps.push(makeStep('refused ticket', 'zendesk_create_ticket', 'skip', 'tool not in project toolset'));
  } else {
    try {
      const created = await call<{ id: number }>('zendesk_create_ticket', { subject: '', comment: '' });
      steps.push(makeStep('refused ticket', 'zendesk_create_ticket', 'fail', `Zendesk created ticket ${created.id}`));
      const deleted = await step(steps, 'delete unexpected ticket', 'zendesk_delete_ticket', async () => {
        await call('zendesk_delete_ticket', { ticket_id: created.id });
      });
      if (!deleted) log.error(`zendesk: leaked ticket ${created.id} (${runId}); delete it manually`);
    } catch (error) {
      const msg = errorMessage(error);
      steps.push(
        /status=422/.test(msg) && !refusedByPlatform(msg)
          ? makeStep('refused ticket', 'zendesk_create_ticket', 'pass', `expected error: ${msg.slice(0, 120)}`)
          : makeStep('refused ticket', 'zendesk_create_ticket', 'fail', msg),
      );
    }
  }

  const ticket_id = syntheticId();
  steps.push(await probeTool(call, tools, 'read ticket', 'zendesk_get_ticket', { ticket_id }));
  steps.push(
    await probeTool(call, tools, 'update ticket', 'zendesk_update_ticket', {
      ticket_id,
      comment: { body: `Internal note from the smoke test (${runId}).`, public: false },
    }),
  );
  steps.push(await probeTool(call, tools, 'read ticket comments', 'zendesk_get_ticket_comments', { ticket_id }));
  steps.push(await probeTool(call, tools, 'delete ticket', 'zendesk_delete_ticket', { ticket_id }));
  await step(steps, 'search tickets', 'zendesk_search_tickets', async () => {
    const found = await call<{ count: number }>('zendesk_search_tickets', { query: 'tags:mastra_smoke' });
    return `${found.count} found`;
  });
}

async function runPeopleLifecycle(context: ScenarioContext, steps: ScenarioStep[]): Promise<void> {
  const { call, runId, log } = context;
  let organizationId: number | undefined;
  await step(steps, 'create organization', 'zendesk_create_organization', async () => {
    const created = await call<{ id: number }>('zendesk_create_organization', {
      name: `mastra-smoke-${runId}`,
      notes: 'Created by the Mastra Connect smoke test.',
      tags: ['mastra_smoke'],
    });
    organizationId = created.id;
    return String(organizationId);
  });

  try {
    if (organizationId !== undefined) {
      const id = organizationId;
      await step(steps, 'read organization', 'zendesk_get_organization', async () => {
        const got = await call<{ id: number; name: string }>('zendesk_get_organization', { organization_id: id });
        if (got.name !== `mastra-smoke-${runId}`) throw new Error(`name is ${got.name}`);
      });
      await step(steps, 'update organization', 'zendesk_update_organization', async () => {
        const updated = await call<{ notes?: string }>('zendesk_update_organization', {
          organizationId: id,
          notes: `Updated by ${runId}.`,
        });
        if (updated.notes !== `Updated by ${runId}.`) throw new Error(`notes are ${updated.notes}`);
      });
    }

    const email = `mastra-smoke-${runId}@example.com`;
    let userId: string | undefined;
    await step(steps, 'create user', 'zendesk_create_user', async () => {
      const created = await call<{ id: number }>('zendesk_create_user', {
        name: `mastra-smoke-${runId}`,
        email,
        role: 'end-user',
        verified: true,
      });
      userId = String(created.id);
      return userId;
    });

    try {
      if (userId !== undefined) {
        const id = userId;
        await step(steps, 'read user', 'zendesk_get_user', async () => {
          const got = await call<{ email?: string }>('zendesk_get_user', { userId: id });
          if (got.email !== email) throw new Error(`email is ${got.email}`);
        });
        await step(steps, 'move user into organization', 'zendesk_update_user', async () => {
          const updated = await call<{ organizationId?: number; notes?: string }>('zendesk_update_user', {
            userId: id,
            notes: `Updated by ${runId}.`,
            ...(organizationId !== undefined && { organizationId }),
          });
          if (organizationId !== undefined && updated.organizationId !== organizationId) {
            throw new Error(`organization is ${updated.organizationId}`);
          }
        });
      }
      if (process.env.MASTRA_SMOKE_ZENDESK_ALLOW_TICKETS === '1') {
        await runTicketLifecycle(context, steps, userId === undefined ? undefined : email);
      } else {
        log.warn('zendesk: MASTRA_SMOKE_ZENDESK_ALLOW_TICKETS is not 1, so ticket tools are probed, not run');
        await runTicketProbes(context, steps);
      }
    } finally {
      if (userId !== undefined) {
        const id = userId;
        const deleted = await step(steps, 'delete user', 'zendesk_delete_user', async () => {
          await call('zendesk_delete_user', { userId: id });
        });
        if (!deleted) log.error(`zendesk: leaked user ${id} (${runId}); delete it manually`);
      } else {
        steps.push(makeStep('delete user', 'zendesk_delete_user', 'fail', 'no user was created to delete'));
      }
    }
  } finally {
    if (organizationId !== undefined) {
      const id = organizationId;
      const deleted = await step(steps, 'delete organization', 'zendesk_delete_organization', async () => {
        await call('zendesk_delete_organization', { organization_id: id });
      });
      if (!deleted) log.error(`zendesk: leaked organization ${id} (${runId}); delete it manually`);
    } else {
      steps.push(makeStep('delete organization', 'zendesk_delete_organization', 'fail', 'none was created'));
    }
  }
}

/** Inputs for the Help Center tools when there is no category to work in. */
function helpCenterProbes(id: number, locale: string): Array<[string, string, Record<string, unknown>]> {
  return [
    ['create section', 'zendesk_create_section', { category_id: id, name: 'x', locale }],
    [
      'create article',
      'zendesk_create_article',
      { section_id: id, title: 'x', body: '', locale, permission_group_id: id, user_segment_id: null },
    ],
    ['read article', 'zendesk_get_article', { article_id: id }],
    ['update article', 'zendesk_update_article', { article_id: id, promoted: false }],
    ['update article translation', 'zendesk_update_article_translation', { article_id: id, locale, title: 'x' }],
    ['list section articles', 'zendesk_list_articles', { section_id: String(id) }],
    ['archive article', 'zendesk_archive_article', { article_id: id }],
    ['delete section', 'zendesk_delete_section', { section_id: id }],
    ['delete category', 'zendesk_delete_category', { category_id: id }],
  ];
}

async function runHelpCenterLifecycle(
  { call, runId, log, tools }: ScenarioContext,
  steps: ScenarioStep[],
  permissionGroupId: number | undefined,
): Promise<void> {
  const locale = process.env.MASTRA_SMOKE_ZENDESK_LOCALE?.trim() || 'en-us';

  let categoryId: number | undefined;
  await step(steps, 'create category', 'zendesk_create_category', async () => {
    const created = await call<{ id: number }>('zendesk_create_category', {
      name: `mastra-smoke-${runId}`,
      locale,
      description: 'Created by the Mastra Connect smoke test.',
    });
    categoryId = created.id;
    return String(categoryId);
  });
  if (categoryId === undefined) {
    for (const [name, toolId, input] of helpCenterProbes(syntheticId(), locale)) {
      steps.push(await probeTool(call, tools, name, toolId, input));
    }
    return;
  }
  const category = categoryId;

  try {
    let sectionId: number | undefined;
    await step(steps, 'create section', 'zendesk_create_section', async () => {
      const created = await call<{ id: number }>('zendesk_create_section', {
        category_id: category,
        name: `mastra-smoke-${runId}`,
        locale,
      });
      sectionId = created.id;
      return String(sectionId);
    });
    if (sectionId === undefined) return;
    const section = sectionId;

    try {
      let articleId: number | undefined;
      await step(steps, 'create draft article', 'zendesk_create_article', async () => {
        if (permissionGroupId === undefined) throw new Error('no permission group to create the article under');
        const created = await call<{ id: number; draft?: boolean }>('zendesk_create_article', {
          section_id: section,
          title: `mastra-smoke-${runId} article`,
          body: `<p>Created by the Mastra Connect smoke test (${runId}).</p>`,
          locale,
          permission_group_id: permissionGroupId,
          user_segment_id: null,
          draft: true,
        });
        if (created.draft !== true) throw new Error('the article was published');
        articleId = created.id;
        return String(articleId);
      });
      if (articleId === undefined) return;
      const article = articleId;

      try {
        await step(steps, 'read article', 'zendesk_get_article', async () => {
          const got = await call<{ id: number; section_id?: number }>('zendesk_get_article', { article_id: article });
          if (got.section_id !== section) throw new Error(`section is ${got.section_id}`);
        });
        await step(steps, 'label article', 'zendesk_update_article', async () => {
          const updated = await call<{ label_names?: string[] }>('zendesk_update_article', {
            article_id: article,
            label_names: ['mastra_smoke'],
          });
          if (!updated.label_names?.includes('mastra_smoke')) throw new Error(`labels are ${updated.label_names}`);
        });
        await step(steps, 'edit article text', 'zendesk_update_article_translation', async () => {
          const updated = await call<{ title: string; draft?: boolean }>('zendesk_update_article_translation', {
            article_id: article,
            locale,
            title: `mastra-smoke-${runId} article (edited)`,
            body: `<p>Edited by the Mastra Connect smoke test (${runId}).</p>`,
          });
          if (!updated.title.endsWith('(edited)')) throw new Error(`title is ${updated.title}`);
          if (updated.draft === false) throw new Error('editing published the article');
        });
        await step(steps, 'list section articles', 'zendesk_list_articles', async () => {
          const listed = await call<{ articles: Array<{ id: number }> }>('zendesk_list_articles', {
            section_id: String(section),
          });
          return `${listed.articles.length} articles`;
        });
      } finally {
        const archived = await step(steps, 'archive article', 'zendesk_archive_article', async () => {
          await call('zendesk_archive_article', { article_id: article });
        });
        if (archived) {
          // Zendesk's API archives articles but has no way to delete one.
          steps.push(
            makeStep(
              'delete article',
              'zendesk_archive_article',
              'skip',
              `the API cannot delete articles; article ${article} is in the Help Center archive`,
            ),
          );
          log.error(
            `zendesk: left article ${article} (${runId}) in the Help Center archive; the API cannot delete articles, so delete it in Guide > Arrange content > Archive`,
          );
        } else {
          log.error(`zendesk: leaked article ${article} (${runId}); delete it manually`);
        }
      }
    } finally {
      const deleted = await step(steps, 'delete section', 'zendesk_delete_section', async () => {
        await call('zendesk_delete_section', { section_id: section });
      });
      if (!deleted) log.error(`zendesk: leaked Help Center section ${section} (${runId}); delete it manually`);
    }
  } finally {
    const deleted = await step(steps, 'delete category', 'zendesk_delete_category', async () => {
      await call('zendesk_delete_category', { category_id: category });
    });
    if (!deleted) log.error(`zendesk: leaked Help Center category ${category} (${runId}); delete it manually`);
  }
}

export const zendeskScenario: Scenario = {
  integrationId: 'zendesk',
  summary:
    'read account config → organization, user, and ticket create/update/delete → Help Center category, section, and draft article lifecycle',
  async run(context) {
    const missing = requireTools(context.tools, ZENDESK_TOOLS);
    if (missing) return [makeStep('preflight', undefined, 'skip', missing)];

    const steps: ScenarioStep[] = [];
    const permissionGroupId = await runAccountReads(context, steps);
    await runPeopleLifecycle(context, steps);
    await runHelpCenterLifecycle(context, steps, permissionGroupId);
    return steps;
  },
};
