/**
 * Evidence for how a GitHub issue moves through the built-in Work board — Intake, Planning, plan
 * approval, Building — under the shipped defaults and under automation a project can configure
 * (`autoStart`/`autoStartWhen`, `exitTool.autoApprove`/`autoApproveWhen`). Each test runs a real
 * Factory on its own database and project, with the model stubbed at the wire, and records which
 * steps ran on their own and which waited for a person. Nothing here changes the shipped defaults.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { Mastra } from '@mastra/core/mastra';
import { LocalFilesystem, MastraSandbox } from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { MastraFactory } from '../factory.js';
import { GithubIntegration } from '../integrations/github/integration.js';
import { mountApiRoutes } from '../routes/test-utils.js';
import type { RuleGroup } from '../rules/rule-group.js';
import { repositoryDirectoryName } from '../sandbox/workdir.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import type { StoredBoardInput } from '../storage/domains/boards/base.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import { factoryProjectSettingsUserId } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_PLANS_DIR } from '../workspace.js';

const REPOSITORY = 'acme/auto-progression';
const PLAN_PATH = `${FACTORY_PLANS_DIR}/plan.md`;

/** A local sandbox over a temp directory, so the plan `submit_plan` names can be read back. */
class TestSandbox extends MastraSandbox {
  readonly id = randomUUID();
  readonly name = 'Auto progression sandbox';
  readonly provider = 'local';
  status: ProviderStatus = 'pending';
  readonly home: string;
  readonly filesystem: LocalFilesystem;

  constructor(home: string) {
    super({ name: 'Auto progression sandbox', workingDirectory: home });
    this.home = home;
    this.filesystem = new LocalFilesystem({ basePath: home });
  }

  async executeCommand(command: string) {
    return { exitCode: 0, stdout: command === 'pwd' ? `${this.home}\n` : '', stderr: '' };
  }
}

type ToolCall = { name: string; args: Record<string, unknown> };

