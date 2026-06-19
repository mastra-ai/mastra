import { expect, Page } from '@playwright/test';

/**
 * Edge-activation assertions for the workflow graph.
 *
 * Each rendered edge exposes its state via data attributes on the edge path:
 *   - data-edge-from:   source step id
 *   - data-edge-to:     target step id
 *   - data-edge-status: "success" (data flowed through) | "idle" (neutral)
 *
 * A green ("success") edge means the data actually flowed along that transition.
 * Un-taken branches stay "idle". These helpers let a test assert that the graph
 * faithfully represents the path the data took.
 */

function edgesFrom(page: Page, fromStepId: string) {
  return page.locator(`[data-edge-from="${fromStepId}"]`);
}

/** Assert every edge leaving `fromStepId` is active (data flowed through). */
export async function expectEdgesActive(page: Page, fromStepIds: string[]) {
  for (const fromStepId of fromStepIds) {
    const edges = edgesFrom(page, fromStepId);
    const count = await edges.count();
    expect(count, `expected at least one edge from "${fromStepId}"`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(edges.nth(i)).toHaveAttribute('data-edge-status', 'success', { timeout: 20000 });
    }
  }
}

/** Assert every edge leaving `fromStepId` is still neutral (no data flowed). */
export async function expectEdgesIdle(page: Page, fromStepIds: string[]) {
  for (const fromStepId of fromStepIds) {
    const edges = edgesFrom(page, fromStepId);
    const count = await edges.count();
    expect(count, `expected at least one edge from "${fromStepId}"`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(edges.nth(i)).toHaveAttribute('data-edge-status', 'idle', { timeout: 20000 });
    }
  }
}

/**
 * Assert the graph represents the data path: every meaningful (taken) source step
 * has active outgoing edges, and every un-taken source step stays neutral.
 */
export async function expectWorkflowDataPath(
  page: Page,
  { active, idle }: { active: string[]; idle: string[] },
) {
  await expectEdgesActive(page, active);
  await expectEdgesIdle(page, idle);
}

export type EdgeExpectation = {
  /** Edge source step id (data-edge-from). */
  from: string;
  /** Edge target step id (data-edge-to). */
  to: string;
  /** Expected status for EVERY rendered edge with this (from,to) pair. */
  status: 'success' | 'idle';
};

type RenderedEdge = { from: string | null; to: string | null; status: string | null };

async function readAllEdges(page: Page): Promise<RenderedEdge[]> {
  const edges = page.locator('[data-edge-from]');
  const count = await edges.count();
  const result: RenderedEdge[] = [];
  for (let i = 0; i < count; i++) {
    const edge = edges.nth(i);
    result.push({
      from: await edge.getAttribute('data-edge-from'),
      to: await edge.getAttribute('data-edge-to'),
      status: await edge.getAttribute('data-edge-status'),
    });
  }
  return result;
}

/**
 * Assert the COMPLETE, deterministic edge map of the graph.
 *
 * The graph may render more than one DOM edge for a single logical transition
 * (e.g. a conditional renders both a `prev -> condition` and a `condition -> arm`
 * edge that share the same data-edge-from/data-edge-to). This helper groups
 * rendered edges by their (from -> to) pair and asserts that EVERY edge in each
 * group matches the expected status, and that EVERY rendered edge is accounted
 * for by an expectation. Any unexpected or mis-colored edge fails the test.
 */
export async function expectExactEdgeStatuses(page: Page, expectations: EdgeExpectation[]) {
  // Wait until the graph settles on the expected status for each pair before snapshotting.
  for (const { from, to, status } of expectations) {
    const pairEdges = page.locator(`[data-edge-from="${from}"][data-edge-to="${to}"]`);
    const count = await pairEdges.count();
    expect(count, `expected at least one edge "${from}" -> "${to}"`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(
        pairEdges.nth(i),
        `edge "${from}" -> "${to}" (#${i}) should be "${status}"`,
      ).toHaveAttribute('data-edge-status', status, { timeout: 20000 });
    }
  }

  // Now snapshot every rendered edge and ensure NOTHING is unaccounted for.
  const expectedByPair = new Map<string, 'success' | 'idle'>();
  for (const { from, to, status } of expectations) {
    expectedByPair.set(`${from} -> ${to}`, status);
  }

  const rendered = await readAllEdges(page);
  for (const edge of rendered) {
    const key = `${edge.from} -> ${edge.to}`;
    const expectedStatus = expectedByPair.get(key);
    expect(expectedStatus, `unexpected rendered edge "${key}" (status=${edge.status})`).toBeTruthy();
    expect(edge.status, `edge "${key}" should be "${expectedStatus}"`).toBe(expectedStatus);
  }
}
