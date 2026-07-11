import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { _electron as electron, chromium, expect } from '@playwright/test';
import type { Browser, ElectronApplication, Page } from '@playwright/test';
import type { DesktopAppInfo } from 'mastracode-web/desktop-host';

export interface DesktopLaunchTarget {
  executablePath: string;
  args?: string[];
  webUiDist?: string;
  automation?: 'electron' | 'cdp';
}

export interface DesktopAcceptanceOptions {
  target: DesktopLaunchTarget;
  requireAuthenticatedModels?: boolean;
  runLiveChat?: boolean;
  liveModel?: string;
}

export interface DesktopAcceptanceResult {
  appInfo: DesktopAppInfo;
  liveResponse?: string;
}

interface DesktopInstance {
  page: Page;
  getWindowTitle: () => Promise<string | undefined>;
  diagnostics: () => string;
  close: () => Promise<void>;
}

function isAppRequest(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return path.startsWith('/api/') || path.startsWith('/web/');
  } catch {
    return false;
  }
}

function isDesktopAppPage(page: Page): boolean {
  try {
    const url = new URL(page.url());
    return url.protocol === 'http:' && url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function firstElectronAppPage(desktopApp: ElectronApplication): Promise<Page> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const page = desktopApp.windows().find(isDesktopAppPage);
    if (page) return page;
    await delay(250);
  }
  throw new Error('The desktop app did not create its MastraCode window within 30 seconds');
}

function withRendererDiagnostics(instance: DesktopInstance): DesktopInstance {
  let rendererOutput = '';
  const append = (line: string) => {
    rendererOutput = `${rendererOutput}${line}\n`.slice(-16_000);
  };

  instance.page.on('console', message => {
    append(`[renderer:${message.type()}] ${message.text()}`);
  });
  instance.page.on('pageerror', error => {
    append(`[renderer:error] ${error.message}`);
  });
  instance.page.on('request', request => {
    if (isAppRequest(request.url())) append(`[request] ${request.method()} ${request.url()}`);
  });
  instance.page.on('response', response => {
    if (isAppRequest(response.url())) append(`[response:${response.status()}] ${response.url()}`);
  });
  instance.page.on('requestfailed', request => {
    if (isAppRequest(request.url())) {
      append(
        `[request-failed] ${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'unknown error'}`,
      );
    }
  });

  return {
    ...instance,
    diagnostics: () => [instance.diagnostics().trim(), rendererOutput.trim()].filter(Boolean).join('\n'),
  };
}

function definedEnvironment(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) env[name] = value;
  }
  return env;
}

export function resolveDevelopmentElectronExecutable(): string {
  const require = createRequire(import.meta.url);
  const executable: unknown = require('electron');
  if (typeof executable !== 'string') throw new Error('Electron did not resolve to an executable path');
  return executable;
}

async function launchDesktop(
  target: DesktopLaunchTarget,
  projectDir: string,
  userDataDir: string,
  copyUserCredentials: boolean,
): Promise<DesktopInstance> {
  const runtimeDataDir = join(userDataDir, 'mastracode-runtime');
  if (copyUserCredentials) {
    const sourceDataDir =
      process.env.MASTRA_APP_DATA_DIR ?? join(homedir(), 'Library', 'Application Support', 'mastracode');
    await mkdir(runtimeDataDir, { recursive: true });
    await copyFile(join(sourceDataDir, 'auth.json'), join(runtimeDataDir, 'auth.json')).catch((error: unknown) => {
      throw new Error(`Authenticated desktop E2E requires ${join(sourceDataDir, 'auth.json')}`, { cause: error });
    });
  }
  const env: Record<string, string> = {
    ...definedEnvironment(),
    MASTRA_APP_DATA_DIR: runtimeDataDir,
    MASTRA_DB_PATH: join(runtimeDataDir, 'mastra.db'),
    MASTRACODE_DESKTOP_TEST_MODE: '1',
    MASTRACODE_DESKTOP_TEST_PROJECT_DIR: projectDir,
    MASTRACODE_DESKTOP_TEST_USER_DATA_DIR: userDataDir,
    MASTRACODE_TELEMETRY_DISABLED: 'true',
    MASTRA_TELEMETRY_DISABLED: 'true',
    ...(target.webUiDist ? { MASTRACODE_DESKTOP_WEB_DIST: target.webUiDist } : {}),
  };
  if (target.automation === 'cdp') return withRendererDiagnostics(await launchDesktopOverCdp(target, env));

  const desktopApp = await electron.launch({
    executablePath: target.executablePath,
    args: target.args ?? [],
    env,
  });
  return withRendererDiagnostics({
    page: await firstElectronAppPage(desktopApp),
    getWindowTitle: () =>
      desktopApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find(window => window.webContents.getURL().startsWith('http://127.0.0.1:'))
          ?.getTitle(),
      ),
    diagnostics: () => '',
    close: () => quitElectronDesktop(desktopApp),
  });
}