function sse(events: { type: string }[]): Response {
  return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

/**
 * The model at the wire. It answers only what was just asked (the messages after its last turn):
 * started on the plan skill it submits a plan; started on the build skill it reports Building's
 * `done` outcome. It never moves the card itself. Anything else gets a text answer, ending the run.
 */
function stubModel() {
  vi.stubEnv('OPENAI_API_KEY', 'sk-auto-progression');
  const requests: string[] = [];
  let calls = 0;
  onTestFinished(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  const decide = (input: string): ToolCall | undefined => {
    const items = JSON.parse(input) as { type?: string; role?: string }[];
    const lastTurn = items.findLastIndex(item => item.type?.startsWith('function_call') || item.role === 'assistant');
    const asked = JSON.stringify(items.slice(lastTurn + 1));
    if (asked.includes('<skill name=\\"factory-plan\\">')) return { name: 'submit_plan', args: { path: PLAN_PATH } };
    if (asked.includes('<skill name=\\"factory-build\\">')) {
      // A card titled "Replan…" always finds its plan wrong.
      const outcome = asked.includes('Replan') ? 'replan' : 'done';
      return { name: 'factory_report_outcome', args: { outcome, reason: `Reporting ${outcome}.` } };
    }
    return undefined;
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.endsWith('/responses')) throw new Error(`Unexpected external request: ${url}`);
    const body = input instanceof Request ? await input.clone().text() : String(init?.body ?? '');
    requests.push(body);
    const call = decide(JSON.stringify(JSON.parse(body).input));
    if (call) {
      calls += 1;
      const tool = {
        id: `fc_${calls}`,
        type: 'function_call',
        call_id: `call_${calls}`,
        name: call.name,
        arguments: JSON.stringify(call.args),
      };
      return sse([
        { type: 'response.created', response: { id: `resp_${calls}`, created_at: 1, model: 'auto-test' } },
        { type: 'response.output_item.added', output_index: 0, item: { ...tool, arguments: '' } },
        { type: 'response.function_call_arguments.delta', item_id: tool.id, output_index: 0, delta: tool.arguments },
        { type: 'response.output_item.done', output_index: 0, item: { ...tool, status: 'completed' } },
        {
          type: 'response.completed',
          response: { id: `resp_${calls}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1 } },
        },
      ] as { type: string }[]);
    }
    const item = { id: 'msg_auto', type: 'message', role: 'assistant', content: [] };
    return sse([
      { type: 'response.created', response: { id: 'resp_auto', created_at: 1, model: 'auto-test' } },
      { type: 'response.output_item.added', output_index: 0, item },
      { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: 'Noted.' },
      { type: 'response.output_item.done', output_index: 0, item },
      {
        type: 'response.completed',
        response: {
          id: 'resp_auto',
          status: 'completed',
          incomplete_details: null,
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        },
      },
    ] as { type: string }[]);
  });
  return requests;
}

type StoredPhase = StoredBoardInput['phases'][number];
type Issue = { id: string; title: string; stages: string[]; revision: number };

/**
 * A real Factory on its own LibSQL database, with one new project whose runs can start: a model,
 * its credential and a linked GitHub repository. No project setting or intake route is set.
 */
async function isolatedProject() {
  const requests = stubModel();
  const orgId = `org-${randomUUID()}`;
  const dir = mkdtempSync(join(tmpdir(), 'factory-auto-progression-'));
  const sandboxHome = mkdtempSync(join(tmpdir(), 'factory-auto-progression-sandbox-'));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(sandboxHome, { recursive: true, force: true });
  });
  const storage = new LibSQLFactoryStorage({ id: `auto-${randomUUID()}`, url: `file:${join(dir, 'factory.db')}` });
  const github = new GithubIntegration({
    appId: '123',
    privateKey: 'test-key',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    slug: 'auto-progression-test',
  });
  const factory = new MastraFactory({
    storage,
    auth: null,
    integrations: [github],
    sandbox: () => new TestSandbox(sandboxHome),
    stateSecret: 'auto-progression-test-state-secret',
    secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
  });
  const args = await factory.prepare();
  const mastra = new Mastra(args);
  await factory.finalize();
  onTestFinished(async () => {
    await factory.shutdown();
    await mastra.stopWorkers();
    await storage.close();
  });
  const app = new Hono<{ Variables: { factoryAuthUser: { workosId: string; organizationId: string } } }>();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser', { workosId: 'maintainer', organizationId: orgId });
    await next();
  });
  mountApiRoutes(app, args.server?.apiRoutes ?? []);
  const send = async (method: string, path: string, body?: unknown) => {
    const response = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, json: (text ? JSON.parse(text) : null) as any };
  };

  const created = await send('POST', '/web/factory/projects', { name: 'Auto progression' });
  expect(created.status).toBe(201);
  const projectId = created.json.project.id as string;
  expect(
    (await send('PATCH', `/web/factory/projects/${projectId}`, { defaultModelId: 'openai/gpt-5.6-sol' })).status,
  ).toBe(200);
  await storage
    .getDomain<ModelCredentialsStorage>('model-credentials')
    .setCredential({ orgId }, 'openai', { type: 'api_key', key: 'sk-auto-progression' });
  // The stubbed model answers only OpenAI; keep observational memory from calling its observer model.
  await storage.getDomain<MemorySettingsStorage>('memory-settings').patch({
    orgId,
    userId: factoryProjectSettingsUserId(projectId),
    patch: { observationThreshold: 1_000_000 },
  });
  const sourceControl = github.sourceControlStorage;
  const installation = await sourceControl.installations.upsert({
    orgId,
    connectedByUserId: 'maintainer',
    externalId: randomUUID(),
  });
  const repository = await sourceControl.repositories.upsert({
    orgId,
    input: { installationId: installation.id, externalId: randomUUID(), slug: REPOSITORY, defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId,
    factoryProjectId: projectId,
    installationId: installation.id,
    createdByUserId: 'maintainer',
  });
  await sourceControl.projectRepositories.link({ orgId, connectionId: connection.id, repositoryId: repository.id });
  // The plan every planner submits, where the session's checkout reads it back.
  const plan = join(sandboxHome, repositoryDirectoryName(REPOSITORY), PLAN_PATH);
  mkdirSync(dirname(plan), { recursive: true });
  writeFileSync(plan, '# Plan\n\nFix it.\n');

  const workItems = storage.getDomain<WorkItemsStorage>('work-items');
  const project = `/web/factory/projects/${projectId}`;
  return {
    requests,
    send,
    workItems,
    projectId,
    /** Saves `edit` of the project's Work phases, as the board editor does. */
    async editWork(edit: (phase: StoredPhase) => StoredPhase) {
      const read = await send('GET', `${project}/boards/work`);
      expect(read.status).toBe(200);
      const work = read.json.board as { name: string; phases: StoredPhase[]; revision: number };
      const saved = await send('PATCH', `${project}/boards/work`, {
        name: work.name,
        phases: work.phases.map(edit),
        expectedRevision: work.revision,
      });
      expect(saved.status, JSON.stringify(saved.json)).toBe(200);
    },
    async route(name: string, phaseKey: string, when?: RuleGroup) {
      const route = await send('POST', `${project}/intake-routes`, {
        name,
        ...(when ? { when } : {}),
        target: { boardKey: 'work', phaseKey },
      });
      expect(route.status, JSON.stringify(route.json)).toBe(201);
    },
    /** A GitHub issue arriving through intake, by a maintainer (`trusted`) or an outside author. */
    async issue(title: string, trusted: boolean): Promise<Issue> {
      const issue = await send('POST', `${project}/work-items`, {
        title,
        externalSource: { integrationId: 'github', type: 'issue', externalId: `issue:${randomUUID()}` },
        metadata: { authorTrusted: trusted, labels: [] },
      });
      expect(issue.status, JSON.stringify(issue.json)).toBe(200);
      return issue.json.workItem as Issue;
    },
    /** A person moving the card from the board. */
    async personMoves(card: { id: string }, stage: string) {
      const current = (await workItems.get({ orgId, id: card.id }))!;
      const moved = await send('POST', `${project}/work-items/${card.id}/transition`, {
        board: 'work',
        stage,
        expectedRevision: current.revision,
        requestId: randomUUID(),
        cause: 'card_action',
      });
      expect(moved.json.result, JSON.stringify(moved.json)).toMatchObject({ status: 'accepted', stage });
    },
    /** A board rule moving the card: a system move, which carries no person's consent. */
    async ruleMoves(card: { id: string }, stage: string) {
      const current = (await workItems.get({ orgId, id: card.id }))!;
      const identity = `auto-rule:${randomUUID()}`;
      const commit = await workItems.commitRuleEvaluation({
        orgId,
        factoryProjectId: projectId,
        workItemId: card.id,
        ingress: { identity },
        expectedRevision: current.revision,
        actor: { type: 'system', id: 'rules' },
        outcome: { status: 'accepted' },
        decisions: [{ type: 'transition', idempotencyKey: `${identity}:move`, board: 'work', stage }],
        causalChain: [],
        now: new Date(),
      });
      expect(commit.status).toBe('committed');
    },
    read: async (card: { id: string }) => (await workItems.get({ orgId, id: card.id }))!,
    stagesOf: async (card: { id: string }) => (await workItems.get({ orgId, id: card.id }))!.stages,
    historyOf: async (card: { id: string }) =>
      (await workItems.get({ orgId, id: card.id }))!.stageHistory.map(entry => entry.stage),
    /** The run start Factory queued for `skill` on the card, if any. */
    async startOf(card: { id: string }, skill: string) {
      const decisions = await workItems.listDeferredDecisions(orgId, projectId, { workItemId: card.id });
      return decisions.find(record => record.decision.type === 'invokeSkill' && record.decision.skillName === skill);
    },
    /** What the attention inbox asks a person to do about the card. */
    async attentionFor(card: { id: string }) {
      const inbox = await send('GET', `${project}/attention`);
      expect(inbox.status).toBe(200);
      return (inbox.json.items as { kind: string; workItemId?: string; detail?: string }[])
        .filter(item => item.workItemId === card.id)
        .map(item => ({ kind: item.kind, detail: item.detail }));
    },
    /** Whether any model request carried a run of `skill` for the card. */
    ran: (skill: string, card: { title: string }) =>
      requests.some(body => body.includes(`<skill name=\\"${skill}\\">`) && body.includes(card.title)),
  };
}

const TRUSTED: RuleGroup = {
  operator: 'AND',
  conditions: [{ field: 'item.trusted', operator: 'equals', value: true }],
};
const TRUSTED_ARRIVAL: RuleGroup = {
  operator: 'AND',
  conditions: [{ field: 'author.trusted', operator: 'equals', value: true }],
};

/** Long enough for a run that should not happen, or an approval that should not land, to show. */
const settle = () => new Promise(resolve => setTimeout(resolve, 3_000));

describe('Work auto progression (isolated project)', () => {
  describe('shipped Work defaults', () => {
    it('waits for a person to start a new issue, then for a person to approve its plan', async () => {
      const project = await isolatedProject();

      // No intake route and no phase that starts on its own: the issue rests in Intake, and
      // nothing ran or was queued for it.
      const issue = await project.issue('Shipped default issue', true);
      expect(issue.stages).toEqual(['intake']);
      await settle();
      expect(await project.startOf(issue, 'factory-plan')).toBeUndefined();
      expect(project.ran('factory-plan', issue)).toBe(false);

      // Touchpoint 1: a person moves it to Planning, and the planner starts without another click.
      await project.personMoves(issue, 'planning');
      await vi.waitFor(() => expect(project.ran('factory-plan', issue)).toBe(true), { timeout: 20_000 });

      // Touchpoint 2: the plan is submitted and parks; the card stays in Planning, nothing builds,
      // and the inbox asks a person to review the plan.
      await vi.waitFor(
        async () =>
          expect(await project.attentionFor(issue)).toContainEqual({
            kind: 'agent-waiting',
            detail: 'Plan waiting for review',
          }),
        { timeout: 20_000 },
      );
      await settle();
      expect(await project.stagesOf(issue)).toEqual(['planning']);
      expect(project.ran('factory-build', issue)).toBe(false);
    }, 120_000);

    it('holds a card an intake route files into Planning until a person approves its run, and says so in the inbox', async () => {
      const project = await isolatedProject();
      await project.route('Trusted issues go to Planning', 'planning', TRUSTED_ARRIVAL);

      const issue = await project.issue('Routed into planning', true);
      expect(issue.stages).toEqual(['planning']);

      // Planning has no autoStart: the run is proposed, not started, and the proposal is in the
      // inbox, so the card is not silently stuck.
      await vi.waitFor(async () => expect((await project.startOf(issue, 'factory-plan'))?.status).toBe('proposed'), {
        timeout: 20_000,
      });
      await vi.waitFor(
        async () => expect((await project.attentionFor(issue)).map(item => item.kind)).toContain('automation-proposed'),
        { timeout: 20_000 },
      );
      await settle();
      expect(project.ran('factory-plan', issue)).toBe(false);
    }, 120_000);
  });

  describe('trusted-only automation (candidate configuration)', () => {
    /**
     * Planning and Building start on their own, and plans are approved without a person, only for
     * a trusted author's card; trusted issues are filed straight into Planning.
     */
    async function trustedOnlyProject() {
      const project = await isolatedProject();
      await project.editWork(phase => {
        switch (phase.key) {
          case 'planning':
            return {
              ...phase,
              autoStart: true,
              autoStartWhen: TRUSTED,
              exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: TRUSTED },
            } as StoredPhase;
          case 'execute':
            return { ...phase, autoStart: true, autoStartWhen: TRUSTED } as StoredPhase;
          default:
            return phase;
        }
      });
      await project.route('Trusted issues go to Planning', 'planning', TRUSTED_ARRIVAL);
      return project;
    }

    it("carries a trusted author's issue from arrival through plan approval and Building with no person", async () => {
      const project = await trustedOnlyProject();
      const issue = await project.issue('Trusted zero-touch', true);
      expect(issue.stages).toEqual(['planning']);

      await vi.waitFor(async () => expect(await project.stagesOf(issue)).toEqual(['done']), { timeout: 45_000 });
      expect(project.ran('factory-plan', issue)).toBe(true);
      expect(project.ran('factory-build', issue)).toBe(true);
      expect((await project.historyOf(issue)).slice(-3)).toEqual(['planning', 'execute', 'done']);
      // Neither run waited for a person: Planning's start names no approver, and Building's carries
      // the consent of the planning agent whose reported outcome moved the card.
      expect((await project.startOf(issue, 'factory-plan'))?.approvedBy).toBeNull();
      expect((await project.startOf(issue, 'factory-build'))?.approvedBy).toMatch(/^agent:/);
      // The plan's approval is stamped on the card the way a person's is: nothing on the card tells
      // an automatic approval from a person's.
      const metadata = (await project.read(issue)).metadata ?? {};
      expect(metadata.planApprovedAt).toEqual(expect.any(String));
      expect(Object.keys(metadata).filter(key => /approv/i.test(key))).toEqual(['planApprovedAt']);
    }, 120_000);

    // Bug evidence: nothing bounds Planning ↔ Building round trips once plans approve themselves.
    // `MAX_PLAN_APPROVALS` counts approvals within one run and `goal.maxRuns` runs within one stay in
    // Building; each replan starts both over. This asserts today's behaviour, so it keeps passing
    // until a cap lands; then it should assert the card stops and asks a person.
    it('keeps cycling Planning and Building with no person when the builder always replans and plans approve themselves', async () => {
      const project = await trustedOnlyProject();
      const issue = await project.issue('Replan forever', true);
      const roundTrips = async () => (await project.historyOf(issue)).filter(stage => stage === 'execute').length;
      await vi.waitFor(async () => expect(await roundTrips()).toBeGreaterThanOrEqual(5), { timeout: 60_000 });
      // Every run started on its own, and nothing in the inbox asks a person to step in.
      const plans = (
        await project.workItems.listDeferredDecisions((await project.read(issue)).orgId, project.projectId, {
          workItemId: issue.id,
        })
      ).filter(record => record.decision.type === 'invokeSkill' && record.decision.skillName === 'factory-plan');
      expect(plans.length).toBeGreaterThanOrEqual(5);
      expect(await project.attentionFor(issue)).toEqual([]);
    }, 120_000);

    it("never starts or approves an outside author's issue on its own, even when a rule moves it into Planning", async () => {
      const project = await trustedOnlyProject();
      const outside = await project.issue('Outside report', false);
      // The route files only trusted authors' issues: the outside one rests in Intake.
      expect(outside.stages).toEqual(['intake']);

      // A board rule moving it carries no consent: its run is proposed for a person.
      await project.ruleMoves(outside, 'planning');
      await vi.waitFor(async () => expect((await project.startOf(outside, 'factory-plan'))?.status).toBe('proposed'), {
        timeout: 20_000,
      });
      await settle();
      expect(project.ran('factory-plan', outside)).toBe(false);
    }, 120_000);

    it("keeps the plan gate for an outside author's issue a person started", async () => {
      const project = await trustedOnlyProject();
      const outside = await project.issue('Outside, started by a maintainer', false);

      // A person's move arms the card, so the planner runs; that consent does not approve the plan.
      await project.personMoves(outside, 'planning');
      await vi.waitFor(() => expect(project.ran('factory-plan', outside)).toBe(true), { timeout: 20_000 });
      await vi.waitFor(
        async () =>
          expect(await project.attentionFor(outside)).toContainEqual({
            kind: 'agent-waiting',
            detail: 'Plan waiting for review',
          }),
        { timeout: 20_000 },
      );
      await settle();
      expect(await project.stagesOf(outside)).toEqual(['planning']);
      expect(project.ran('factory-build', outside)).toBe(false);
    }, 120_000);
  });

  describe('every working phase starting on its own (the retired auto-run switch, as migrated)', () => {
    it("starts an outside author's planning run once a rule moves it into Planning, but still waits for a person to approve its plan", async () => {
      const project = await isolatedProject();
      // What `migrateAutoRunSwitch` writes for a project that had auto-run on.
      await project.editWork(phase =>
        phase.kind === 'working' ? ({ ...phase, autoStart: true, autoStartWhen: null } as StoredPhase) : phase,
      );
      await project.route('Every issue goes to Planning', 'planning');

      // The shipped "Outside authors wait in Intake" route comes first: the arrival itself is held.
      const outside = await project.issue('Outside, auto-run', false);
      expect(outside.stages).toEqual(['intake']);
      await settle();
      expect(project.ran('factory-plan', outside)).toBe(false);

      // But any rule that moves it into Planning starts the run: nobody looked at the outside
      // author's issue, yet its text reached a planning run.
      await project.ruleMoves(outside, 'planning');
      await vi.waitFor(() => expect(project.ran('factory-plan', outside)).toBe(true), { timeout: 20_000 });
      expect((await project.startOf(outside, 'factory-plan'))?.approvedBy).toBeNull();
      // The plan gate still holds: autoApprove stays off, so a person reviews the plan.
      await vi.waitFor(
        async () =>
          expect(await project.attentionFor(outside)).toContainEqual({
            kind: 'agent-waiting',
            detail: 'Plan waiting for review',
          }),
        { timeout: 20_000 },
      );
      await settle();
      expect(await project.stagesOf(outside)).toEqual(['planning']);
      expect(project.ran('factory-build', outside)).toBe(false);
    }, 120_000);
  });
});
