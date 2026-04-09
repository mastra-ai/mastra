/**
 * Integration tests for browser profile lifecycle.
 *
 * Tests both providers (Stagehand, AgentBrowser) with and without profiles,
 * verifying clean launch, navigation, close, and process cleanup.
 *
 * Covers both programmatic close and manual close (simulated by killing
 * the main Chrome process, as if the user clicked the X button).
 *
 * Also tests switching providers with the same shared profile.
 *
 * These tests launch real browsers — skip if Chromium is not available.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AgentBrowser } from '@mastra/agent-browser';
import { StagehandBrowser } from '@mastra/stagehand';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_HTML = 'data:text/html,<h1>Test</h1>';

/**
 * Count all Chrome/Chromium processes including Playwright's headless shell.
 *
 * Stagehand uses chrome-launcher → Google Chrome (matches "[C]hrom")
 * AgentBrowser uses Playwright → chrome-headless-shell (matches "[c]hrome-headless")
 *
 * We count all and compare before/after. Tests run sequentially so the delta
 * is exactly one browser's worth of processes.
 */
function countAllChromeProcesses(): number {
  try {
    const out = execSync('ps aux | grep -cE "[C]hrom|[c]hrome-headless"', { encoding: 'utf-8', timeout: 5000 }).trim();
    return parseInt(out, 10) || 0;
  } catch {
    return 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const CHROME_LOCK_FILES = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];

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

/**
 * Find the main Chrome process PID using a profile directory.
 * Works for both Stagehand (chrome-launcher) and AgentBrowser (Playwright).
 */
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

/**
 * Simulate a manual browser close by killing the main Chrome process.
 * This is what happens when the user clicks the X button on the browser window.
 */
function killMainChromeProcess(pid: number): void {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Process may already be gone
  }
}

async function navigateStagehand(browser: StagehandBrowser, url: string) {
  const result = await browser.navigate({ url });
  if ('error' in result) throw new Error(`Navigate failed: ${result.error}`);
  return result;
}

async function navigateAgentBrowser(browser: AgentBrowser, url: string) {
  const result = await browser.goto({ url });
  if ('error' in result) throw new Error(`Goto failed: ${result.error}`);
  return result;
}

// ---------------------------------------------------------------------------
// Environment check — skip all tests if we can't launch a browser
// ---------------------------------------------------------------------------