async function quitElectronDesktop(desktopApp: ElectronApplication): Promise<void> {
  const closed = desktopApp.waitForEvent('close');
  await desktopApp
    .evaluate(({ app }) => {
      app.quit();
    })
    .catch(() => undefined);
  const didClose = await Promise.race([closed.then(() => true), delay(10_000, false)]);
  if (!didClose) await desktopApp.close();
}

async function getAvailableDebugPort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not allocate a Chromium debugging port');
  }
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
  return address.port;
}

async function connectToPackagedApp(
  port: number,
  child: ReturnType<typeof spawn>,
  stderr: () => string,
): Promise<Browser> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`The installed app exited before CDP was ready. ${stderr()}`.trim());
    }
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }
  throw new Error('The installed app did not expose Chromium debugging within 30 seconds', { cause: lastError });
}

async function firstCdpAppPage(browser: Browser): Promise<Page> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const page = browser
      .contexts()
      .flatMap(context => context.pages())
      .find(isDesktopAppPage);
    if (page) return page;
    await delay(250);
  }
  throw new Error('The installed app did not create its MastraCode window within 30 seconds');
}

async function waitForProcessExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return Promise.race([once(child, 'exit').then(() => true), delay(timeoutMs, false)]);
}

async function quitPackagedDesktop(child: ReturnType<typeof spawn>, browser: Browser): Promise<void> {
  if (process.platform === 'darwin') {
    const quit = spawn(
      '/usr/bin/osascript',
      ['-e', 'tell application id "ai.mastra.mastracode.desktop.alpha" to quit'],
      { stdio: 'ignore' },
    );
    await Promise.race([once(quit, 'exit'), delay(5_000)]);
  }
  if (!(await waitForProcessExit(child, 10_000))) child.kill('SIGTERM');
  if (!(await waitForProcessExit(child, 5_000))) child.kill('SIGKILL');
  await browser.close().catch(() => undefined);
}

async function launchDesktopOverCdp(
  target: DesktopLaunchTarget,
  env: Record<string, string>,
): Promise<DesktopInstance> {
  const port = await getAvailableDebugPort();
  const child = spawn(target.executablePath, [...(target.args ?? []), `--remote-debugging-port=${port}`], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const appendOutput = (chunk: Buffer) => {
    output = `${output}${chunk.toString('utf8')}`.slice(-16_000);
  };
  child.stdout.on('data', appendOutput);
  child.stderr.on('data', appendOutput);
  const browser = await connectToPackagedApp(port, child, () => output);
  const page = await firstCdpAppPage(browser);
  return {
    page,
    getWindowTitle: () => Promise.resolve(undefined),
    diagnostics: () => output,
    close: () => quitPackagedDesktop(child, browser),
  };
}

function reportStage(stage: string): void {
  console.info(`[MastraCode Desktop E2E] ${stage}`);
}

async function expectProjectPersisted(page: Page, expectedName: string, expectedPath: string): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        ({ name, path }) => {
          function isUnknownArray(value: unknown): value is unknown[] {
            return Array.isArray(value);
          }

          const raw = window.localStorage.getItem('mastracode-projects');
          if (!raw) return false;
          const projects: unknown = JSON.parse(raw);
          if (!isUnknownArray(projects)) return false;
          return projects.some(project => {
            if (project === null || typeof project !== 'object') return false;
            if (!('name' in project) || !('path' in project)) return false;
            return project.name === name && project.path === path;
          });
        },
        { name: expectedName, path: expectedPath },
      ),
    )
    .toBe(true);
}

