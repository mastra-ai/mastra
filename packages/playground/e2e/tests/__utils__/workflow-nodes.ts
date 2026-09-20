import type { Page } from '@playwright/test';

export const OUTSIDE_NESTED_GRAPHS = ':not([data-workflow-node] *)';

export function topLevelWorkflowNodes(page: Page) {
  return page.locator(`[data-workflow-node]${OUTSIDE_NESTED_GRAPHS}`);
}