let canLaunchBrowser = true;
const probe = new AgentBrowser({ headless: true, scope: 'shared' });
try {
  await probe.ensureReady();
  await probe.close();
} catch (error) {
  try {
    await probe.close();
  } catch {}
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes("Executable doesn't exist") ||
    msg.includes('browserType.launch') ||
    msg.includes('Cannot find module') ||
    msg.includes('ENOENT')
  ) {
    canLaunchBrowser = false;
  } else {
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!canLaunchBrowser)('Browser profile lifecycle', () => {
  let profileDir: string;

  beforeAll(() => {
    profileDir = mkdtempSync(join(tmpdir(), 'browser-profile-test-'));
  });

  afterAll(() => {
    rmSync(profileDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await sleep(500);
  });

  // =========================================================================
  // Programmatic close (browser.close())
  // =========================================================================
  describe('programmatic close', () => {
    it('Stagehand without profile — clean close, no orphans', async () => {
      const before = countAllChromeProcesses();

      const browser = new StagehandBrowser({ headless: true, scope: 'shared' });
      await browser.ensureReady();
      await navigateStagehand(browser, TEST_HTML);

      const during = countAllChromeProcesses();
      expect(during).toBeGreaterThan(before);

      await browser.close();
      await sleep(1000);

      expect(countAllChromeProcesses()).toBe(before);
    }, 30_000);

    it('AgentBrowser without profile — clean close, no orphans', async () => {
      const before = countAllChromeProcesses();

      const browser = new AgentBrowser({ headless: true, scope: 'shared' });
      await browser.ensureReady();
      await navigateAgentBrowser(browser, TEST_HTML);

      const during = countAllChromeProcesses();
      expect(during).toBeGreaterThan(before);

      await browser.close();
      await sleep(1000);

      expect(countAllChromeProcesses()).toBe(before);
    }, 30_000);

    it('Stagehand with profile — no lock files, exit_type Normal', async () => {
      const browser = new StagehandBrowser({
        headless: true,
        scope: 'shared',
        profile: profileDir,
      });
      await browser.ensureReady();
      await navigateStagehand(browser, TEST_HTML);

      await browser.close();
      await sleep(1000);

      expect(hasLockFiles(profileDir)).toBe(false);
      const exitType = getExitType(profileDir);
      if (exitType !== undefined) {
        expect(exitType).toBe('Normal');
      }
    }, 30_000);

    it('AgentBrowser with profile — no lock files, exit_type Normal', async () => {
      const browser = new AgentBrowser({
        headless: true,
        scope: 'shared',
        profile: profileDir,
      });
      await browser.ensureReady();
      await navigateAgentBrowser(browser, TEST_HTML);

      await browser.close();
      await sleep(1000);

      expect(hasLockFiles(profileDir)).toBe(false);
      const exitType = getExitType(profileDir);
      if (exitType !== undefined) {
        expect(exitType).toBe('Normal');
      }
    }, 30_000);
  });

  // =========================================================================
  // Manual close (kill main Chrome process, simulating user clicking X)
  // =========================================================================
  describe('manual close (kill Chrome process)', () => {
    it('Stagehand with profile — cleans up lock files and patches exit_type', async () => {
      const browser = new StagehandBrowser({
        headless: true,
        scope: 'shared',
        profile: profileDir,
      });
      await browser.ensureReady();
      await navigateStagehand(browser, TEST_HTML);

      const pid = findChromePidByProfile(profileDir);
      expect(pid).toBeDefined();

      // Kill main Chrome process — simulates clicking X
      killMainChromeProcess(pid!);

      // Wait for disconnect handler to fire and clean up
      await sleep(3000);

      expect(hasLockFiles(profileDir)).toBe(false);
      const exitType = getExitType(profileDir);
      if (exitType !== undefined) {
        expect(exitType).toBe('Normal');
      }

      // Clean up the browser object (should be a no-op since Chrome is gone)
      try {
        await browser.close();
      } catch {}
    }, 30_000);

    it('AgentBrowser with profile — cleans up lock files', async () => {
      const browser = new AgentBrowser({
        headless: true,
        scope: 'shared',
        profile: profileDir,
      });
      await browser.ensureReady();
      await navigateAgentBrowser(browser, TEST_HTML);

      const pid = findChromePidByProfile(profileDir);
      expect(pid).toBeDefined();

      // Kill main Chrome process — simulates clicking X
      killMainChromeProcess(pid!);

      // Wait for disconnect handler to fire and clean up
      await sleep(3000);

      expect(hasLockFiles(profileDir)).toBe(false);
      const exitType = getExitType(profileDir);
      if (exitType !== undefined) {
        expect(exitType).toBe('Normal');
      }

      // Clean up the browser object
      try {
        await browser.close();
      } catch {}
    }, 30_000);
  });

  // =========================================================================
  // Provider switching with shared profile
  // =========================================================================
  describe('provider switching with shared profile', () => {
    it('Stagehand → AgentBrowser → Stagehand — same profile, no conflicts', async () => {
      // Round 1: Stagehand
      const sh1 = new StagehandBrowser({
        headless: true,
        scope: 'shared',
        profile: profileDir,
      });
      await sh1.ensureReady();
      await navigateStagehand(sh1, TEST_HTML);
      await sh1.close();
      await sleep(1000);
      expect(hasLockFiles(profileDir)).toBe(false);

      // Round 2: AgentBrowser with same profile
      const ab = new AgentBrowser({
        headless: true,
        scope: 'shared',
        profile: profileDir,
      });
      await ab.ensureReady();
      await navigateAgentBrowser(ab, TEST_HTML);
      await ab.close();
      await sleep(1000);
      expect(hasLockFiles(profileDir)).toBe(false);

      // Round 3: Back to Stagehand
      const sh2 = new StagehandBrowser({
        headless: true,
        scope: 'shared',
        profile: profileDir,
      });
      await sh2.ensureReady();
      await navigateStagehand(sh2, TEST_HTML);
      await sh2.close();
      await sleep(1000);
      expect(hasLockFiles(profileDir)).toBe(false);

      const exitType = getExitType(profileDir);
      if (exitType !== undefined) {
        expect(exitType).toBe('Normal');
      }
    }, 90_000);

    it('manual close Stagehand → AgentBrowser with same profile', async () => {
      // Stagehand: launch, manual close
      const sh = new StagehandBrowser({
        headless: true,
        scope: 'shared',
        profile: profileDir,
      });
      await sh.ensureReady();
      await navigateStagehand(sh, TEST_HTML);

      const shPid = findChromePidByProfile(profileDir);
      expect(shPid).toBeDefined();
      killMainChromeProcess(shPid!);
      await sleep(3000);
      expect(hasLockFiles(profileDir)).toBe(false);
      try {
        await sh.close();
      } catch {}

      // AgentBrowser: should launch fine with the same profile
      const ab = new AgentBrowser({
        headless: true,
        scope: 'shared',
        profile: profileDir,
      });
      await ab.ensureReady();
      await navigateAgentBrowser(ab, TEST_HTML);
      await ab.close();
      await sleep(1000);
      expect(hasLockFiles(profileDir)).toBe(false);
    }, 60_000);
  });
});
