import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

// These tests cover the code-mode override product behavior:
// - The editor in code-override mode replaces db-mode Save/Publish with local
//   filesystem saves, Download JSON, or platform Open PR when configured.
// - Sections owned by code (editor.tools/instructions === false) are hidden in
//   the sidebar — Studio never lets a user edit fields the code locked down.
// - The export endpoint returns a deterministic payload reflecting overrides.

test.describe('code-mode agent override', () => {
  test.beforeEach(async () => {
    await resetStorage();
  });

  test.describe('when an editable code-mode agent is opened', () => {
    test('editable local code agent saves to filesystem and can download JSON', async ({ page, request }) => {
      await page.goto('/agents/code-override-editable/editor');

      // Local code mode exposes a filesystem write, plus Download JSON. Platform
      // Open PR is only shown when a platform/GitHub App endpoint is configured.
      const downloadButton = page.getByRole('button', { name: /Download JSON/i });
      const saveToFilesystemButton = page.getByRole('button', { name: /Save to filesystem/i });
      await expect(downloadButton).toBeVisible();
      await expect(saveToFilesystemButton).toBeVisible();
      await expect(page.getByRole('button', { name: /Open PR/i })).toHaveCount(0);

      // Save New Version / Publish belong to the db-mode stored-agent flow and must NOT appear.
      await expect(page.getByRole('button', { name: /^Save New Version$/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Publish$/i })).toHaveCount(0);

      const getVersionCount = async () => {
        const versions = await request
          .get('/api/stored/agents/code-override-editable/versions')
          .then(r => r.json() as Promise<{ versions: unknown[] }>);
        return versions.versions.length;
      };

      const initialVersionCount = await getVersionCount();

      await page.getByRole('button', { name: /System Prompt/i }).click();
      await page.locator('.cm-content').first().click();
      await page.keyboard.type('\nLocal filesystem save from e2e.');
      await expect(saveToFilesystemButton).toBeEnabled();
      await saveToFilesystemButton.click();

      // Code mode treats local saves as commit-less drafts: each save should
      // overwrite the rolling snapshot rather than grow version history.
      await expect.poll(getVersionCount).toBe(initialVersionCount);

      await page.locator('.cm-content').first().click();
      await page.keyboard.type(' Another tweak.');
      await saveToFilesystemButton.click();

      await expect.poll(getVersionCount).toBe(initialVersionCount);

      const downloadPromise = page.waitForEvent('download');
      await downloadButton.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('agents_code-override-editable.json');
      await expect(download.failure()).resolves.toBeNull();
    });
  });

  test.describe('when editable code-mode overrides are exported', () => {
    test('export endpoint returns a deterministic JSON payload for code-mode overrides', async ({ request }) => {
      // The Download JSON button calls /stored/agents/:id/export. Hit the endpoint
      // directly so we can assert on the actual exported payload — that is what
      // a user would commit to git when reviewing the change.
      const response = await request.post('/api/stored/agents/code-override-editable/export', {
        data: { instructions: 'Override instructions from export endpoint.' },
      });
      expect(response.ok()).toBe(true);

      const body = (await response.json()) as {
        agentId: string;
        fileName: string;
        content: string;
        config: Record<string, unknown>;
      };

      // Filename is deterministic and includes the source-control agent directory
      // so committed JSON files land at the same path used by proposal branches.
      expect(body.agentId).toBe('code-override-editable');
      expect(body.fileName).toBe('agents/code-override-editable.json');

      // Round-tripping content matches config so consumers can use either.
      const parsedContent = JSON.parse(body.content) as Record<string, unknown>;
      expect(parsedContent).toEqual(body.config);
      expect(parsedContent.instructions).toBe('Override instructions from export endpoint.');

      // Code-mode exports only carry user-editable overrides. `model` and `name`
      // are owned by the code definition and must not appear in the committed JSON.
      expect(parsedContent).not.toHaveProperty('model');
      expect(parsedContent).not.toHaveProperty('name');
    });
  });

  test.describe('when a locked code-mode agent (editor: false) is opened', () => {
    test('locked code agent (editor: false) hides override editing entirely', async ({ page }) => {
      await page.goto('/agents/code-override-locked/editor');

      // When editor: false the agent opts out of all overrides — Studio must not
      // surface code-mode write/export actions because no field is editable.
      await expect(page.getByRole('button', { name: /Download JSON/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Save to filesystem/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Open PR/i })).toHaveCount(0);

      // Save New Version / Publish belong to the stored-agent flow and are also
      // inappropriate here — this is still a code agent, just an immutable one.
      await expect(page.getByRole('button', { name: /^Save New Version$/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Publish$/i })).toHaveCount(0);

      // The user-facing Editor tab must be read-only and hide block-level edit controls.
      await expect(page.getByText(/Read-only/i)).toBeVisible();
      await page.getByRole('button', { name: /System Prompt/i }).click();
      await expect(page.getByRole('button', { name: /Save as prompt block/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Delete block/i })).toHaveCount(0);

      // Tools tab must show the same locked messaging as System Prompt and
      // hide add/remove controls — tools are code-owned for editor: false agents.
      await page.getByRole('button', { name: /^Tools$/i }).click();
      await expect(page.getByText(/Tools are owned by code/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Add Tools/i })).toHaveCount(0);
    });
  });

  test.describe('when locked code-mode overrides are exported', () => {
    test('locked code agent enforces editor: false on the server export endpoint', async ({ request }) => {
      // The server must refuse to bake overrides into an export for a code agent
      // that declared `editor: false`, even if the request body provides fields.
      const response = await request.post('/api/stored/agents/code-override-locked/export', {
        data: { instructions: 'Attempted override that should be dropped.' },
      });
      expect(response.ok()).toBe(true);
      const body = (await response.json()) as { config: Record<string, unknown> };

      // The locked agent owns instructions in code — no override survives.
      expect(body.config.instructions).toBeUndefined();
    });
  });
});
