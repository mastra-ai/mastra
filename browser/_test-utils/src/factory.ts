/**
 * Browser profile lifecycle test factory.
 *
 * Exports config matrix and test generators that each provider imports.
 * Cross-provider tests live in the shared _test-utils package.
 */
import { execSync } from 'node:child_process';
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
  create(config: { profile?: string; scope: 'shared' | 'thread'; headless: boolean }): MastraBrowser;
  /** Navigate to a URL */
  navigate(browser: MastraBrowser, url: string, threadId?: string): Promise<void>;
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

function countAllChromeProcesses(): number {
  try {
    const out = execSync('ps aux | grep -cE "[C]hrom|[c]hrome-headless"', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    return parseInt(out, 10) || 0;
  } catch {
    return 0;
  }
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

function findChromePidByProfile(profileDir: string): number | undefined {
  try {
    const escaped = profileDir.replace(/\//g, '\\/');
    const out = execSync(
      `ps aux | grep -E "[C]hrom|[c]hrome-headless" | grep "${escaped}" | grep -v "helper" | head -1 | awk '{print $2}'`,
      { encoding: 'utf-8', timeout: 5000 },
    ).trim();
    return out ? parseInt(out, 10) : undefined;
  } catch {
    return undefined;
  }
}

function killMainChromeProcess(pid: number): void {
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
        it('programmatic close — no orphans, cleans up', async () => {
          const profileDir = config.profile ? mkdtempSync(join(tmpdir(), 'browser-test-')) : undefined;

          try {
            const before = countAllChromeProcesses();
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
            expect(countAllChromeProcesses()).toBeGreaterThan(before);

            // Close
            if (config.scope === 'thread') {
              await browser.closeThreadSession(THREAD_ID);
            } else {
              await browser.close();
            }
            await sleep(1000);

            // Verify cleanup
            expect(countAllChromeProcesses()).toBe(before);
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

        it('manual close — no orphans, cleans up', async () => {
          const profileDir = config.profile ? mkdtempSync(join(tmpdir(), 'browser-test-')) : undefined;

          try {
            const before = countAllChromeProcesses();
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

            // Find and kill Chrome process
            // For no-profile, we can't find by profile dir, so skip the kill test
            if (profileDir) {
              const pid = findChromePidByProfile(profileDir);
              expect(pid).toBeDefined();
              killMainChromeProcess(pid!);
              await sleep(3000);

              // Verify cleanup
              expect(countAllChromeProcesses()).toBe(before);
              expect(hasLockFiles(profileDir)).toBe(false);
              const exitType = getExitType(profileDir);
              if (exitType !== undefined) {
                expect(exitType).toBe('Normal');
              }
            } else {
              // No profile — just close normally, we can't test manual kill
              await browser.close();
              await sleep(1000);
              expect(countAllChromeProcesses()).toBe(before);
            }

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
 */
export function createCrossProviderTests(factoryA: BrowserFactory, factoryB: BrowserFactory) {
  const includeHeaded = process.env.BROWSER_TEST_HEADED === '1';

  // Filter combos based on env
  const activeCombos = ALL_HEADLESS_COMBOS.filter(
    c => (c.aHeadless && c.bHeadless) || includeHeaded,
  );

  describe(`Cross-provider: ${factoryA.name} ↔ ${factoryB.name}`, () => {
    afterEach(() => sleep(500));

    for (const combo of activeCombos) {
      describe(combo.label, () => {
        it('A → B → A with shared profile', async () => {
          const profileDir = mkdtempSync(join(tmpdir(), 'browser-test-'));

          try {
            // A
            const a1 = factoryA.create({ profile: profileDir, scope: 'shared', headless: combo.aHeadless });
            await a1.ensureReady();
            await factoryA.navigate(a1, TEST_URL);
            await a1.close();
            await sleep(1000);
            expect(hasLockFiles(profileDir)).toBe(false);

            // B
            const b = factoryB.create({ profile: profileDir, scope: 'shared', headless: combo.bHeadless });
            await b.ensureReady();
            await factoryB.navigate(b, TEST_URL);
            await b.close();
            await sleep(1000);
            expect(hasLockFiles(profileDir)).toBe(false);

            // A again
            const a2 = factoryA.create({ profile: profileDir, scope: 'shared', headless: combo.aHeadless });
            await a2.ensureReady();
            await factoryA.navigate(a2, TEST_URL);
            await a2.close();
            await sleep(1000);
            expect(hasLockFiles(profileDir)).toBe(false);
          } finally {
            rmSync(profileDir, { recursive: true, force: true });
          }
        }, 90_000);

        it('manual close A → programmatic B', async () => {
          const profileDir = mkdtempSync(join(tmpdir(), 'browser-test-'));

          try {
            // A — manual close
            const a = factoryA.create({ profile: profileDir, scope: 'shared', headless: combo.aHeadless });
            await a.ensureReady();
            await factoryA.navigate(a, TEST_URL);
            const pid = findChromePidByProfile(profileDir);
            expect(pid).toBeDefined();
            killMainChromeProcess(pid!);
            await sleep(3000);
            expect(hasLockFiles(profileDir)).toBe(false);
            try {
              await a.close();
            } catch {}

            // B — should launch fine
            const b = factoryB.create({ profile: profileDir, scope: 'shared', headless: combo.bHeadless });
            await b.ensureReady();
            await factoryB.navigate(b, TEST_URL);
            await b.close();
            await sleep(1000);
            expect(hasLockFiles(profileDir)).toBe(false);
          } finally {
            rmSync(profileDir, { recursive: true, force: true });
          }
        }, 60_000);
      });
    }
  });
}
