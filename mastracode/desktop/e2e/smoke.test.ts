import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';
import electronPath from 'electron';

const electronExecutablePath = electronPath as unknown as string;

test('launches the desktop app and opens a project through the typed native bridge', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'mastracode-desktop-project-'));
  const unauthorizedProjectDir = await mkdtemp(join(tmpdir(), 'mastracode-desktop-unauthorized-'));
  const userDataDir = await mkdtemp(join(tmpdir(), 'mastracode-desktop-user-data-'));
  const projectName = basename(projectDir);
  const resolvedProjectDir = await realpath(projectDir);

  await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: projectName }, null, 2), 'utf-8');

  const launchApp = () =>
    electron.launch({
      executablePath: electronExecutablePath,
      args: [resolve('dist/main/main.js')],
      env: {
        ...process.env,
        MASTRACODE_DESKTOP_TEST_PROJECT_DIR: projectDir,
        MASTRACODE_DESKTOP_USER_DATA_DIR: userDataDir,
        MASTRACODE_DESKTOP_WEB_DIST: resolve('dist/web-ui'),
        MASTRACODE_TELEMETRY_DISABLED: 'true',
        MASTRA_TELEMETRY_DISABLED: 'true',
      },
    });

  let app = await launchApp();

  try {
    const page = await app.firstWindow();
    await expect.poll(() => page.url()).toMatch(/^http:\/\/127\.0\.0\.1:/);
    await page.waitForLoadState('domcontentloaded');

    const appUrl = page.url();
    const appOrigin = new URL(appUrl);
    expect(appOrigin.protocol).toBe('http:');
    expect(appOrigin.hostname).toBe('127.0.0.1');
    await expect.poll(async () => (await fetch(appUrl)).status).toBe(401);

    const appInfo = await page.evaluate(() => window.mastracodeDesktop?.getAppInfo());
    expect(appInfo).toEqual(
      expect.objectContaining({
        name: 'MastraCode Desktop Alpha',
      }),
    );
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getTitle()))
      .toBe('MastraCode Desktop Alpha');

    await expect(page.getByRole('heading', { name: 'Open a project' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __MASTRACODE_CONFIG__?: { authEnabled?: boolean } }).__MASTRACODE_CONFIG__,
        ),
      )
      .toEqual({ authEnabled: false });
    await page.getByRole('button', { name: /Choose from Finder/i }).click();

    await expect
      .poll(async () =>
        page.evaluate(
          ({ expectedName, expectedPath }) => {
            const raw = window.localStorage.getItem('mastracode-projects');
            if (!raw) return false;
            const projects: unknown = JSON.parse(raw);
            if (!Array.isArray(projects)) return false;
            return projects.some(project => {
              if (!project || typeof project !== 'object') return false;
              const { name, path } = project as { name?: unknown; path?: unknown };
              return name === expectedName && path === expectedPath;
            });
          },
          { expectedName: projectName, expectedPath: resolvedProjectDir },
        ),
      )
      .toBe(true);

    await app.close();
    await rm(join(userDataDir, 'approved-projects.json'), { force: true });
    app = await launchApp();

    const restoredPage = await app.firstWindow();
    await restoredPage.waitForLoadState('domcontentloaded');
    await expect
      .poll(() =>
        restoredPage.evaluate(() => ({
          bridgePresent: Boolean(window.mastracodeDesktop),
          buttons: [...document.querySelectorAll('button')].map(button => button.textContent.trim()),
        })),
      )
      .toEqual(
        expect.objectContaining({
          bridgePresent: true,
          buttons: expect.arrayContaining(['Allow folder access']),
        }),
      );
    await expect(restoredPage.getByText('Project path has not been approved by the desktop app')).toBeVisible();
    await restoredPage.getByRole('button', { name: 'Allow folder access' }).click();
    await expect(restoredPage.getByRole('button', { name: /Change model|Select a model/ })).toBeVisible();
    await expect
      .poll(async () =>
        restoredPage.evaluate(() => {
          const raw = window.localStorage.getItem('mastracode-projects');
          if (!raw) return 0;
          const projects: unknown = JSON.parse(raw);
          return Array.isArray(projects) ? projects.length : 0;
        }),
      )
      .toBe(1);

    const unauthorizedStatus = await restoredPage.evaluate(async path => {
      const response = await fetch('/api/agent-controller/code/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'unauthorized-project', tags: { projectPath: path } }),
      });
      return response.status;
    }, unauthorizedProjectDir);
    expect(unauthorizedStatus).toBe(403);

    await restoredPage.getByRole('button', { name: /Change model|Select a model/ }).click();
    const settings = restoredPage.getByRole('dialog', { name: 'Settings' });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole('tab', { name: 'Model' })).toHaveAttribute('aria-selected', 'true');
    await settings.locator('button[aria-haspopup="listbox"]').click();
    const modelSearch = settings.getByRole('textbox', { name: 'Search models' });
    await modelSearch.fill('claude-code-sonnet');
    await expect(settings.getByRole('option', { name: /claude-code-sonnet/i })).toBeVisible();
    await modelSearch.fill('codex-cli');
    await expect(settings.getByRole('option', { name: /codex-cli/i })).toBeVisible();
    await restoredPage.keyboard.press('Escape');
    await expect(settings).not.toBeVisible();

    const composer = restoredPage.getByRole('textbox');
    await composer.fill('/login');
    await composer.press('Enter');
    await expect(settings).toBeVisible();
    await expect(settings.getByRole('tab', { name: 'Providers' })).toHaveAttribute('aria-selected', 'true');
    await expect(settings.getByText('Claude Pro/Max')).toBeVisible();
    await expect(settings.getByRole('button', { name: /Sign in|Sign out/ })).toBeVisible();
    await restoredPage.keyboard.press('Escape');

    await restoredPage.context().setOffline(true);
    await expect(restoredPage.getByText(projectName, { exact: true }).first()).toBeVisible();
    await expect(composer).toBeVisible();
    await restoredPage.context().setOffline(false);
  } finally {
    await app.close().catch(() => undefined);
    await rm(projectDir, { recursive: true, force: true });
    await rm(unauthorizedProjectDir, { recursive: true, force: true });
    await rm(userDataDir, { recursive: true, force: true });
  }
});
