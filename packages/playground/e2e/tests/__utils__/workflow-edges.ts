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
