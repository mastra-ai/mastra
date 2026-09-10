/**
 * GitLab rule ingress over real storage (libsql `:memory:`).
 *
 * Mocking the commit path would prove only that handlers return shapes. What
 * matters is what a delivery does to the board: the card that appears, the
 * stage it lands in, the redelivery that replays instead of duplicating, and
 * the org a shared GitLab project's delivery is attributed to.
 */
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry, defineBoard } from '../../boards/index.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import { IntakeStorage } from '../../storage/domains/intake/base.js';
import { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import { WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import { defaultGitlabRules, resolveGitlabRules } from './default-rules.js';
import { GitlabRules } from './rules.js';
import { parseGitlabWebhook } from './webhook.js';
import type { ParsedGitlabWebhook } from './webhook.js';

const ORG = 'org_acme';
const OTHER_ORG = 'org_other';

function issueDelivery(overrides: Record<string, unknown> = {}, projectId = 42) {
  return {
    object_kind: 'issue',
    user: { username: 'reporter' },
    project: { id: projectId, path_with_namespace: 'acme/widgets' },
    object_attributes: {
      iid: 7,
      title: 'Widget falls over',
      url: 'https://gitlab.com/acme/widgets/-/issues/7',
      state: 'opened',
      action: 'open',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      labels: [{ title: 'bug' }],
      assignees: [{ username: 'dev' }],
      ...overrides,
    },
  };
}

function noteDelivery(overrides: Record<string, unknown> = {}, user: { username: string } = { username: 'commenter' }) {
  return {
    object_kind: 'note',
    user,
    project: { id: 42, path_with_namespace: 'acme/widgets' },
    object_attributes: {
      id: 900,
      note: 'Still broken.',
      noteable_type: 'Issue',
      url: 'https://gitlab.com/acme/widgets/-/issues/7#note_900',
      created_at: '2026-01-03T00:00:00Z',
      ...overrides,
    },
    issue: { iid: 7, title: 'Widget falls over', url: 'https://gitlab.com/acme/widgets/-/issues/7', state: 'opened' },
  };
}

function mrDelivery(overrides: Record<string, unknown> = {}, projectId = 42) {
  return {
    object_kind: 'merge_request',
    user: { username: 'contributor' },
    project: { id: projectId, path_with_namespace: 'acme/widgets' },
    object_attributes: {
      iid: 12,
      title: 'Add the widget',
      url: 'https://gitlab.com/acme/widgets/-/merge_requests/12',
      state: 'opened',
      action: 'open',
      source_branch: 'feat/widget',
      target_branch: 'main',
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-02T00:00:00Z',
      ...overrides,
    },
  };
}

function mrNoteDelivery(
  overrides: Record<string, unknown> = {},
  user: { username: string } = { username: 'commenter' },
) {
  return {
    object_kind: 'note',
    user,
    project: { id: 42, path_with_namespace: 'acme/widgets' },
    object_attributes: {
      id: 950,
      note: 'One nit.',
      noteable_type: 'MergeRequest',
      url: 'https://gitlab.com/acme/widgets/-/merge_requests/12#note_950',
      created_at: '2026-02-03T00:00:00Z',
      ...overrides,
    },
    merge_request: {
      iid: 12,
      title: 'Add the widget',
      url: 'https://gitlab.com/acme/widgets/-/merge_requests/12',
      state: 'opened',
      source_branch: 'feat/widget',
      target_branch: 'main',
    },
  };
}

function parse(body: unknown): ParsedGitlabWebhook {
  const parsed = parseGitlabWebhook(body);
  if (!parsed) throw new Error('fixture is not a dispatchable delivery');
  return parsed;
}

/** A board whose initial phase is not `triage`, to prove binding routing. */
const triageless = defineBoard({
  id: 'support',
  title: 'Support',
  initialPhase: 'inbox',
  phases: {
    inbox: { title: 'Inbox', kind: 'resting', outcomes: { done: 'done' } },
    done: { title: 'Done', kind: 'terminal', outcomes: {} },
  },
});

async function harness(
  options: {
    gitlabRules?: ReturnType<typeof resolveGitlabRules>;
    connectedAs?: () => Promise<string | undefined>;
  } = {},
) {
  const backend = new LibSQLFactoryStorage({ id: `gitlab-rules-${Math.random()}`, url: ':memory:' });
  const workItems = backend.registerDomain(new WorkItemsStorage());
  const intake = backend.registerDomain(new IntakeStorage());
  const projects = backend.registerDomain(new FactoryProjectsStorage());
  await backend.init();

  const project = await projects.create({
    orgId: ORG,
    userId: 'user_1',
    input: { name: 'Widgets', repositoryId: null },
  });

  // The default boards come along because a merge request materializes onto
  // the built-in review board.
  const boards = createBoardRegistry({ boards: [triageless] });
  const configVersion = 'test-config';
  const rules = new GitlabRules({
    projects,
    intake,
    storage: workItems,
    configVersion,
    boards,
    gitlabRules: options.gitlabRules ?? resolveGitlabRules(),
    ...(options.connectedAs ? { connectedAs: options.connectedAs } : {}),
  });

  // Rules only enqueue decisions; the dispatcher materializes them. Driving it
  // is what makes these assertions about the board rather than about a queue.
  const dispatcher = new FactoryDecisionDispatcher({
    controller: {} as never,
    transitionService: new FactoryTransitionService({ storage: workItems, configVersion, boards }),
    storage: workItems,
    boards,
    isAutoRunEnabled: async () => false,
    ownerId: 'gitlab-rules-test',
  });

  const bind = async (sourceId: string, args: { orgId?: string; factoryProjectId?: string; board?: string | null }) =>
    intake.setBinding({
      orgId: args.orgId ?? ORG,
      integrationId: 'gitlab',
      sourceId,
      factoryProjectId: args.factoryProjectId ?? project.id,
      board: args.board ?? null,
    });

  /** Ingests a delivery and drains the decisions it produced. */
  const deliver = async (body: unknown) => {
    const status = await rules.ingest({ parsed: parse(body) });
    await dispatcher.runOnce(new Date());
    await dispatcher.runOnce(new Date());
    return status;
  };

  const cards = async (orgId = ORG, factoryProjectId = project.id) => workItems.list({ orgId, factoryProjectId });

  return { backend, workItems, intake, projects, project, rules, boards, bind, deliver, cards };
}

describe('resolving the delivery to a Factory project', () => {
  it('ignores a delivery for a GitLab project nothing is bound to', async () => {
    const h = await harness();
    // A self-hosted instance can hook every project it owns. Unbound ones must
    // not land on a board, and must not error either — GitLab retries non-2xx.
    await expect(h.deliver(issueDelivery())).resolves.toEqual({ status: 'ignored' });
    expect(await h.cards()).toHaveLength(0);
  });

  it('reports missing when the binding outlives its Factory project', async () => {
    const h = await harness();
    await h.bind('42', { factoryProjectId: '11111111-1111-4111-8111-111111111111' });
    await expect(h.deliver(issueDelivery())).resolves.toEqual({ status: 'missing' });
  });

  it('attributes the delivery to the org that bound the project, with no tenant in the payload', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(issueDelivery());

    expect(await h.cards()).toHaveLength(1);
    // Nothing leaks into an org that never bound this GitLab project.
    expect(await h.cards(OTHER_ORG)).toHaveLength(0);
  });

  it('fans one GitLab project out to every Factory project bound to it', async () => {
    const h = await harness();
    const second = await h.projects.create({
      orgId: OTHER_ORG,
      userId: 'user_2',
      input: { name: 'Mirror', repositoryId: null },
    });
    await h.bind('42', {});
    await h.bind('42', { orgId: OTHER_ORG, factoryProjectId: second.id });

    await expect(h.deliver(issueDelivery())).resolves.toEqual({ status: 'committed' });
    // A shared upstream project feeding two Factories must card in both, not
    // whichever binding the query happened to return first.
    expect(await h.cards()).toHaveLength(1);
    expect(await h.cards(OTHER_ORG, second.id)).toHaveLength(1);
  });

  it('still cards the healthy org when a sibling binding is broken', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.bind('42', { orgId: OTHER_ORG, factoryProjectId: '22222222-2222-4222-8222-222222222222' });

    await expect(h.deliver(issueDelivery())).resolves.toEqual({ status: 'committed' });
    expect(await h.cards()).toHaveLength(1);
  });

  it('does not confuse two GitLab projects that share an issue iid', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.bind('99', {});

    await h.deliver(issueDelivery());
    await h.deliver(issueDelivery({}, 99));

    // Both bind to the same Factory project; keyed by iid alone the second
    // delivery would refresh the first card instead of opening its own.
    const cards = await h.cards();
    expect(cards).toHaveLength(2);
    expect(cards.map(card => card.externalSource?.externalId).sort()).toEqual(['42!7', '99!7']);
  });
});

