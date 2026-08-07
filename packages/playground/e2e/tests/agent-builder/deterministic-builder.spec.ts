import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { selectFixture } from '../__utils__/select-fixture';
import type { Fixtures } from '../__utils__/select-fixture';

const starterCases: Array<{
  title: string;
  fixture: Fixtures;
  expectedName: string;
}> = [
  { title: 'Support triage', fixture: 'agent-builder-support', expectedName: 'Email Support Triager' },
  { title: 'Standup bot', fixture: 'agent-builder-standup', expectedName: 'Async Standup Coordinator' },
  { title: 'PR reviewer', fixture: 'agent-builder-pr-reviewer', expectedName: 'TypeScript PR Reviewer' },
  { title: 'Onboarding tutor', fixture: 'agent-builder-onboarding', expectedName: 'Codebase Onboarding Guide' },
];

const complexPrompt =
  'Build a B2B SaaS security vulnerability triage agent. It should classify severity, ask for missing proof, identify customer impact, draft a concise escalation summary, and route urgent issues to security leadership.';

test.describe('Agent Builder deterministic flow', () => {
  test.setTimeout(60_000);

  test.beforeEach(async () => {
    await resetStorage();
  });

  for (const starter of starterCases) {
    test.describe(`when the ${starter.title} starter is selected`, () => {
      test(`builds ${starter.title} from starter with deterministic tool calls`, async ({ page }) => {
        await selectFixture(page, starter.fixture);
        await page.goto('/agent-builder/agents/create');

        await page.getByRole('button', { name: new RegExp(starter.title, 'i') }).click();
        await expect(page.getByTestId('agent-builder-starter-input')).not.toHaveValue('');
        await expect(page.getByTestId('agent-builder-starter-submit')).toBeEnabled();
        await page.getByTestId('agent-builder-starter-submit').click();
        await page.waitForURL(/\/agent-builder\/agents\/[^/]+\/edit/);

        await assertBuilderOutput(page, starter.expectedName);
      });
    });
  }

  test.describe('when a complex freeform prompt is submitted', () => {
    test('builds a complex freeform prompt with deterministic tool calls', async ({ page }) => {
      await selectFixture(page, 'agent-builder-complex');
      await page.goto('/agent-builder/agents/create');

      await page.getByTestId('agent-builder-starter-input').fill(complexPrompt);
      await expect(page.getByTestId('agent-builder-starter-submit')).toBeEnabled();
      await page.getByTestId('agent-builder-starter-submit').click();
      await page.waitForURL(/\/agent-builder\/agents\/[^/]+\/edit/);

      await assertBuilderOutput(page, 'Vuln Triage Sentinel');
    });
  });
});

async function assertBuilderOutput(page: Page, expectedName: string) {
  await expect(page.getByTestId('agent-builder-ready-heading')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('p').filter({ hasText: `Done — I configured ${expectedName}.` })).toBeVisible();

  // Regression guard: each deterministic client tool call should execute exactly once.
  // This catches duplicate continuation execution, missing tool execution, and empty/bad args in the browser path.
  await expect(page.getByText('Setting the agent name:')).toHaveCount(1);
  await expect(page.getByText('Setting the agent description:')).toHaveCount(1);
  await expect(page.getByText('Setting the agent instructions:')).toHaveCount(1);

  await page.getByTestId('agent-builder-ready-review').click();
  await expect(page.getByTestId('agent-configure-name')).toHaveValue(expectedName);
  await expect(page.getByTestId('agent-configure-description')).not.toHaveValue('');
}
