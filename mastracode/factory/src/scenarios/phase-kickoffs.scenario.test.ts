/**
 * Phase kickoffs chosen in Settings → Boards (a library skill or a custom prompt) replace the
 * built-in kickoff on the built-in Work board, keep the card's context, and fall back to the
 * built-in kickoff when the library skill is deleted.
 */
import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { startFactoryScenario } from './harness.js';
import type { FactoryScenario } from './harness.js';

// Model requests carry the prompt JSON-encoded.
const SKILL_TAG = JSON.stringify('<skill name="careful-plan">').slice(1, -1);

let scenario: FactoryScenario | undefined;
afterEach(async () => {
  await scenario?.close();
  scenario = undefined;
});

async function fileAndPlan(s: FactoryScenario, factoryId: string, title: string): Promise<string> {
  const { workItem } = await s.json('POST', `/web/factory/projects/${factoryId}/work-items`, { board: 'work', title });
  expect(workItem).toMatchObject({ board: 'work', stages: ['intake'] });
  const { result } = await s.json('POST', `/web/factory/projects/${factoryId}/work-items/${workItem.id}/transition`, {
    board: 'work',
    stage: 'planning',
    expectedRevision: workItem.revision,
    requestId: randomUUID(),
    cause: 'plan-it',
  });
  expect(result).toMatchObject({ status: 'accepted', stage: 'planning' });
  let kickoff: string | undefined;
  await vi.waitFor(
    () => {
      kickoff = s.kickoff('plan', title);
      expect(kickoff).toBeDefined();
    },
    { timeout: 15_000 },
  );
  return kickoff!;
}