describe('materializing a card', () => {
  it('opens a triage card carrying the issue the skills will need', async () => {
    const h = await harness();
    await h.bind('42', {});
    await expect(h.deliver(issueDelivery())).resolves.toEqual({ status: 'committed' });

    const [card] = await h.cards();
    expect(card).toMatchObject({
      title: 'acme/widgets#7: Widget falls over',
      stages: ['triage'],
      externalSource: {
        integrationId: 'gitlab',
        type: 'issue',
        externalId: '42!7',
        url: 'https://gitlab.com/acme/widgets/-/issues/7',
      },
    });
    expect(card?.metadata).toMatchObject({
      gitlabProjectId: 42,
      gitlabProjectPath: 'acme/widgets',
      iid: 7,
      gitlabState: 'opened',
      labels: ['bug'],
      assignees: ['dev'],
      author: 'reporter',
    });
  });

  it('lands on the initial phase of a board the source is bound to', async () => {
    const h = await harness();
    await h.bind('42', { board: 'support' });
    await h.deliver(issueDelivery());

    const [card] = await h.cards();
    // Routed cards must not be hardcoded to Work's `triage`, which `support`
    // does not even define.
    expect(card?.stages).toEqual(['inbox']);
  });

  it('replays a redelivery instead of opening a second card', async () => {
    const h = await harness();
    await h.bind('42', {});
    await expect(h.deliver(issueDelivery())).resolves.toEqual({ status: 'committed' });
    // GitLab redelivers on its own retry schedule; at-least-once must not mean
    // two cards for one issue.
    await expect(h.deliver(issueDelivery())).resolves.toEqual({ status: 'replayed' });
    expect(await h.cards()).toHaveLength(1);
  });

  it('does not reopen a card for an issue that arrives already closed', async () => {
    const h = await harness();
    await h.bind('42', {});
    // Backfilling hooks on an old project replays historical closes; those must
    // not resurrect finished work.
    await h.deliver(issueDelivery({ action: 'close', state: 'closed' }));
    expect(await h.cards()).toHaveLength(0);
  });

  it('ignores a note for an issue that was never carded', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(noteDelivery());
    expect(await h.cards()).toHaveLength(0);
  });
});

