/**
 * Browser profile lifecycle test factory.
 *
 * Exports config matrix and test generators that each provider imports.
 * Cross-provider tests live in the shared _test-utils package.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { MastraBrowser } from '@mastra/core/browser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowserTestConfig {
  scope: 'shared' | 'thread';
  profile: boolean;
  headless: boolean;
}

export interface BrowserFactory {
  /** Human-readable name (e.g. "Stagehand", "AgentBrowser") */
  name: string;
  /** Create a browser instance with the given config */
  create(config: {
    profile?: string;
    scope: 'shared' | 'thread';
    headless: boolean;
    executablePath?: string;
  }): MastraBrowser;
  /** Navigate to a URL */
  navigate(browser: MastraBrowser, url: string, threadId?: string): Promise<void>;
  /** Get the browser process PID (after ensureReady) */
  getPid(browser: MastraBrowser, threadId?: string): Promise<number | undefined>;
}

// ---------------------------------------------------------------------------
// Config Matrix
// ---------------------------------------------------------------------------

/** All test configurations (scope × profile × headless) */
export const ALL_CONFIGS: BrowserTestConfig[] = [
  // Headless
  { scope: 'shared', profile: true, headless: true },
  { scope: 'shared', profile: false, headless: true },
  { scope: 'thread', profile: true, headless: true },
  { scope: 'thread', profile: false, headless: true },
  // Headed
  { scope: 'shared', profile: true, headless: false },
  { scope: 'shared', profile: false, headless: false },
  { scope: 'thread', profile: true, headless: false },
  { scope: 'thread', profile: false, headless: false },
];

/**
 * Filter configs based on environment.
 * Set BROWSER_TEST_HEADED=1 to include headed tests.
 */