describe('phase kickoffs on the built-in Work board', () => {
  it('run a library skill, then a custom prompt, then the built-in kickoff once the skill is deleted', async () => {
    const s = (scenario = await startFactoryScenario());
    const ops = await s.createProject('Ops');
    await s.connectGithubRepository(ops.id, 'ops/service');
    const base = `/web/factory/projects/${ops.id}`;

    // Built-in kickoff first, as the baseline.
    const builtIn = await fileAndPlan(s, ops.id, 'Baseline card');
    expect(builtIn).not.toContain(SKILL_TAG);

    await s.json(
      'POST',
      `${base}/skill-library`,
      { name: 'careful-plan', description: 'Plans carefully.', content: 'Write a three-step plan.' },
      201,
    );
    await s.json('PUT', `${base}/phase-skills/work/planning`, { skillName: 'careful-plan' });
    const withSkill = await fileAndPlan(s, ops.id, 'Skill card');
    expect(withSkill).toContain(SKILL_TAG);
    expect(withSkill).toContain('Write a three-step plan.');
    // The card's own context still reaches the run.
    expect(withSkill).toContain('Skill card');

    await s.json('PUT', `${base}/phase-skills/work/planning`, { prompt: 'Plan only the database changes.' });
    const withPrompt = await fileAndPlan(s, ops.id, 'Prompt card');
    expect(withPrompt).toContain('Plan only the database changes.');
    expect(withPrompt).not.toContain(SKILL_TAG);

    // Deleting a library skill sends phases running it back to the built-in kickoff.
    await s.json('PUT', `${base}/phase-skills/work/planning`, { skillName: 'careful-plan' });
    await s.json('DELETE', `${base}/skill-library/careful-plan`, undefined, 204);
    const { phaseSkills } = await s.json('GET', `${base}/phase-skills`);
    expect(phaseSkills).toEqual([]);
    const afterDelete = await fileAndPlan(s, ops.id, 'Fallback card');
    expect(afterDelete).not.toContain(SKILL_TAG);
    expect(afterDelete).not.toContain('Plan only the database changes.');
  }, 60_000);

  it("keeps one Factory's kickoffs out of another's runs", async () => {
    const s = (scenario = await startFactoryScenario());
    const ops = await s.createProject('Ops');
    const other = await s.createProject('Other');
    await s.connectGithubRepository(ops.id, 'ops/service');
    await s.connectGithubRepository(other.id, 'other/service');
    await s.json('PUT', `/web/factory/projects/${ops.id}/phase-skills/work/planning`, { prompt: 'Ops-only planning.' });

    expect(await fileAndPlan(s, ops.id, 'Ops card')).toContain('Ops-only planning.');
    expect(await fileAndPlan(s, other.id, 'Other card')).not.toContain('Ops-only planning.');
  }, 60_000);

  it('continues a library skill, not restarts it, when a Review pass is re-entered mid-run', async () => {
    const s = (scenario = await startFactoryScenario());
    const ops = await s.createProject('Ops');
    const repo = await s.connectGithubRepository(ops.id, 'ops/service');
    const base = `/web/factory/projects/${ops.id}`;
    const reviewTag = JSON.stringify('<skill name="ops-review">').slice(1, -1);
    await s.json(
      'POST',
      `${base}/skill-library`,
      { name: 'ops-review', description: 'How Ops reviews.', content: 'Check the rollback plan first.' },
      201,
    );
    await s.json('PUT', `${base}/phase-skills/review/review`, { skillName: 'ops-review' });

    // Someone opens a pull request, which lands on the Review board.
    const delivered = await s.githubWebhook('pull_request', {
      action: 'opened',
      repository: { id: Number(repo.externalId), full_name: repo.slug },
      sender: { login: 'ada' },
      pull_request: {
        number: 21,
        title: 'Tighten deploy timeouts',
        html_url: `https://github.com/${repo.slug}/pull/21`,
        created_at: '2026-10-18T00:00:00Z',
        state: 'open',
        merged: false,
        user: { login: 'ada' },
        head: { ref: 'ada/timeouts', sha: 'b'.repeat(40) },
        base: { ref: 'main' },
      },
    });
    expect(delivered.status).toBe(202);
    let card: Awaited<ReturnType<FactoryScenario['workItems']['list']>>[number] | undefined;
    await vi.waitFor(
      async () => {
        card = (await s.workItems.list({ orgId: 'scenario-org', factoryProjectId: ops.id })).find(item =>
          item.title.includes('Tighten deploy timeouts'),
        );
        expect(card).toBeDefined();
      },
      { timeout: 15_000 },
    );

    const reviewRuns = () => s.modelRequests.filter(request => request.role === 'review');
    const enterReview = async (cause: string, reenter = false) => {
      const current = (await s.workItems.get({ orgId: 'scenario-org', id: card!.id }))!;
      const { result } = await s.json('POST', `${base}/work-items/${card!.id}/transition`, {
        board: 'review',
        stage: 'review',
        expectedRevision: current.revision,
        requestId: randomUUID(),
        cause,
        ...(reenter ? { reenter: true } : {}),
      });
      expect(result).toMatchObject({ status: 'accepted', stage: 'review' });
    };

    // First pass: the library skill replaces the built-in review skill. No verdict is recorded.
    await enterReview('first-pass');
    await vi.waitFor(() => expect(reviewRuns().length).toBeGreaterThan(0), { timeout: 15_000 });
    const first = reviewRuns().at(-1)!.text;
    expect(first).toContain(reviewTag);
    expect(first).toContain('Check the rollback plan first.');
    expect(first).toContain('Tighten deploy timeouts');

    // Re-entering Review mid-pass continues the same skill instead of pasting it in again, and
    // still hands the run the card.
    const before = reviewRuns().length;
    await enterReview('re-enter', true);
    await vi.waitFor(() => expect(reviewRuns().length).toBeGreaterThan(before), { timeout: 15_000 });
    const second = reviewRuns().at(-1)!.text;
    expect(second.split('Check the rollback plan first.').length - 1).toBe(1);
    expect(second).toContain('Resume the active ops-review session');
    expect(second.split('pull/21').length).toBeGreaterThan(first.split('pull/21').length);
  }, 60_000);
});