describe('reconciling an existing card', () => {
  async function opened() {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(issueDelivery());
    return h;
  }

  it('re-triages an edited issue without moving the card out of its lane', async () => {
    const h = await opened();
    const [before] = await h.cards();
    await h.workItems.update({
      orgId: ORG,
      id: before!.id,
      userId: 'user_1',
      patch: { stages: ['execute'] },
      expectedRevision: before!.revision,
    });

    const status = await h.rules.ingest({
      parsed: parse(issueDelivery({ action: 'update', title: 'Widget explodes', updated_at: '2026-02-01T00:00:00Z' })),
    });
    expect(status).toEqual({ status: 'committed' });

    const pending = await h.workItems.listDeferredDecisions(ORG, h.project.id);
    expect(pending.at(-1)?.decision).toMatchObject({
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'factory-triage',
    });
    // An edit is not a transition: work in flight stays where it is.
    expect((await h.cards())[0]?.stages).toEqual(['execute']);
  });

  it('does not re-triage its own edit loop into a second card', async () => {
    const h = await opened();
    await h.deliver(issueDelivery({ action: 'update', updated_at: '2026-02-01T00:00:00Z' }));
    expect(await h.cards()).toHaveLength(1);
  });

  it('moves a closed issue to done', async () => {
    const h = await opened();
    await expect(h.deliver(issueDelivery({ action: 'close', state: 'closed' }))).resolves.toEqual({
      status: 'committed',
    });

    const [card] = await h.cards();
    expect(card?.stages[0]).toBe('done');
  });

  it('leaves a card that is already off the board alone', async () => {
    const h = await opened();
    await h.deliver(issueDelivery({ action: 'close', state: 'closed' }));
    const [closed] = await h.cards();

    await h.deliver(issueDelivery({ action: 'update', title: 'Reworded', updated_at: '2026-03-01T00:00:00Z' }));

    const [after] = await h.cards();
    // A terminal card is not resurrected by a late edit.
    expect(after?.stages[0]).toBe('done');
    expect(after?.title).toBe(closed?.title);
  });

  it('delivers a human note to the card as a message', async () => {
    const h = await opened();
    await expect(h.deliver(noteDelivery())).resolves.toEqual({ status: 'committed' });

    const pending = await h.workItems.listDeferredDecisions(ORG, h.project.id);
    expect(pending.at(-1)?.decision).toMatchObject({
      type: 'sendMessage',
      idleBehavior: 'persist',
    });
    expect(JSON.stringify(pending.at(-1)?.decision)).toContain('Still broken.');
  });

  it('does not answer its own note', async () => {
    // Factory posts handoff comments through the connected account. Without
    // this guard the delivery comes straight back as a message to the run that
    // wrote it, which is an infinite conversation with itself.
    const h = await harness({ connectedAs: async () => 'factory-bot' });
    await h.bind('42', {});
    await h.deliver(issueDelivery());
    const before = (await h.workItems.listDeferredDecisions(ORG, h.project.id)).length;

    await h.deliver(noteDelivery({}, { username: 'factory-bot' }));

    const after = await h.workItems.listDeferredDecisions(ORG, h.project.id);
    expect(after).toHaveLength(before);
  });

  it('still delivers a human note when Factory has a connected account', async () => {
    const h = await harness({ connectedAs: async () => 'factory-bot' });
    await h.bind('42', {});
    await h.deliver(issueDelivery());

    await expect(h.deliver(noteDelivery({}, { username: 'maintainer' }))).resolves.toEqual({ status: 'committed' });
    expect((await h.workItems.listDeferredDecisions(ORG, h.project.id)).at(-1)?.decision).toMatchObject({
      type: 'sendMessage',
    });
  });

  it('treats a note as external when the connected account cannot be resolved', async () => {
    // Fail open, matching GitHub: dropping every note on a lookup blip is
    // worse than one echo.
    const h = await harness({
      connectedAs: async () => {
        throw new Error('storage down');
      },
    });
    await h.bind('42', {});
    await h.deliver(issueDelivery());

    await expect(h.deliver(noteDelivery())).resolves.toEqual({ status: 'committed' });
  });
});

