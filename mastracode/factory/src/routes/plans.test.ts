import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { assertPlanPath, buildPlanRoutes } from './plans.js';
import { mountApiRoutes } from './test-utils.js';

async function makeWorkspace(): Promise<{ root: string; workspace: string }> {
  const root = await mkdtemp(join(tmpdir(), 'mc-plans-root-'));
  const workspace = join(root, 'workspace');
  await mkdir(workspace);
  return { root, workspace };
}

function makeApp(root: string): Hono {
  const app = new Hono();
  mountApiRoutes(app as never, buildPlanRoutes({ root }));
  return app;
}

async function requestPlan(app: Hono, body: unknown): Promise<Response> {
  return app.request('/web/plans/file', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('assertPlanPath', () => {
  it('normalizes valid plan paths', () => {
    expect(assertPlanPath('.mastracode/plans/add-dark-mode.md')).toBe('.mastracode/plans/add-dark-mode.md');
    expect(assertPlanPath('.mastracode/plans/nested/plan.md')).toBe('.mastracode/plans/nested/plan.md');
  });

  it('rejects paths outside the plans directory', () => {
    expect(() => assertPlanPath('src/index.md')).toThrow('outside the plans directory');
    expect(() => assertPlanPath('.mastracode/plansX/evil.md')).toThrow('outside the plans directory');
    expect(() => assertPlanPath('.mastracode/plans.md')).toThrow('outside the plans directory');
  });

  it('rejects traversal, absolute paths, and non-markdown files', () => {
    expect(() => assertPlanPath('.mastracode/plans/../../secret.md')).toThrow();
    expect(() => assertPlanPath('/etc/passwd')).toThrow('must be relative');
    expect(() => assertPlanPath('.mastracode/plans/script.sh')).toThrow('markdown');
  });
});

describe('POST /web/plans/file', () => {
  it('returns raw markdown for a valid plan path', async () => {
    const { root, workspace } = await makeWorkspace();
    const plansDir = join(workspace, '.mastracode', 'plans');
    await mkdir(plansDir, { recursive: true });
    await writeFile(join(plansDir, 'feature.md'), '# My Plan\n\nDetails.');

    const res = await requestPlan(makeApp(root), { workspacePath: workspace, path: '.mastracode/plans/feature.md' });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      path: '.mastracode/plans/feature.md',
      content: '# My Plan\n\nDetails.',
      truncated: false,
    });
  });

  it('rejects missing body fields with 400', async () => {
    const { root, workspace } = await makeWorkspace();
    const app = makeApp(root);

    expect((await requestPlan(app, { path: '.mastracode/plans/x.md' })).status).toBe(400);
    expect((await requestPlan(app, { workspacePath: workspace })).status).toBe(400);
  });

  it('rejects absolute paths with 403', async () => {
    const { root, workspace } = await makeWorkspace();

    const res = await requestPlan(makeApp(root), { workspacePath: workspace, path: '/etc/passwd' });

    expect(res.status).toBe(403);
  });

  it('rejects traversal out of the plans directory with 403', async () => {
    const { root, workspace } = await makeWorkspace();
    await writeFile(join(workspace, 'secret.md'), 'secret');

    const res = await requestPlan(makeApp(root), {
      workspacePath: workspace,
      path: '.mastracode/plans/../../secret.md',
    });

    expect(res.status).toBe(403);
  });

  it('rejects workspace paths outside the plans directory with 403', async () => {
    const { root, workspace } = await makeWorkspace();
    await writeFile(join(workspace, 'README.md'), 'readme');

    const res = await requestPlan(makeApp(root), { workspacePath: workspace, path: 'README.md' });

    expect(res.status).toBe(403);
  });

  it('rejects non-markdown files with 403', async () => {
    const { root, workspace } = await makeWorkspace();
    const plansDir = join(workspace, '.mastracode', 'plans');
    await mkdir(plansDir, { recursive: true });
    await writeFile(join(plansDir, 'script.sh'), 'echo hi');

    const res = await requestPlan(makeApp(root), { workspacePath: workspace, path: '.mastracode/plans/script.sh' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for a missing plan file', async () => {
    const { root, workspace } = await makeWorkspace();

    const res = await requestPlan(makeApp(root), { workspacePath: workspace, path: '.mastracode/plans/missing.md' });

    expect(res.status).toBe(404);
  });

  it('rejects workspaces outside the browsable root with 403', async () => {
    const { root } = await makeWorkspace();
    const outside = await mkdtemp(join(tmpdir(), 'mc-plans-outside-'));

    const res = await requestPlan(makeApp(root), { workspacePath: outside, path: '.mastracode/plans/x.md' });

    expect(res.status).toBe(403);
  });
});
