import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { OUTSIDE_NESTED_GRAPHS } from './workflow-nodes';

function edgesFrom(page: Page, fromStepId: string) {
  return page.locator(`[data-edge-from="${fromStepId}"]${OUTSIDE_NESTED_GRAPHS}`);
}

export async function expectEdgesActive(page: Page, fromStepIds: string[]) {
  for (const fromStepId of fromStepIds) {
    const edges = edgesFrom(page, fromStepId);
    await expect(async () => {
      const statuses = await edges.evaluateAll(paths => paths.map(path => path.getAttribute('data-edge-status')));
      expect(statuses.length, `expected at least one edge from "${fromStepId}"`).toBeGreaterThan(0);
      for (const status of statuses) expect(status).toBe('success');
    }).toPass({ timeout: 20000 });
  }
}

export async function expectEdgesIdle(page: Page, fromStepIds: string[]) {
  for (const fromStepId of fromStepIds) {
    const edges = edgesFrom(page, fromStepId);
    await expect(async () => {
      const statuses = await edges.evaluateAll(paths => paths.map(path => path.getAttribute('data-edge-status')));
      expect(statuses.length, `expected at least one edge from "${fromStepId}"`).toBeGreaterThan(0);
      for (const status of statuses) expect(status).toBe('idle');
    }).toPass({ timeout: 20000 });
  }
}

export async function expectWorkflowDataPath(page: Page, { active, idle }: { active: string[]; idle: string[] }) {
  await expectEdgesActive(page, active);
  await expectEdgesIdle(page, idle);
}

export type EdgeExpectation = {
  from: string;
  to: string;
  status: 'success' | 'idle';
};

type RenderedEdge = { from: string | null; to: string | null; status: string | null };

async function readAllEdges(page: Page): Promise<RenderedEdge[]> {
  return page.locator(`[data-edge-from]${OUTSIDE_NESTED_GRAPHS}`).evaluateAll(paths =>
    paths.map(path => ({
      from: path.getAttribute('data-edge-from'),
      to: path.getAttribute('data-edge-to'),
      status: path.getAttribute('data-edge-status'),
    })),
  );
}

export async function expectExactEdgeStatuses(page: Page, expectations: EdgeExpectation[]) {
  const expectedByPair = new Map(expectations.map(({ from, to, status }) => [`${from} -> ${to}`, status]));

  await expect(async () => {
    const rendered = await readAllEdges(page);
    const renderedPairs = new Set(rendered.map(edge => `${edge.from} -> ${edge.to}`));
    expect(renderedPairs).toEqual(new Set(expectedByPair.keys()));

    for (const edge of rendered) {
      const key = `${edge.from} -> ${edge.to}`;
      expect(edge.status, `edge "${key}"`).toBe(expectedByPair.get(key));
    }
  }).toPass({ timeout: 20000 });
}