describe('rule failure containment', () => {
  it('records a rule that throws as a rejection rather than failing the delivery', async () => {
    const h = await harness({
      gitlabRules: resolveGitlabRules({
        issueOpened: () => {
          throw new Error('handler exploded');
        },
      }),
    });
    await h.bind('42', {});

    // The delivery is still committed as an audited rejection: a broken custom
    // rule must not make GitLab retry forever.
    await expect(h.deliver(issueDelivery())).resolves.toEqual({ status: 'committed' });
    expect(await h.cards()).toHaveLength(0);
  });

  it('times out a hanging rule instead of holding the request open', async () => {
    vi.useFakeTimers();
    try {
      const h = await harness({ gitlabRules: resolveGitlabRules({ issueOpened: () => new Promise(() => {}) }) });
      await h.bind('42', {});

      const pending = h.deliver(issueDelivery());
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(pending).resolves.toEqual({ status: 'committed' });
      expect(await h.cards()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('commits nothing when a handler is disabled', async () => {
    const h = await harness({ gitlabRules: resolveGitlabRules({ issueOpened: null }) });
    await h.bind('42', {});
    await h.deliver(issueDelivery());
    expect(await h.cards()).toHaveLength(0);
  });
});

describe('rule resolution', () => {
  const events = ['issueOpened', 'issueEdited', 'issueClosed', 'issueNoteCreated'] as const;

  it.each(events)('preserves the default for %s', event => {
    expect(resolveGitlabRules()[event]).toBe(defaultGitlabRules[event]);
    expect(resolveGitlabRules({ [event]: undefined })[event]).toBe(defaultGitlabRules[event]);
  });

  it.each(events)('replaces or disables only %s', event => {
    const handler = vi.fn();
    const siblings = events.filter(other => other !== event);
    const replaced = resolveGitlabRules({ [event]: handler });
    expect(replaced[event]).toBe(handler);
    for (const sibling of siblings) expect(replaced[sibling]).toBe(defaultGitlabRules[sibling]);

    const disabled = resolveGitlabRules({ [event]: null });
    expect(disabled[event]).toBeNull();
    for (const sibling of siblings) expect(disabled[sibling]).toBe(defaultGitlabRules[sibling]);
  });

  it('copies and freezes maps independently of caller mutation', () => {
    const original = vi.fn();
    const overrides = { issueOpened: original };
    const first = resolveGitlabRules(overrides);
    overrides.issueOpened = vi.fn();
    expect(first.issueOpened).toBe(original);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Reflect.set(first, 'issueClosed', null)).toBe(false);
    expect(resolveGitlabRules().issueOpened).toBe(defaultGitlabRules.issueOpened);
  });

  it('accepts null-prototype rule maps', () => {
    const resolved = resolveGitlabRules(Object.assign(Object.create(null), { issueOpened: null }));
    expect(resolved.issueOpened).toBeNull();
    expect(resolved.issueClosed).toBe(defaultGitlabRules.issueClosed);
  });

  it.each([new Map([['issueOpened', null]]), new Date(0), new Set(['issueOpened'])])(
    'rejects non-plain rule maps %j',
    overrides => {
      // @ts-expect-error Exercise invalid runtime configuration.
      expect(() => resolveGitlabRules(overrides)).toThrow(/plain object/);
    },
  );

  it.each([null, [], 'rules', { unknown: null }, { issueOpened: false }, { issueClosed: {} }])(
    'rejects invalid configuration %j',
    overrides => {
      // @ts-expect-error Exercise invalid configuration from JavaScript callers.
      expect(() => resolveGitlabRules(overrides)).toThrow();
    },
  );

  it('rejects a GitHub event name to catch a copy-pasted rule map', () => {
    expect(() => resolveGitlabRules({ pullRequestOpened: vi.fn() } as never)).toThrow(/Unknown GitLab rule event/);
  });
});

describe('merge requests on the review board', () => {
  it('materializes a review card from a new merge request', async () => {
    const h = await harness();
    await h.bind('42', {});
    await expect(h.deliver(mrDelivery())).resolves.toEqual({ status: 'committed' });

    const [card] = await h.cards();
    expect(card).toMatchObject({
      title: 'acme/widgets!12: Add the widget',
      stages: ['intake'],
      externalSource: { integrationId: 'gitlab', type: 'merge-request', externalId: '42!12' },
    });
    // The review board reads the branches from metadata to build its checkout hint.
    expect(card?.metadata).toMatchObject({ iid: 12, headBranch: 'feat/widget', baseBranch: 'main', merged: false });
  });

  it('does not confuse a merge request with an issue that shares its iid', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(issueDelivery({ iid: 12 }));
    await h.deliver(mrDelivery({ iid: 12 }));

    const cards = await h.cards();
    expect(cards).toHaveLength(2);
    // Same `42!12` ref on both; only the type separates them. Collapsing them
    // would drive an issue card with merge-request events.
    expect(cards.map(card => card.externalSource?.type).sort()).toEqual(['issue', 'merge-request']);
  });

  it('holds a human-authored merge request in intake instead of auto-starting it', async () => {
    const h = await harness({ connectedAs: async () => 'factory-bot' });
    await h.bind('42', {});
    await h.deliver(mrDelivery());

    const [card] = await h.cards();
    // The payload carries no write-access signal, so anything but Factory's own
    // MR waits to be picked up rather than starting an autonomous session.
    expect(card?.metadata).toMatchObject({ autoStartCandidate: false, factoryAuthored: false });
  });

  it('marks a merge request Factory opened as its own', async () => {
    const h = await harness({ connectedAs: async () => 'factory-bot' });
    await h.bind('42', {});
    await h.deliver(mrDelivery({}, 42) && { ...mrDelivery(), user: { username: 'factory-bot' } });

    const [card] = await h.cards();
    expect(card?.metadata).toMatchObject({ autoStartCandidate: true, factoryAuthored: true });
  });

  it('moves the review card to done when the merge request merges', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(mrDelivery());
    await expect(h.deliver(mrDelivery({ action: 'merge', state: 'merged' }))).resolves.toEqual({
      status: 'committed',
    });

    const [card] = await h.cards();
    expect(card?.stages).toEqual(['done']);
  });

  it('cancels the review card when the merge request closes unmerged', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(mrDelivery());
    await h.deliver(mrDelivery({ action: 'close', state: 'closed' }));

    const [card] = await h.cards();
    // Abandoned work is canceled, not completed.
    expect(card?.stages).toEqual(['canceled']);
  });

  it('re-reviews a merged-then-updated card only when the head actually moved', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(mrDelivery());
    await h.deliver(mrDelivery({ action: 'merge', state: 'merged' }));
    expect((await h.cards())[0]?.stages).toEqual(['done']);

    // A retitle is not new code to review.
    await h.deliver(mrDelivery({ action: 'update', title: 'Add the widget, better' }));
    expect((await h.cards())[0]?.stages).toEqual(['done']);
  });

  it('pulls a finished card back into review when a push moves the head', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(mrDelivery());
    await h.deliver(mrDelivery({ action: 'merge', state: 'merged' }));

    await h.deliver(mrDelivery({ action: 'update', oldrev: 'abc123', updated_at: '2026-02-05T00:00:00Z' }));
    expect((await h.cards())[0]?.stages).toEqual(['review']);
  });

  it('supersedes the pass in flight when a push lands on a card still in Review', async () => {
    const h = await harness();
    await h.bind('42', {});
    // A card mid-pass, as if the review started on the previous head is running.
    await h.workItems.upsert({
      orgId: ORG,
      userId: 'user_1',
      factoryProjectId: h.project.id,
      input: {
        externalSource: {
          integrationId: 'gitlab',
          type: 'merge-request',
          externalId: '42!12',
          url: 'https://gitlab.com/acme/widgets/-/merge_requests/12',
        },
        title: 'acme/widgets!12: Add the widget',
        stages: ['review'],
        sessions: {},
        metadata: { iid: 12, headBranch: 'feat/widget', baseBranch: 'main', authorTrusted: true },
      },
    });

    // The push invalidates whatever the running pass is reading, so it has to
    // start over on the new head. Re-entering the stage is how that pass gets
    // cancelled; dropping the push would strand the review on stale code.
    await expect(
      h.deliver(mrDelivery({ action: 'update', oldrev: 'abc123', updated_at: '2026-02-04T00:00:00Z' })),
    ).resolves.toEqual({ status: 'committed' });

    expect((await h.cards())[0]?.stages).toEqual(['review']);
    const decisions = await h.workItems.listDeferredDecisions(ORG, h.project.id);
    const transitions = decisions.filter(entry => entry.decision.type === 'transition');
    // Without the re-entry flag a same-stage transition is inert and the
    // in-flight pass is never superseded.
    expect(transitions.at(-1)!.decision).toMatchObject({ board: 'review', stage: 'review', reenter: true });
    const invocations = decisions.filter(entry => entry.decision.type === 'invokeSkill');
    expect(invocations.at(-1)!.decision).toMatchObject({
      type: 'invokeSkill',
      skillName: 'factory-review',
      role: 'review',
      cancelInFlight: true,
    });
  });

  it('still re-enters Review from a done card on a push, without superseding anything', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(mrDelivery());
    await h.deliver(mrDelivery({ action: 'merge', state: 'merged' }));
    expect((await h.cards())[0]?.stages).toEqual(['done']);

    await h.deliver(mrDelivery({ action: 'update', oldrev: 'abc123', updated_at: '2026-02-05T00:00:00Z' }));
    expect((await h.cards())[0]?.stages).toEqual(['review']);

    const decisions = await h.workItems.listDeferredDecisions(ORG, h.project.id);
    const transitions = decisions.filter(entry => entry.decision.type === 'transition');
    // From `done` the transition is a real stage move, so the re-entry flag is
    // unnecessary; the review entry rule dispatches a re-review of the new head.
    expect(transitions.at(-1)!.decision).toMatchObject({ board: 'review', stage: 'review' });
    expect(transitions.at(-1)!.decision).not.toHaveProperty('reenter');
    const invocations = decisions.filter(entry => entry.decision.type === 'invokeSkill');
    expect(invocations.at(-1)!.decision).toMatchObject({
      type: 'invokeSkill',
      skillName: 'factory-rereview',
      role: 'review',
    });
    expect(invocations.at(-1)!.decision).not.toHaveProperty('cancelInFlight');
  });

  it('leaves a merged card alone on a redelivery of the same merge', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(mrDelivery());
    await h.deliver(mrDelivery({ action: 'merge', state: 'merged' }));
    await expect(h.deliver(mrDelivery({ action: 'merge', state: 'merged' }))).resolves.toEqual({
      status: 'replayed',
    });

    expect((await h.cards())[0]?.stages).toEqual(['done']);
  });

  it('does not resurrect a canceled card with a later note', async () => {
    const h = await harness();
    await h.bind('42', {});
    await h.deliver(mrDelivery());
    await h.deliver(mrDelivery({ action: 'close', state: 'closed' }));
    await h.deliver(mrNoteDelivery());

    expect((await h.cards())[0]?.stages).toEqual(['canceled']);
  });

  it('ignores a merge request note Factory wrote itself', async () => {
    const h = await harness({ connectedAs: async () => 'factory-bot' });
    await h.bind('42', {});
    await h.deliver(mrDelivery());

    const before = await h.workItems.listDeferredDecisions({ orgId: ORG, limit: 50 });
    await h.deliver(mrNoteDelivery({}, { username: 'factory-bot' }));
    const after = await h.workItems.listDeferredDecisions({ orgId: ORG, limit: 50 });
    // Factory's own review note coming back would have it answering itself.
    expect(after.length).toBe(before.length);
  });

  it('ignores a merge request for a project nothing is bound to', async () => {
    const h = await harness();
    await expect(h.deliver(mrDelivery())).resolves.toEqual({ status: 'ignored' });
    expect(await h.cards()).toHaveLength(0);
  });
});
