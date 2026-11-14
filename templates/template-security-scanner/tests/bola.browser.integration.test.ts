import { randomBytes, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { chromium, type Browser } from 'playwright';
import { describe, expect, it } from 'vitest';
import { loadSettings } from '../src/config/settings.js';
import { setup } from '../src/runtime/setup.js';
import { startControlPlane } from '../src/http/server.js';
import { readExampleBoundary, startExampleTransport } from '../example-target-api/transport.js';
import { initializeExampleData } from '../example-target-api/store.js';
import type { BolaModels } from '../src/investigation/bola-models.js';
import type { BolaCandidate } from '../src/investigation/bola-contracts.js';
import type { BolaAssessment } from '../src/investigation/bola-store.js';
import { ownerIdentity, OWNER_LABEL, dockerClient } from '../src/runtime/docker.js';

const baseSettings = loadSettings({
  ...process.env,
  CONTROL_BOOTSTRAP_SECRET: undefined,
  SCANNER_ENCRYPTION_KEY: undefined,
});
const docker = dockerClient(baseSettings);
const filters = { label: [`${OWNER_LABEL}=${ownerIdentity(baseSettings)}`] };
const inventory = async () => ({
  containers: (await docker.listContainers({ all: true, filters })).map(item => item.Id).sort(),
  networks: (await docker.listNetworks({ filters })).map(item => item.Id).sort(),
  images: (await docker.listImages({ all: true, filters })).map(item => item.Id).sort(),
});
const models: BolaModels = {
  async select(candidates: BolaCandidate[], budget) {
    await budget.reserve('sherlock', 1024, 512);
    const chosen = candidates.find(
      item => item.routeTemplate === '/api/orders/{id}' && item.prerequisite === 'collection_detail',
    )!;
    return {
      value: {
        checkerId: 'bola_rest_read',
        candidateId: chosen.id,
        evidenceIds: chosen.evidenceIds,
        rationaleCode: 'OBSERVED_OWNER_DETAIL',
        hypothesis: 'alternate_account_reads_owner_object',
        confidence: 'medium',
        limitations: ['single_object', 'two_accounts', 'bounded_get_only'],
      },
      modelId: 'local-deterministic-sherlock',
      usageTokens: 100,
    };
  },
  async interpret(_proof, policy, budget) {
    expect(policy).toEqual({ objectPolicy: 'owner', expectedUnauthorizedStatus: [401, 403, 404] });
    await budget.reserve('dupin', 512, 256);
    return { value: { outcome: 'CONFIRMED' as const }, modelId: 'local-deterministic-dupin', usageTokens: 50 };
  },
  async review(_proof, policy, budget) {
    expect(policy).toEqual({ objectPolicy: 'owner', expectedUnauthorizedStatus: [401, 403, 404] });
    await budget.reserve('watson', 512, 256);
    return {
      value: { vote: 'agree' as const, reasonCode: 'MATCHED_PRIVATE_RESPONSE' },
      modelId: 'local-deterministic-watson',
      usageTokens: 50,
    };
  },
};

describe('one-button REST assessment in the real console', () => {
  it('configures two account keys and owner rules, starts once, and shows a reviewed finding across ten views', async () => {
    const before = await inventory();
    expect(before.containers).toEqual([]);
    expect(before.networks).toEqual([]);
    const seed = await initializeExampleData(baseSettings.root);
    const example = await startExampleTransport(baseSettings, 'vulnerable');
    const settings = loadSettings(
      {
        DATABASE_URL: `file:./data/bola-browser-${randomUUID()}.db`,
        CONTROL_BOOTSTRAP_SECRET: randomBytes(32).toString('base64url'),
        SCANNER_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
        SCANNER_DISCOVERY_ENABLED: 'true',
        SCANNER_INVESTIGATION_ENABLED: 'true',
      },
      baseSettings.root,
    );
    let server: Awaited<ReturnType<typeof startControlPlane>> | undefined;
    let browser: Browser | undefined;
    try {
      const boundary = await readExampleBoundary(baseSettings);
      expect(boundary).toBeTruthy();
      await setup(settings);
      server = await startControlPlane(settings, 0, undefined, boundary!, undefined, undefined, models);
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      const page = await browser.newPage();
      await page.goto(server.url);
      await page.getByLabel('Bootstrap secret').fill(settings.CONTROL_BOOTSTRAP_SECRET!);
      await page.getByRole('button', { name: 'Sign in' }).click();
      const nav = page.getByRole('navigation', { name: 'Primary' });
      const view = async (name: string) => {
        const dialog = page.getByRole('dialog');
        if (await dialog.count()) {
          await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
          await dialog.waitFor({ state: 'hidden' });
        }
        await nav.getByRole('button', { name, exact: true }).click();
        await page.getByRole('heading', { name, exact: true, level: 1 }).waitFor({ state: 'visible' });
      };
      await view('Policies');
      await page.getByRole('button', { name: 'New policy' }).click();
      const policy = page.getByRole('dialog', { name: 'New policy' });
      await policy.getByLabel('Name').fill('Browser owned orders');
      await policy.getByLabel('Permitted methods').fill('GET, HEAD');
      await policy.getByLabel('Maximum requests').fill('40');
      await policy.getByLabel('Duration, seconds').fill('90');
      await policy.getByLabel('Response bytes').fill('131072');
      await policy.getByLabel('Concurrency').fill('1');
      await policy.getByLabel('Evidence retention, days').fill('1');
      await policy.getByLabel('Approved by').fill('browser fixture operator');
      await policy.getByRole('button', { name: 'Save policy' }).click();
      await policy.waitFor({ state: 'hidden' });

      await view('Targets');
      await page.getByRole('button', { name: 'New target' }).click();
      const target = page.getByRole('dialog', { name: 'New target' });
      const origin = `http://${boundary!.address}:18080`;
      await target.getByLabel('Name').fill('Browser vulnerable orders');
      await target.getByLabel('Entry URL').fill(`${origin}/api/orders`);
      await target.getByLabel('Application').selectOption('rest_api');
      await target.getByLabel('OpenAPI URL (optional)').fill(`${origin}/openapi.json`);
      await target.locator('select[name="policy"]').selectOption({ label: 'Browser owned orders · r1' });
      await target.getByLabel('Allowed paths, one per line').fill('/api\n/openapi.json');
      await target.getByLabel('Authorization evidence reference').fill('operator:browser-owned-fixture');
      await target.getByLabel('I confirm authorization to scan this target.').check();
      await target.getByRole('button', { name: 'Save target' }).click();
      await target.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Browser vulnerable orders' }).click();
      await page.getByRole('heading', { name: 'REST access rules' }).waitFor({ state: 'visible' });
      await page.getByText('/api/orders/{id}/receipt', { exact: true }).waitFor({ state: 'visible' });

      for (const [index, user] of seed.users.entries()) {
        await page.getByRole('button', { name: 'Add profile' }).click();
        const profile = page.getByRole('dialog', { name: 'Add profile' });
        await profile.getByLabel('Name').fill(`Browser user ${index + 1}`);
        await profile.getByLabel('Role').fill(`user${index + 1}`);
        await profile.getByLabel('Identity type').selectOption('api_key_header');
        await profile.getByLabel('Account identifier JSON pointer (optional)').fill('/principal');
        await profile.locator('input[name="credential"]').fill(user.key);
        await profile.getByRole('button', { name: 'Save profile' }).click();
        await profile.waitFor({ state: 'hidden' });
      }
      for (const index of [0, 1]) {
        const row = page.getByRole('row').filter({ hasText: `Browser user ${index + 1}` });
        await row.getByRole('button', { name: 'Check identity' }).click();
        await row.getByText('READY', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
      }
      const start = page.getByRole('button', { name: 'Start REST assessment' });
      for (let attempt = 0; attempt < 50 && !(await start.isEnabled()); attempt++)
        await new Promise(resolve => setTimeout(resolve, 100));
      expect(await start.isEnabled(), JSON.stringify(await page.getByRole('row').allTextContents())).toBe(true);
      await start.click();
      await page.getByText('Assessment started:', { exact: false }).waitFor({ state: 'visible' });
      const marker = await page.getByText('Assessment started:', { exact: false }).textContent();
      expect(marker).toContain('View its progress in Scans.');
      let assessment: BolaAssessment | undefined;
      for (let attempt = 0; attempt < 700; attempt++) {
        const response = await page.request.get(`${server.url}/api/assessments?limit=25&offset=0`);
        expect(response.status()).toBe(200);
        assessment = ((await response.json()) as { items: BolaAssessment[] }).items[0];
        if (assessment && ['COMPLETED', 'BLOCKED'].includes(assessment.state)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(assessment?.state, assessment?.reason ?? undefined).toBe('COMPLETED');
      expect(assessment?.outcome).toBe('CONFIRMED');
      expect(assessment?.findingId).toBeTruthy();
      expect(assessment?.candidates.length).toBeGreaterThanOrEqual(2);
      await view('Scans');
      await page.getByRole('button', { name: assessment!.id.slice(0, 8), exact: true }).click();
      const result = page.getByRole('dialog', { name: `Assessment ${assessment!.id.slice(0, 8)}` });
      await result.waitFor({ state: 'visible' });
      await result.getByRole('heading', { name: 'Unauthorized access confirmed', exact: true }).waitFor();
      const comparison = result.getByRole('region', { name: 'Account comparison' });
      const field = (name: string) =>
        comparison.locator('dl > div').filter({ has: page.getByText(name, { exact: true }) });
      expect(await field('Owner account').textContent()).toContain(`HTTP ${assessment!.proof!.ownerStatus}`);
      expect(await field('Alternate account').textContent()).toContain(`HTTP ${assessment!.proof!.alternateStatus}`);
      expect(await field('Same private response').textContent()).toContain('Yes');
      expect(await field('Proof complete').textContent()).toContain('Yes');
      expect(await field('Gateway requests').textContent()).toContain(String(assessment!.proof!.requestCount));
      await result.getByText('bola_rest_read', { exact: true }).waitFor();
      await result.getByText(assessment!.findingId!, { exact: true }).waitFor();
      await result.getByText('Analysis & model details', { exact: true }).click();
      await result.getByText('local-deterministic-watson', { exact: true }).waitFor();
      await result.getByText(`Observed candidates (${assessment!.candidates.length})`, { exact: true }).click();
      expect(await result.getByRole('listitem').filter({ hasText: 'Collection → detail' }).count()).toBeGreaterThan(0);
      await view('Findings');
      await page.getByText(assessment!.findingId!, { exact: true }).waitFor({ state: 'visible' });
      for (const name of [
        'Overview',
        'Policies',
        'Targets',
        'Scans',
        'Agents',
        'Vulnerabilities',
        'Evaluations',
        'Approvals',
        'Findings',
        'Settings',
      ])
        await view(name);
      const body = await page.locator('body').textContent();
      expect(body).not.toContain(seed.users[0].key);
      expect(body).not.toContain(seed.users[1].key);
    } finally {
      await browser?.close();
      await server?.close();
      await example.close();
      for (const path of [settings.databasePath, settings.mastraDatabasePath])
        for (const suffix of ['', '-wal', '-shm']) await rm(`${path}${suffix}`, { force: true });
    }
    expect(await inventory()).toEqual(before);
  }, 300_000);
});