async function selectModel(page: Page, modelName: string): Promise<void> {
  await page.getByRole('button', { name: /Change model|Select a model/ }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await settings.locator('button[aria-haspopup="listbox"]').click();
  const search = settings.getByRole('textbox', { name: 'Search models' });
  await search.fill(modelName);
  const providerLabel = modelName.split('/').at(0) ?? '';
  const modelLabel = modelName.split('/').at(-1) ?? modelName;
  const option = settings.getByRole('option', {
    name: `${modelLabel} ${providerLabel}`.trim(),
    exact: true,
  });
  await expect(option).toBeVisible();
  await expect(option).toBeEnabled();
  await option.click();
  await page.keyboard.press('Escape');
  await expect(settings).not.toBeVisible();
}

async function runLivePrompt(page: Page): Promise<string> {
  const expected = /DESKTOP_CHAT_OK/i;
  const prompt = 'Reply with exactly DESKTOP_CHAT_OK and no punctuation.';
  const composer = page.getByRole('textbox', { name: 'Message' });
  await composer.fill(prompt);
  await composer.press('Enter');
  const response = page.getByRole('article', { name: 'Assistant message' }).filter({ hasText: expected }).last();
  const timeout = Number(process.env.MASTRACODE_DESKTOP_E2E_LIVE_TIMEOUT_MS ?? 120_000);
  await expect(response).toBeVisible({ timeout });
  const text = (await response.textContent())?.trim();
  if (!text) throw new Error('The live desktop response was empty');
  return text;
}

export async function runDesktopAcceptance(options: DesktopAcceptanceOptions): Promise<DesktopAcceptanceResult> {
  const projectDir = await mkdtemp(join(tmpdir(), 'mastracode-desktop-project-'));
  const unauthorizedProjectDir = await mkdtemp(join(tmpdir(), 'mastracode-desktop-unauthorized-'));
  const userDataDir = await mkdtemp(join(tmpdir(), 'mastracode-desktop-user-data-'));
  const projectName = basename(projectDir);
  const resolvedProjectDir = await realpath(projectDir);
  await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: projectName }, null, 2), 'utf-8');

  let desktopInstance: DesktopInstance | undefined;
  let acceptanceSucceeded = false;
  const copyUserCredentials = options.requireAuthenticatedModels === true || options.runLiveChat === true;
  try {
    reportStage('launching first instance');
    desktopInstance = await launchDesktop(options.target, resolvedProjectDir, userDataDir, copyUserCredentials);
    const page = desktopInstance.page;
    await expect.poll(() => page.url()).toMatch(/^http:\/\/127\.0\.0\.1:/);
    await page.waitForLoadState('domcontentloaded');
    reportStage('first instance loaded');

    const appUrl = page.url();
    const appOrigin = new URL(appUrl);
    expect(appOrigin.protocol).toBe('http:');
    expect(appOrigin.hostname).toBe('127.0.0.1');
    await expect.poll(async () => (await fetch(appUrl)).status).toBe(401);

    const appInfo = await page.evaluate(() => window.mastracodeDesktop?.getAppInfo());
    if (!appInfo) throw new Error('The typed desktop bridge did not return app information');
    expect(appInfo.name).toBe('MastraCode Desktop Alpha');
    const dragRegion = page.locator('.mastracode-desktop-drag-region');
    await expect(dragRegion).toBeAttached();
    const desktopTopPadding = await dragRegion.evaluate(
      element => window.getComputedStyle(element.parentElement ?? element).paddingTop,
    );
    expect(desktopTopPadding).toBe('40px');
    const windowTitle = await desktopInstance.getWindowTitle();
    if (windowTitle !== undefined) expect(windowTitle).toBe('MastraCode Desktop Alpha');

    await expect(page.getByRole('heading', { name: 'Open a project' })).toBeVisible();
    await page.getByRole('button', { name: /Choose from Finder/i }).click();
    await expectProjectPersisted(page, projectName, resolvedProjectDir);
    reportStage('project selected and persisted');

    await desktopInstance.close();
    desktopInstance = undefined;
    reportStage('first instance closed');
    await rm(join(userDataDir, 'approved-projects.json'), { force: true });
    reportStage('launching restored instance');
    desktopInstance = await launchDesktop(options.target, resolvedProjectDir, userDataDir, copyUserCredentials);

    const restoredPage = desktopInstance.page;
    await expect.poll(() => restoredPage.url()).toMatch(/^http:\/\/127\.0\.0\.1:/);
    await restoredPage.waitForLoadState('domcontentloaded');
    await expect(restoredPage.getByText('Project path has not been approved by the desktop app')).toBeVisible();
    await restoredPage.getByRole('button', { name: 'Allow folder access' }).click();
    await expect(restoredPage.getByRole('button', { name: /Change model|Select a model/ })).toBeVisible();
    await expectProjectPersisted(restoredPage, projectName, resolvedProjectDir);
    expect(desktopInstance.diagnostics()).not.toContain(
      'lsp: true requires vscode-jsonrpc and vscode-languageserver-protocol packages',
    );
    reportStage('folder access restored');

    const unauthorizedStatus = await restoredPage.evaluate(async path => {
      const response = await fetch('/api/agent-controller/code/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'unauthorized-project', tags: { projectPath: path } }),
      });
      return response.status;
    }, unauthorizedProjectDir);
    expect(unauthorizedStatus).toBe(403);
    reportStage('unauthorized project rejected');

    await restoredPage.getByRole('button', { name: /Change model|Select a model/ }).click();
    const settings = restoredPage.getByRole('dialog', { name: 'Settings' });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole('tab', { name: 'Model' })).toHaveAttribute('aria-selected', 'true');
    if (options.requireAuthenticatedModels) {
      await settings.locator('button[aria-haspopup="listbox"]').click();
      const modelSearch = settings.getByRole('textbox', { name: 'Search models' });
      await modelSearch.fill('anthropic/claude-sonnet-4-6');
      const claudeModel = settings.getByRole('option', { name: 'claude-sonnet-4-6 anthropic', exact: true });
      await expect(claudeModel).toBeVisible();
      await expect(claudeModel).toBeEnabled();
      await modelSearch.fill('openai/gpt-5.5');
      const codexModel = settings.getByRole('option', { name: 'gpt-5.5 openai', exact: true });
      await expect(codexModel).toBeVisible();
      await expect(codexModel).toBeEnabled();
      await restoredPage.keyboard.press('Escape');
      reportStage('authenticated subscription models verified');
    } else {
      await expect(
        settings.getByText('No models available.').or(settings.locator('button[aria-haspopup="listbox"]')),
      ).toBeVisible();
      reportStage('model selector state verified');
    }
    await restoredPage.keyboard.press('Escape');
    await expect(settings).not.toBeVisible();

    const composer = restoredPage.getByRole('textbox', { name: 'Message' });
    await composer.fill('/login');
    await composer.press('Enter');
    await expect(settings).toBeVisible();
    await expect(settings.getByRole('tab', { name: 'Providers' })).toHaveAttribute('aria-selected', 'true');
    await expect(settings.getByText('Claude Pro/Max')).toBeVisible();
    await expect(settings.getByText('ChatGPT Plus/Pro')).toBeVisible();
    await expect(settings.getByRole('button', { name: /Sign in|Sign out/ })).toHaveCount(2);
    if (!options.requireAuthenticatedModels) {
      const oauthStart = await restoredPage.evaluate(async () => {
        function isRecord(value: unknown): value is Record<string, unknown> {
          return value !== null && typeof value === 'object' && !Array.isArray(value);
        }

        const response = await fetch('/web/config/providers/anthropic/oauth/start', { method: 'POST' });
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || typeof body.authUrl !== 'string' || typeof body.loginId !== 'string') {
          return undefined;
        }
        return { authUrl: body.authUrl, loginId: body.loginId };
      });
      expect(oauthStart?.authUrl).toMatch(/^https:\/\/claude\.ai\/oauth\/authorize/);
      expect(oauthStart?.loginId.length).toBeGreaterThan(10);
    }
    await restoredPage.keyboard.press('Escape');
    await expect(settings).not.toBeVisible();
    reportStage(
      options.requireAuthenticatedModels ? 'login command verified' : 'login command and OAuth start verified',
    );

    let liveResponse: string | undefined;
    if (options.runLiveChat) {
      const model = options.liveModel ?? 'anthropic/claude-sonnet-4-6';
      reportStage(`running live prompt with ${model}`);
      await selectModel(restoredPage, model);
      liveResponse = await runLivePrompt(restoredPage);
      reportStage('live prompt verified');
    }

    await restoredPage.context().setOffline(true);
    await expect(restoredPage.getByText(projectName, { exact: true }).first()).toBeVisible();
    await expect(composer).toBeVisible();
    await restoredPage.context().setOffline(false);
    reportStage('offline interface verified');

    acceptanceSucceeded = true;
    return { appInfo, ...(liveResponse ? { liveResponse } : {}) };
  } finally {
    reportStage('cleaning up');
    const diagnostics = desktopInstance?.diagnostics().trim();
    if (!acceptanceSucceeded && diagnostics) console.info(`[MastraCode Desktop E2E diagnostics]\n${diagnostics}`);
    await desktopInstance?.close().catch(() => undefined);
    await rm(projectDir, { recursive: true, force: true });
    await rm(unauthorizedProjectDir, { recursive: true, force: true });
    await rm(userDataDir, { recursive: true, force: true });
    reportStage('cleanup complete');
  }
}