export function getActiveConfigs(): BrowserTestConfig[] {
  const includeHeaded = process.env.BROWSER_TEST_HEADED === '1';
  return ALL_CONFIGS.filter(c => c.headless || includeHeaded);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_URL = 'https://example.com';
const THREAD_ID = 'test-thread-1';
const CHROME_LOCK_FILES = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Find system Chrome executable path.
 * Returns undefined if not found.
 */
export function getSystemChromePath(): string | undefined {
  const paths: string[] = [];

  if (process.platform === 'darwin') {
    paths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else if (process.platform === 'linux') {
    paths.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    );
  } else if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    paths.push(
      `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
      `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
      `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
    );
  }

  for (const p of paths) {
    if (existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

/**
 * Check if a process is still running by PID.
 */
function isProcessRunning(pid: number): boolean {
  try {
    // kill with signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for a process to exit, with timeout.
 */
async function waitForProcessExit(pid: number, timeoutMs = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await sleep(100);
  }
  return !isProcessRunning(pid);
}

function hasLockFiles(profilePath: string): boolean {
  if (!existsSync(profilePath)) return false;
  return readdirSync(profilePath).some(f => CHROME_LOCK_FILES.includes(f));
}

function getExitType(profilePath: string): string | undefined {
  const prefsPath = join(profilePath, 'Default', 'Preferences');
  if (!existsSync(prefsPath)) return undefined;
  try {
    return JSON.parse(readFileSync(prefsPath, 'utf-8'))?.profile?.exit_type;
  } catch {
    return undefined;
  }
}

function killProcess(pid: number): void {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

function configLabel(config: BrowserTestConfig): string {
  const parts = [
    config.scope,
    config.profile ? 'profile' : 'no-profile',
    config.headless ? 'headless' : 'headed',
  ];
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Per-Provider Test Generator
// ---------------------------------------------------------------------------

/**
 * Generate all profile lifecycle tests for a single provider.
 * Call this from each provider's test file.
 */
export function createProviderTests(factory: BrowserFactory) {
  const configs = getActiveConfigs();

  describe(`${factory.name} profile lifecycle`, () => {
    afterEach(() => sleep(500));

    for (const config of configs) {
      describe(configLabel(config), () => {
        it('programmatic close — process exits, cleans up', async () => {
          const profileDir = config.profile ? mkdtempSync(join(tmpdir(), 'browser-test-')) : undefined;

          try {
            const browser = factory.create({
              profile: profileDir,
              scope: config.scope,
              headless: config.headless,
            });

            if (config.scope === 'thread') {
              browser.setCurrentThread(THREAD_ID);
            }

            await browser.ensureReady();
            await factory.navigate(browser, TEST_URL, config.scope === 'thread' ? THREAD_ID : undefined);

            // Get the PID we spawned
            const pid = await factory.getPid(browser, config.scope === 'thread' ? THREAD_ID : undefined);
            expect(pid).toBeDefined();
            expect(isProcessRunning(pid!)).toBe(true);

            // Close
            if (config.scope === 'thread') {
              await browser.closeThreadSession(THREAD_ID);
            } else {
              await browser.close();
            }

            // Verify our process exited
            const exited = await waitForProcessExit(pid!, 5000);
            expect(exited).toBe(true);

            // Verify profile cleanup
            if (profileDir) {
              expect(hasLockFiles(profileDir)).toBe(false);
              const exitType = getExitType(profileDir);
              if (exitType !== undefined) {
                expect(exitType).toBe('Normal');
              }
            }

            // Final cleanup for thread scope
            if (config.scope === 'thread') {
              try {
                await browser.close();
              } catch {}
            }
          } finally {
            if (profileDir) {
              rmSync(profileDir, { recursive: true, force: true });
            }
          }
        }, 30_000);

        it('manual close — process exits, cleans up', async () => {
          const profileDir = config.profile ? mkdtempSync(join(tmpdir(), 'browser-test-')) : undefined;

          try {
            const browser = factory.create({
              profile: profileDir,
              scope: config.scope,
              headless: config.headless,
            });

            if (config.scope === 'thread') {
              browser.setCurrentThread(THREAD_ID);
            }

            await browser.ensureReady();
            await factory.navigate(browser, TEST_URL, config.scope === 'thread' ? THREAD_ID : undefined);

            // Get the PID we spawned
            const pid = await factory.getPid(browser, config.scope === 'thread' ? THREAD_ID : undefined);
            expect(pid).toBeDefined();
            expect(isProcessRunning(pid!)).toBe(true);

            // Kill the process externally (simulates user closing browser window)
            killProcess(pid!);

            // Verify our process exited
            const exited = await waitForProcessExit(pid!, 5000);
            expect(exited).toBe(true);

            // Verify profile cleanup
            if (profileDir) {
              // Give disconnect handler time to clean up
              await sleep(1000);
              expect(hasLockFiles(profileDir)).toBe(false);
              const exitType = getExitType(profileDir);
              if (exitType !== undefined) {
                expect(exitType).toBe('Normal');
              }
            }

            // Clean up browser state
            try {
              await browser.close();
            } catch {}
          } finally {
            if (profileDir) {
              rmSync(profileDir, { recursive: true, force: true });
            }
          }
        }, 30_000);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Cross-Provider Test Generator
// ---------------------------------------------------------------------------

interface HeadlessCombo {
  aHeadless: boolean;
  bHeadless: boolean;
  label: string;
}

const ALL_HEADLESS_COMBOS: HeadlessCombo[] = [
  { aHeadless: true, bHeadless: true, label: 'A-headless → B-headless' },
  { aHeadless: true, bHeadless: false, label: 'A-headless → B-headed' },
  { aHeadless: false, bHeadless: true, label: 'A-headed → B-headless' },
  { aHeadless: false, bHeadless: false, label: 'A-headed → B-headed' },
];

/**
 * Generate cross-provider switching tests.
 * Tests that profiles can be shared between providers.
 * Tests all headless mode combinations.
 *
 * Two variants:
 * 1. Default Chrome (each provider uses its default)
 * 2. Same Chrome (both use system Chrome via executablePath)
 */
export function createCrossProviderTests(factoryA: BrowserFactory, factoryB: BrowserFactory) {
  const includeHeaded = process.env.BROWSER_TEST_HEADED === '1';
  const systemChrome = getSystemChromePath();

  // Filter combos based on env
  const activeCombos = ALL_HEADLESS_COMBOS.filter(
    c => (c.aHeadless && c.bHeadless) || includeHeaded,
  );

  // Two variants: default Chrome and same Chrome (executablePath)
  const variants: Array<{ label: string; executablePath?: string }> = [
    { label: 'default Chrome' },
  ];
  if (systemChrome) {
    variants.push({ label: 'same Chrome (executablePath)', executablePath: systemChrome });
  }

  describe(`Cross-provider: ${factoryA.name} ↔ ${factoryB.name}`, () => {
    afterEach(() => sleep(500));

    for (const variant of variants) {
      describe(variant.label, () => {
        for (const combo of activeCombos) {
          describe(combo.label, () => {
            it('A → B → A with shared profile', async () => {
              const profileDir = mkdtempSync(join(tmpdir(), 'browser-test-'));

              try {
                // A
                const a1 = factoryA.create({
                  profile: profileDir,
                  scope: 'shared',
                  headless: combo.aHeadless,
                  executablePath: variant.executablePath,
                });
                await a1.ensureReady();
                await factoryA.navigate(a1, TEST_URL);
                const pidA1 = await factoryA.getPid(a1);
                expect(pidA1).toBeDefined();
                await a1.close();
                await waitForProcessExit(pidA1!, 5000);
                expect(hasLockFiles(profileDir)).toBe(false);

                // B
                const b = factoryB.create({
                  profile: profileDir,
                  scope: 'shared',
                  headless: combo.bHeadless,
                  executablePath: variant.executablePath,
                });
                await b.ensureReady();
                await factoryB.navigate(b, TEST_URL);
                const pidB = await factoryB.getPid(b);
                expect(pidB).toBeDefined();
                await b.close();
                await waitForProcessExit(pidB!, 5000);
                expect(hasLockFiles(profileDir)).toBe(false);

                // A again
                const a2 = factoryA.create({
                  profile: profileDir,
                  scope: 'shared',
                  headless: combo.aHeadless,
                  executablePath: variant.executablePath,
                });
                await a2.ensureReady();
                await factoryA.navigate(a2, TEST_URL);
                const pidA2 = await factoryA.getPid(a2);
                expect(pidA2).toBeDefined();
                await a2.close();
                await waitForProcessExit(pidA2!, 5000);
                expect(hasLockFiles(profileDir)).toBe(false);
              } finally {
                rmSync(profileDir, { recursive: true, force: true });
              }
            }, 90_000);

            it('manual close A → programmatic B', async () => {
              const profileDir = mkdtempSync(join(tmpdir(), 'browser-test-'));

              try {
                // A — manual close
                const a = factoryA.create({
                  profile: profileDir,
                  scope: 'shared',
                  headless: combo.aHeadless,
                  executablePath: variant.executablePath,
                });
                await a.ensureReady();
                await factoryA.navigate(a, TEST_URL);
                const pidA = await factoryA.getPid(a);
                expect(pidA).toBeDefined();
                killProcess(pidA!);
                await waitForProcessExit(pidA!, 5000);
                await sleep(1000); // Let disconnect handler clean up
                expect(hasLockFiles(profileDir)).toBe(false);
                try {
                  await a.close();
                } catch {}

                // B — should launch fine
                const b = factoryB.create({
                  profile: profileDir,
                  scope: 'shared',
                  headless: combo.bHeadless,
                  executablePath: variant.executablePath,
                });
                await b.ensureReady();
                await factoryB.navigate(b, TEST_URL);
                const pidB = await factoryB.getPid(b);
                expect(pidB).toBeDefined();
                await b.close();
                await waitForProcessExit(pidB!, 5000);
                expect(hasLockFiles(profileDir)).toBe(false);
              } finally {
                rmSync(profileDir, { recursive: true, force: true });
              }
            }, 60_000);
          });
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Same-Provider Headless↔Headed Switching Tests
// ---------------------------------------------------------------------------

/**
 * Generate tests for switching between headless and headed modes
 * with the same profile within a single provider.
 */
export function createHeadlessSwitchingTests(factory: BrowserFactory) {
  const includeHeaded = process.env.BROWSER_TEST_HEADED === '1';
  if (!includeHeaded) {
    // These tests require headed mode
    describe.skip(`${factory.name}: headless↔headed switching (set BROWSER_TEST_HEADED=1)`, () => {
      it.skip('skipped', () => {});
    });
    return;
  }

  describe(`${factory.name}: headless↔headed switching`, () => {
    afterEach(() => sleep(500));

    it('headless → headed → headless with profile', async () => {
      const profileDir = mkdtempSync(join(tmpdir(), 'browser-test-'));

      try {
        // Headless
        const b1 = factory.create({ profile: profileDir, scope: 'shared', headless: true });
        await b1.ensureReady();
        await factory.navigate(b1, TEST_URL);
        const pid1 = await factory.getPid(b1);
        expect(pid1).toBeDefined();
        await b1.close();
        await waitForProcessExit(pid1!, 5000);
        expect(hasLockFiles(profileDir)).toBe(false);

        // Headed
        const b2 = factory.create({ profile: profileDir, scope: 'shared', headless: false });
        await b2.ensureReady();
        await factory.navigate(b2, TEST_URL);
        const pid2 = await factory.getPid(b2);
        expect(pid2).toBeDefined();
        await b2.close();
        await waitForProcessExit(pid2!, 5000);
        expect(hasLockFiles(profileDir)).toBe(false);

        // Headless again
        const b3 = factory.create({ profile: profileDir, scope: 'shared', headless: true });
        await b3.ensureReady();
        await factory.navigate(b3, TEST_URL);
        const pid3 = await factory.getPid(b3);
        expect(pid3).toBeDefined();
        await b3.close();
        await waitForProcessExit(pid3!, 5000);
        expect(hasLockFiles(profileDir)).toBe(false);
      } finally {
        rmSync(profileDir, { recursive: true, force: true });
      }
    }, 90_000);

    it('headed → headless → headed with profile', async () => {
      const profileDir = mkdtempSync(join(tmpdir(), 'browser-test-'));

      try {
        // Headed
        const b1 = factory.create({ profile: profileDir, scope: 'shared', headless: false });
        await b1.ensureReady();
        await factory.navigate(b1, TEST_URL);
        const pid1 = await factory.getPid(b1);
        expect(pid1).toBeDefined();
        await b1.close();
        await waitForProcessExit(pid1!, 5000);
        expect(hasLockFiles(profileDir)).toBe(false);

        // Headless
        const b2 = factory.create({ profile: profileDir, scope: 'shared', headless: true });
        await b2.ensureReady();
        await factory.navigate(b2, TEST_URL);
        const pid2 = await factory.getPid(b2);
        expect(pid2).toBeDefined();
        await b2.close();
        await waitForProcessExit(pid2!, 5000);
        expect(hasLockFiles(profileDir)).toBe(false);

        // Headed again
        const b3 = factory.create({ profile: profileDir, scope: 'shared', headless: false });
        await b3.ensureReady();
        await factory.navigate(b3, TEST_URL);
        const pid3 = await factory.getPid(b3);
        expect(pid3).toBeDefined();
        await b3.close();
        await waitForProcessExit(pid3!, 5000);
        expect(hasLockFiles(profileDir)).toBe(false);
      } finally {
        rmSync(profileDir, { recursive: true, force: true });
      }
    }, 90_000);

    it('headless → headed without profile (temp)', async () => {
      // Headless
      const b1 = factory.create({ scope: 'shared', headless: true });
      await b1.ensureReady();
      await factory.navigate(b1, TEST_URL);
      const pid1 = await factory.getPid(b1);
      expect(pid1).toBeDefined();
      await b1.close();
      await waitForProcessExit(pid1!, 5000);

      // Headed (fresh temp profile)
      const b2 = factory.create({ scope: 'shared', headless: false });
      await b2.ensureReady();
      await factory.navigate(b2, TEST_URL);
      const pid2 = await factory.getPid(b2);
      expect(pid2).toBeDefined();
      await b2.close();
      await waitForProcessExit(pid2!, 5000);
    }, 60_000);
  });
}
