import { createServer, type Server } from 'node:http';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type ConsoleMessage, type Locator, type Page } from 'playwright';
import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { AdvisorySource } from '../src/advisory/source.js';
import { loadSettings } from '../src/config/settings.js';
import { hypothesisSchema } from '../src/investigation/contracts.js';
import type { InvestigationModels, ModelBudget, ModelCall } from '../src/investigation/models.js';
import { startControlPlane } from '../src/http/server.js';
import { closeDiscoveryLabs, discoveryCase, startDiscoveryLab } from './lab/harness.js';

const root = resolve(import.meta.dirname, '..');
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  const failures: unknown[] = [];
  try {
    await closeDiscoveryLabs();
  } catch (error) {
    failures.push(error);
  }
  for (const close of cleanup.splice(0).reverse()) {
    try {
      await close();
    } catch (error) {
      failures.push(error);
    }
  }
  expect(failures).toEqual([]);
});

function listen(server: Server) {
  return new Promise<string>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') reject(new Error('FIXTURE_ADDRESS_MISSING'));
      else resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
}

async function modelWire() {
  const received: string[] = [];
  const proposalInput = z
    .object({
      kind: z.literal('propose'),
      scanId: z.string().uuid(),
      evidence: z.array(
        z
          .object({
            id: z.string().uuid(),
            observation: z.object({ kind: z.string(), path: z.string() }).passthrough(),
          })
          .passthrough(),
      ),
      playbooks: z.array(
        z.object({ category: z.string(), toolId: z.string(), references: z.array(z.string()) }).passthrough(),
      ),
    })
    .passthrough();
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    received.push(body);
    const kind = z
      .object({ kind: z.enum(['propose', 'interpret', 'review']) })
      .passthrough()
      .parse(JSON.parse(body)).kind;
    let value: unknown;
    if (kind === 'propose') {
      const input = proposalInput.parse(JSON.parse(body));
      const evidence = input.evidence.find(
        item => item.observation.kind === 'form' && item.observation.path === '/owned/ssrf/vulnerable',
      );
      const playbook = input.playbooks.find(item => item.category === 'ssrf');
      value =
        evidence && playbook?.references[0]
          ? [
              {
                origin: 'playbook',
                category: 'ssrf',
                toolId: playbook.toolId,
                scanId: input.scanId,
                evidenceIds: [evidence.id],
                referenceIds: [playbook.references[0]],
                preconditions: [],
                expectedBehavior: 'The owned callback is reached only through the approved destination.',
                risk: 'active',
                maxRequests: 1,
                maxDurationSeconds: 15,
                maxTokens: 128,
                maxRefinements: 0,
              },
            ]
          : [];
    } else if (kind === 'interpret') value = { category: 'ssrf', outcome: 'CONFIRMED' };
    else value = { vote: 'agree', reasonCode: 'OWNED_WIRE_EVIDENCE' };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        value,
        modelId: kind === 'review' ? 'morph/morph-glm53-744b' : 'morph-dsv41flash-abliterated',
        usageTokens: 8,
      }),
    );
  });
  const url = await listen(server);
  cleanup.push(() => closeServer(server));
  /** Reserve allowance and send a real local model-wire request, then validate its response schema. */
  async function call<T>(
    role: 'sherlock' | 'dupin' | 'watson',
    input: object,
    schema: z.ZodType<T>,
    budget: ModelBudget,
    signal: AbortSignal,
  ): Promise<ModelCall<T>> {
    const body = JSON.stringify(input);
    await budget.reserve(role, Buffer.byteLength(body), 128);
    signal.throwIfAborted();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal,
    });
    if (!response.ok) throw new Error('LOCAL_MODEL_WIRE_UNAVAILABLE');
    return z
      .object({ value: schema, modelId: z.string(), usageTokens: z.number().nullable() })
      .parse(await response.json());
  }
  const models: InvestigationModels = {
    propose: (scanId, evidence, playbooks, advisories, _planningLimits, _limit, _timeout, budget, signal) =>
      call(
        'sherlock',
        { kind: 'propose', scanId, evidence, playbooks, advisories },
        hypothesisSchema.array(),
        budget,
        signal,
      ),
    interpret: (proof, playbook, _timeout, budget, signal) =>
      call(
        'dupin',
        { kind: 'interpret', proof, playbook },
        z.object({ category: z.string(), outcome: z.literal('CONFIRMED') }),
        budget,
        signal,
      ),
    review: (proof, playbook, _timeout, budget, signal) =>
      call(
        'watson',
        { kind: 'review', proof, playbook },
        z.object({ vote: z.literal('agree'), reasonCode: z.string() }),
        budget,
        signal,
      ),
  };
  return { models, received };
}

async function advisoryWire() {
  const id = 'CVE-2026-42420';
  const detail = {
    id,
    aliases: [],
    status: 'published',
    title: 'Owned lab advisory',
    originalDescription: 'Controlled advisory description from the owned fixture.',
    affected: [{ vendor: 'LabVendor', product: 'LabWidget', ranges: [] }],
    sources: [{ name: 'Owned fixture', url: 'https://example.invalid/advisory', license: 'fixture' }],
    modifiedAt: '2026-10-29T12:00:00.000Z',
  };
  const server = createServer((request, response) => {
    const path = request.url ?? '/';
    const body =
      path === '/api/v1/status'
        ? { polling: {}, history: {}, backfill: {}, storage: {} }
        : path === '/api/v1/entries'
          ? { entries: [{ id }], nextCursor: null }
          : path === `/api/v1/entries/${id}`
            ? detail
            : undefined;
    response.writeHead(body ? 200 : 404, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body ?? {}));
  });
  const url = await listen(server);
  cleanup.push(() => closeServer(server));
  return { id, source: new AdvisorySource(url, true) };
}

async function browser(url: string) {
  const instance = await chromium.launch({ channel: 'chrome', headless: true });
  cleanup.push(() => instance.close());
  const context = await instance.newContext({ serviceWorkers: 'block' });
  cleanup.push(() => context.close());
  const page = await context.newPage();
  await page.goto(url);
  return { instance, context, page };
}

async function visible(locator: Locator) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  expect(await locator.isVisible()).toBe(true);
}

async function navigate(page: Page, view: string) {
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: view, exact: true }).click();
  await visible(page.getByRole('main').getByRole('heading', { name: view, exact: true, level: 1 }));
}

async function loginConsole(page: Page, secret: string) {
  await visible(page.getByLabel('Bootstrap secret'));
  await page.getByLabel('Bootstrap secret').fill(secret);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await visible(page.getByRole('heading', { name: 'Overview', exact: true, level: 1 }));
}

async function noCredentialInBrowser(page: Page, marker: string) {
  const snapshot = await page.evaluate(() => ({
    body: document.body.textContent,
    fields: Array.from(document.querySelectorAll('input')).map(input => input.value),
    url: location.href,
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(JSON.stringify(snapshot)).not.toContain(marker);
}

/** Poll a real asynchronous browser-side condition within the bounded attempt limit. */
async function waitFor<T>(read: () => Promise<T | undefined>, attempts = 120): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = await read();
    if (result !== undefined) return result;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('PERSISTED_STATE_NOT_OBSERVED');
}

async function localConsole() {
  const folder = await mkdtemp(join(tmpdir(), 'scanner-console-session-'));
  cleanup.push(() => rm(folder, { recursive: true, force: true }));
  await mkdir(join(folder, 'web'), { recursive: true });
  await cp(join(root, 'web', 'dist'), join(folder, 'web', 'dist'), { recursive: true });
  const secret = 'owned_console_session_secret_123456789';
  const running = await startControlPlane(
    loadSettings({ CONTROL_BOOTSTRAP_SECRET: secret, SCANNER_ENCRYPTION_KEY: 'ab'.repeat(32) }, folder),
    0,
  );
  cleanup.push(running.close);
  return { url: running.url, secret };
}

describe('real security console browser journeys', () => {
  it('reconfirms REST route revisions after each supported profile form submission', async () => {
    const { url, secret } = await localConsole();
    const { page } = await browser(url);
    page.setDefaultTimeout(5000);
    await loginConsole(page, secret);
    const session = await (await page.request.get(`${url}/api/session`)).json();
    const headers = { origin: url, 'x-csrf-token': session.csrfToken };
    const scanLimits = { maxRequests: 10, maxDurationSeconds: 30, maxResponseBytes: 65536, maxConcurrency: 1 };
    const policyResponse = await page.request.post(`${url}/api/policies`, {
      headers,
      data: { name: 'REST profile policy', permittedMethods: ['GET'], scanLimits },
    });
    expect(policyResponse.status()).toBe(201);
    const policy = await policyResponse.json();
    const created = await page.request.post(`${url}/api/targets`, {
      headers,
      data: {
        name: 'REST profile revisions',
        entryUrl: 'http://allowed.lab/api/orders',
        approvedOrigins: ['http://allowed.lab'],
        allowedPaths: ['/api'],
        excludedPaths: [],
        permittedMethods: ['GET'],
        environment: 'lab',
        authorizationEvidenceRef: 'operator:owned-browser-fixture',
        authorizationConfirmed: true,
        policyId: policy.id,
        policyRevision: policy.revision,
        schedule: { enabled: false, timezone: 'America/Sao_Paulo' },
        scanLimits,
        authProfileIds: [],
        application: { kind: 'rest_api', version: 1, discoveryModes: ['observed_json'] },
        authenticationDrivers: [],
        routeAccessRules: [
          {
            version: 1,
            method: 'GET',
            pathTemplate: '/api/orders',
            source: 'operator',
            operatorRevision: 1,
            audience: 'public',
            expectedUnauthorizedStatus: [],
          },
          {
            version: 1,
            method: 'GET',
            pathTemplate: '/api/products',
            source: 'openapi_suggestion',
            audience: 'public',
            expectedUnauthorizedStatus: [],
          },
        ],
      },
    });
    expect(created.status()).toBe(201);
    const target = await created.json();
    await navigate(page, 'Targets');
    const targetLink = page.getByRole('button', { name: target.name, exact: true });
    await targetLink.click();
    const details = page.getByRole('dialog', { name: target.name, exact: true });
    await visible(details);
    expect(await details.evaluate(element => element.matches(':modal'))).toBe(true);
    for (const kind of ['public', 'bearer', 'header']) {
      await page.getByRole('button', { name: 'Add profile' }).click();
      const form = page.getByRole('dialog', { name: 'Add profile' });
      await form.getByLabel('Name').fill(`${kind} account`);
      await form.getByLabel('Role').fill(kind);
      await form.getByLabel('Identity type').selectOption(kind);
      if (kind !== 'public') {
        await form.getByLabel('Identity endpoint').fill('http://allowed.lab/api/identity');
        await form.getByLabel('Expected identity').fill(`${kind}-account`);
        if (kind === 'header') await form.getByLabel('Header name').selectOption('x-api-key');
        await form.getByLabel('Credential', { exact: true }).fill('owned-local-test-value');
      }
      await form.getByRole('button', { name: 'Save profile' }).click();
      await form.waitFor({ state: 'hidden' });
      const read = await page.request.get(`${url}/api/targets/${target.id}`);
      expect(read.status()).toBe(200);
      const current = await read.json();
      expect(
        current.routeAccessRules
          .filter((rule: { source: string }) => rule.source === 'operator')
          .map((rule: { operatorRevision: number }) => rule.operatorRevision),
      ).toEqual([current.revision]);
      expect(
        current.routeAccessRules.filter((rule: { source: string }) => rule.source === 'openapi_suggestion'),
      ).toEqual([target.routeAccessRules[1]]);
      expect(current.schedule).toEqual(target.schedule);
      expect(current.authenticationDrivers).toEqual([]);
    }
    await details.getByRole('button', { name: 'Add profile' }).click();
    const nested = page.getByRole('dialog', { name: 'Add profile', exact: true });
    await visible(nested);
    await page.keyboard.press('Escape');
    await nested.waitFor({ state: 'hidden' });
    expect(
      await details
        .getByRole('button', { name: 'Add profile' })
        .evaluate(element => element === document.activeElement),
    ).toBe(true);
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 640 },
    ]) {
      await page.setViewportSize(viewport);
      const bounds = await details.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      await page.keyboard.press('Escape');
      await details.waitFor({ state: 'hidden' });
      expect(await targetLink.evaluate(element => element === document.activeElement)).toBe(true);
      await targetLink.click();
      await visible(details);
    }
    await details.getByRole('button', { name: 'Close dialog' }).click();
    await details.waitFor({ state: 'hidden' });
    expect(await targetLink.evaluate(element => element === document.activeElement)).toBe(true);
  }, 45000);

  it('edits unauthorized status codes character by character and persists submit without blur', async () => {
    const { url, secret } = await localConsole();
    const { page } = await browser(url);
    page.setDefaultTimeout(5000);
    await loginConsole(page, secret);
    const { csrfToken } = z
      .object({ csrfToken: z.string() })
      .parse(await (await page.request.get(`${url}/api/session`)).json());
    const policyResponse = await page.request.post(`${url}/api/policies`, {
      headers: { origin: url, 'x-csrf-token': csrfToken },
      data: {
        name: 'Editable route policy',
        permittedMethods: ['GET', 'HEAD'],
        scanLimits: { maxRequests: 10, maxDurationSeconds: 30, maxResponseBytes: 65536, maxConcurrency: 1 },
      },
    });
    expect(policyResponse.status()).toBe(201);
    const policy = z.object({ id: z.string() }).parse(await policyResponse.json());
    await navigate(page, 'Targets');
    await page.getByRole('button', { name: 'New target' }).click();
    const form = page.getByRole('dialog', { name: 'New target' });
    await form.getByLabel('Name').fill('Editable route statuses');
    await form.getByLabel('Entry URL').fill('http://allowed.lab:18080/api/orders');
    await form.getByLabel('Application').selectOption('rest_api');
    await form.locator('select[name="policy"]').selectOption(policy.id);
    await form.getByLabel('Authorization evidence reference').fill('operator:owned-browser-fixture');
    await form.getByLabel('I confirm authorization to scan this target.').check();
    const first = form.getByLabel('Unauthorized status 1', { exact: true });
    await first.focus();
    await first.press('End');
    await first.pressSequentially(',404');
    expect(await first.inputValue()).toBe('401,403,404');
    await first.press('Tab');
    await form.getByRole('button', { name: 'Add route rule' }).click();
    await form.getByLabel('Route 5', { exact: true }).fill('/api/extra/{id}');
    const added = form.getByLabel('Unauthorized status 5', { exact: true });
    await added.fill('');
    await added.pressSequentially('4');
    expect(await added.inputValue()).toBe('4');
    await added.pressSequentially('04,403.5,399,500,,401');
    expect(await added.inputValue()).toBe('404,403.5,399,500,,401');
    await added.press('Tab');
    expect(await added.inputValue()).toBe('404,401');
    expect(await form.getByLabel('Unauthorized status 4', { exact: true }).isDisabled()).toBe(true);
    const second = form.getByLabel('Unauthorized status 2', { exact: true });
    await second.fill('');
    await second.pressSequentially('418');
    const saved = page.waitForResponse(
      response => response.url() === `${url}/api/targets` && response.request().method() === 'POST',
    );
    await second.press('Enter');
    const response = await saved;
    expect(response.status()).toBe(201);
    const targetSchema = z.object({
      id: z.string(),
      routeAccessRules: z.array(
        z.object({ pathTemplate: z.string(), expectedUnauthorizedStatus: z.array(z.number()) }),
      ),
    });
    const target = targetSchema.parse(await response.json());
    expect(target.routeAccessRules.map(rule => rule.expectedUnauthorizedStatus)).toEqual([
      [401, 403, 404],
      [418],
      [401, 403, 404],
      [],
      [404, 401],
    ]);
    await form.waitFor({ state: 'hidden' });
    await page.reload();
    const persisted = targetSchema.parse(await (await page.request.get(`${url}/api/targets/${target.id}`)).json());
    expect(persisted.routeAccessRules).toEqual(target.routeAccessRules);
    await navigate(page, 'Targets');
    await page
      .getByRole('row')
      .filter({ hasText: 'Editable route statuses' })
      .getByRole('button', { name: 'Edit', exact: true })
      .click();
    const edit = page.getByRole('dialog', { name: 'Edit target' });
    expect(await edit.getByLabel('Unauthorized status 2', { exact: true }).inputValue()).toBe('418');
    expect(await edit.getByLabel('Unauthorized status 5', { exact: true }).inputValue()).toBe('404,401');
  }, 30000);

  it('explains a revoked session after reload without implying a first-time visitor signed in', async () => {
    const { url, secret } = await localConsole();
    const { page } = await browser(url);
    await visible(page.getByLabel('Bootstrap secret'));
    expect(await page.getByRole('alert').count()).toBe(0);
    await loginConsole(page, secret);

    const active = z
      .object({ csrfToken: z.string() })
      .parse(await (await page.request.get(`${url}/api/session`)).json());
    const revoked = await page.request.delete(`${url}/api/session`, {
      headers: { origin: url, 'x-csrf-token': active.csrfToken },
    });
    expect(revoked.status()).toBe(204);
    expect((await page.request.get(`${url}/api/settings`)).status()).toBe(403);
    await page.reload();
    await visible(page.getByLabel('Bootstrap secret'));
    await visible(page.getByRole('alert').filter({ hasText: 'Your session is no longer active. Sign in again.' }));
    await page.reload();
    await visible(page.getByRole('alert').filter({ hasText: 'Your session is no longer active. Sign in again.' }));
    await noCredentialInBrowser(page, secret);

    await loginConsole(page, secret);
    await page.route('**/api/session', route =>
      route.request().method() === 'GET' ? route.abort('failed') : route.continue(),
    );
    await page.reload();
    await visible(page.getByRole('alert').filter({ hasText: 'The local control plane is unavailable.' }));
    expect((await page.request.get(`${url}/api/settings`)).status()).toBe(200);
    await page.unroute('**/api/session');
  }, 30_000);

  // F6-IR5-001: Sign-out feedback must remain readable when the sidebar collapses.
  it('keeps sign-out failure readable at desktop and compact widths, then revokes access after retry', async () => {
    const { url, secret } = await localConsole();
    const { page } = await browser(url);
    for (const width of [1280, 810, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await loginConsole(page, secret);
      let blocked = false;
      await page.route('**/api/session', route => {
        if (route.request().method() === 'DELETE') {
          blocked = true;
          return route.abort('failed');
        }
        return route.continue();
      });
      await page.getByRole('button', { name: 'Sign out' }).click();
      const alert = page.getByRole('main').getByRole('alert').filter({ hasText: 'Could not confirm sign out.' });
      await visible(alert);
      const message = alert.getByText('Could not confirm sign out.', { exact: false });
      await visible(message);
      const bounds = await message.boundingBox();
      expect(bounds).not.toBeNull();
      if (!bounds) throw new Error('SIGN_OUT_MESSAGE_MISSING');
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(blocked).toBe(true);
      await visible(page.getByRole('heading', { name: 'Overview', exact: true, level: 1 }));
      expect((await page.request.get(`${url}/api/settings`)).status()).toBe(200);

      await page.unroute('**/api/session');
      const successfulDelete = page.waitForResponse(
        response => response.url() === `${url}/api/session` && response.request().method() === 'DELETE',
      );
      await page.getByRole('button', { name: 'Sign out' }).click();
      expect((await successfulDelete).status()).toBe(204);
      await visible(page.getByLabel('Bootstrap secret'));
      expect(await page.getByRole('alert').count()).toBe(0);
      expect((await page.request.get(`${url}/api/settings`)).status()).toBe(403);
    }

    await loginConsole(page, secret);
    const active = z
      .object({ csrfToken: z.string() })
      .parse(await (await page.request.get(`${url}/api/session`)).json());
    expect(
      (
        await page.request.delete(`${url}/api/session`, {
          headers: { origin: url, 'x-csrf-token': active.csrfToken },
        })
      ).status(),
    ).toBe(204);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await visible(page.getByRole('alert').filter({ hasText: 'Your session is no longer active. Sign in again.' }));
    expect((await page.request.get(`${url}/api/settings`)).status()).toBe(403);
  });

  // J-F6-001: The operator's actions cross the browser, protected API, owned lab, and file-backed storage.
  it('console_operates_all_views_against_persisted_state', async () => {
    const wire = await modelWire();
    const advisory = await advisoryWire();
    const lab = await startDiscoveryLab({ investigationModels: wire.models, advisorySource: advisory.source });
    const { page } = await browser(lab.url());
    const consoleMessages: string[] = [];
    page.on('console', (message: ConsoleMessage) => consoleMessages.push(message.text()));
    page.on('pageerror', (error: Error) => consoleMessages.push(error.message));
    await loginConsole(page, lab.bootstrapSecret);
    await navigate(page, 'Policies');
    await page.getByRole('button', { name: 'New policy' }).click();
    let dialog = page.getByRole('dialog', { name: 'New policy' });
    await dialog.getByLabel('Name').fill('Owned browser policy');
    await dialog.getByLabel('Permitted methods').fill('GET, HEAD');
    await dialog.getByLabel('Maximum requests').fill('40');
    await dialog.getByLabel('Duration, seconds').fill('60');
    await dialog.getByLabel('Response bytes').fill('262144');
    await dialog.getByLabel('Concurrency').fill('2');
    await dialog.getByLabel('Evidence retention, days').fill('1');
    await dialog.getByLabel('Approved by').fill('lab-operator');
    await dialog.getByRole('button', { name: 'Save policy' }).click();
    await visible(page.getByRole('button', { name: 'Owned browser policy' }));
    const policy = z
      .object({ id: z.string().uuid(), revision: z.number() })
      .passthrough()
      .parse(z.object({ items: z.array(z.unknown()) }).parse((await lab.request('/api/policies')).data).items[0]);

    await navigate(page, 'Targets');
    await page.getByRole('button', { name: 'New target' }).click();
    dialog = page.getByRole('dialog', { name: 'New target' });
    await dialog.getByLabel('Name').fill('Owned browser target');
    await dialog.getByLabel('Entry URL').fill('http://allowed.lab:18080/owned/entry');
    await dialog.getByLabel('Authorization evidence reference').fill('approval:owned-browser-lab');
    await dialog.getByLabel('Policy').selectOption(policy.id);
    const createConfirmation = dialog.getByRole('checkbox', { name: 'I confirm authorization to scan this target.' });
    expect(await createConfirmation.isChecked()).toBe(false);
    await dialog.getByRole('button', { name: 'Save target' }).click();
    await visible(dialog);
    expect(
      z.object({ items: z.array(z.unknown()) }).parse((await lab.request('/api/targets')).data).items,
    ).toHaveLength(0);
    await createConfirmation.check();
    await dialog.getByRole('button', { name: 'Save target' }).click();
    await page.getByRole('button', { name: 'Owned browser target' }).click();
    await visible(page.getByRole('heading', { name: 'Identities' }));
    const browserTarget = z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        owner: z.string(),
        revision: z.number(),
        permittedMethods: z.array(z.string()),
        scanLimits: z.object({
          maxRequests: z.number(),
          maxDurationSeconds: z.number(),
          maxResponseBytes: z.number(),
          maxConcurrency: z.number(),
        }),
      })
      .passthrough();
    let target = browserTarget.parse(
      z.object({ items: z.array(z.unknown()) }).parse((await lab.request('/api/targets')).data).items[0],
    );
    await visible(page.getByText('Owner', { exact: true }).locator('..').getByText(target.owner, { exact: true }));
    await visible(
      page
        .getByText('Permitted methods', { exact: true })
        .locator('..')
        .getByText(target.permittedMethods.join(', '), { exact: true }),
    );
    await visible(
      page
        .getByText('Scan limits', { exact: true })
        .locator('..')
        .getByText(
          `${target.scanLimits.maxRequests} requests · ${target.scanLimits.maxDurationSeconds}s · ${target.scanLimits.maxResponseBytes} bytes · ${target.scanLimits.maxConcurrency} concurrent`,
          { exact: true },
        ),
    );
    const originalBinding = z
      .object({
        policyId: z.string().uuid(),
        policyRevision: z.number(),
        scanLimits: z.object({
          maxRequests: z.number(),
          maxDurationSeconds: z.number(),
          maxResponseBytes: z.number(),
          maxConcurrency: z.number(),
        }),
      })
      .parse((await lab.request(`/api/targets/${target.id}`)).data);
    expect(originalBinding.policyId).toBe(policy.id);
    expect(originalBinding.policyRevision).toBe(policy.revision);
    await page.getByRole('dialog', { name: target.name }).getByRole('button', { name: 'Close dialog' }).click();
    await page
      .getByRole('row')
      .filter({ hasText: 'Owned browser target' })
      .getByRole('button', { name: 'Edit' })
      .click();
    dialog = page.getByRole('dialog', { name: 'Edit target' });
    await visible(dialog.getByText('Policy binding (read only)'));
    expect(await dialog.locator('select[name="policy"]').count()).toBe(0);
    await dialog.getByLabel('Name').fill('Owned browser target updated');
    const editConfirmation = dialog.getByRole('checkbox', { name: 'I confirm authorization to scan this target.' });
    expect(await editConfirmation.isChecked()).toBe(false);
    await dialog.getByRole('button', { name: 'Save target' }).click();
    await visible(dialog);
    expect(
      z.object({ name: z.string(), revision: z.number() }).parse((await lab.request(`/api/targets/${target.id}`)).data),
    ).toEqual({ name: 'Owned browser target', revision: target.revision });
    await editConfirmation.check();
    await dialog.getByRole('button', { name: 'Save target' }).click();
    await visible(page.getByRole('button', { name: 'Owned browser target updated' }));
    const editedBinding = z
      .object({
        policyId: z.string().uuid(),
        policyRevision: z.number(),
        scanLimits: z.object({
          maxRequests: z.number(),
          maxDurationSeconds: z.number(),
          maxResponseBytes: z.number(),
          maxConcurrency: z.number(),
        }),
      })
      .parse((await lab.request(`/api/targets/${target.id}`)).data);
    expect(editedBinding).toEqual(originalBinding);

    await page.getByRole('button', { name: 'Owned browser target updated', exact: true }).click();
    await page.getByRole('button', { name: 'Add profile' }).click();
    dialog = page.getByRole('dialog', { name: 'Add profile' });
    await dialog.getByLabel('Name').fill('Public inventory');
    await dialog.getByLabel('Role').fill('public');
    await dialog.getByRole('button', { name: 'Save profile' }).click();
    await visible(page.getByRole('row').filter({ hasText: 'Public inventory' }));

    await page.getByRole('button', { name: 'Add profile' }).click();
    dialog = page.getByRole('dialog', { name: 'Add profile' });
    await dialog.getByLabel('Name').fill('Viewer identity');
    await dialog.getByLabel('Role').fill('viewer');
    await dialog.getByLabel('Identity type').selectOption('header');
    await dialog.getByLabel('Identity endpoint').fill('http://allowed.lab:18080/identity');
    await dialog.getByLabel('Expected identity').fill('viewer-account');
    await dialog.getByLabel('Header name').selectOption('x-api-key');
    await dialog.getByLabel('Credential', { exact: true }).fill(lab.privateValues.viewer);
    await dialog.getByRole('button', { name: 'Save profile' }).click();
    await visible(page.getByRole('row').filter({ hasText: 'Viewer identity' }));
    await noCredentialInBrowser(page, lab.privateValues.viewer);
    target = browserTarget.parse((await lab.request(`/api/targets/${target.id}`)).data);
    for (const name of ['Public inventory', 'Viewer identity']) {
      const row = page.getByRole('row').filter({ hasText: name });
      await row.getByRole('button', { name: 'Check identity' }).click();
      await visible(row.getByText('READY', { exact: false }));
    }
    await page.getByRole('button', { name: 'New scan' }).click();
    await visible(page.getByRole('status').filter({ hasText: 'Scan admitted' }));
    const scan = await waitFor(async () => {
      const items = z
        .object({
          items: z.array(
            z
              .object({
                id: z.string().uuid(),
                targetId: z.string().uuid(),
                request: z.object({ operation: z.string() }).passthrough(),
              })
              .passthrough(),
          ),
        })
        .parse((await lab.request('/api/scans?limit=100')).data).items;
      return items.find(item => item.targetId === target.id && item.request.operation === 'discovery');
    });
    const finished = await lab.wait(scan.id);
    expect(finished.state).toBe('COMPLETED');
    expect(finished.cleanup).toBe('COMPLETE');
    expect(finished.budgetInitial?.requests).toBeGreaterThan(0);

    const profiles = z
      .object({ items: z.array(z.object({ id: z.string().uuid(), role: z.string() }).passthrough()) })
      .parse((await lab.request(`/api/targets/${target.id}/profiles?limit=100`)).data).items;
    expect(profiles.map(profile => profile.role)).toContain('viewer');
    const inventory = z
      .object({
        items: z.array(
          z.object({ observation: z.object({ kind: z.string(), path: z.string() }).passthrough() }).passthrough(),
        ),
      })
      .parse((await lab.request(`/api/scans/${scan.id}/inventory?limit=100`)).data).items;
    expect(
      inventory.some(item => item.observation.kind === 'form' && item.observation.path === '/owned/ssrf/vulnerable'),
    ).toBe(true);

    await navigate(page, 'Scans');
    await page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Scans', exact: true, level: 2 }) })
      .getByRole('button', { name: 'Refresh' })
      .click();
    const scanRow = page.getByRole('row').filter({ hasText: scan.id.slice(0, 8) });
    await visible(scanRow);
    await scanRow.getByRole('button', { name: 'Investigate' }).click();
    await visible(page.getByRole('dialog', { name: `Scan ${scan.id.slice(0, 8)}` }));
    await visible(page.getByRole('status').filter({ hasText: 'Investigation admitted' }));
    const investigation = await waitFor(async () => {
      const items = z
        .object({
          items: z.array(
            z
              .object({ id: z.string().uuid(), lineage: z.object({ scanId: z.string().uuid() }).passthrough() })
              .passthrough(),
          ),
        })
        .parse((await lab.request('/api/investigations?limit=100')).data).items;
      return items.find(item => item.lineage.scanId === scan.id);
    });
    expect(wire.received).toHaveLength(0);
    await visible(page.getByRole('button', { name: 'Plan investigation' }));
    await page.getByRole('button', { name: 'Plan investigation' }).click();
    const hypothesis = await waitFor(async () => {
      const items = z
        .object({
          items: z.array(
            z
              .object({ id: z.string().uuid(), category: z.string(), evidenceIds: z.array(z.string().uuid()) })
              .passthrough(),
          ),
        })
        .parse((await lab.request(`/api/investigations/${investigation.id}/hypotheses`)).data).items;
      return items.find(item => item.category === 'ssrf');
    });
    await visible(page.getByText(`Evidence ${hypothesis.evidenceIds[0]}`, { exact: true }));
    expect(wire.received.map(body => JSON.parse(body))).toContainEqual(
      expect.objectContaining({ kind: 'propose', scanId: scan.id }),
    );
    await visible(page.getByRole('button', { name: 'Request exact approval' }));
    await page.getByRole('button', { name: 'Request exact approval' }).click();
    const approval = await waitFor(async () => {
      const items = z
        .object({ items: z.array(z.object({ id: z.string().uuid(), hypothesisId: z.string().uuid() }).passthrough()) })
        .parse((await lab.request('/api/approvals?limit=100')).data).items;
      return items.find(item => item.hypothesisId === hypothesis.id);
    });
    const approvalId = approval.id;
    const callback = `http://${lab.boundary.address}:18080/owned/callback/${approvalId}`;
    await navigate(page, 'Approvals');
    await page.getByRole('button', { name: 'Refresh' }).click();
    const approvalRow = page.getByRole('row').filter({ hasText: callback });
    await visible(approvalRow);
    await approvalRow.getByRole('button', { name: 'Review action' }).click();
    const review = page.getByRole('dialog', { name: 'Review approval action' });
    await visible(review.getByText(hypothesis.id, { exact: false }));
    await visible(review.getByText('profile r', { exact: false }).first());
    const pendingApproval = z
      .object({ createdAt: z.string().datetime(), decidedAt: z.null() })
      .parse((await lab.request(`/api/approvals/${approvalId}`)).data);
    expect(pendingApproval.decidedAt).toBeNull();
    const pendingDecision = review.getByText('Decision time / latency', { exact: true }).locator('..');
    expect(await pendingDecision.locator('time').count()).toBe(0);
    await visible(pendingDecision.getByText('— · —', { exact: true }));
    await review.getByRole('button', { name: 'Approve exact action' }).click();
    await waitFor(async () => {
      const response = await lab.request(`/api/approvals/${approvalId}`);
      return response.data.decision === 'approved' ? true : undefined;
    });
    const decidedApproval = z
      .object({ createdAt: z.string().datetime(), decidedAt: z.string().datetime(), decision: z.literal('approved') })
      .parse((await lab.request(`/api/approvals/${approvalId}`)).data);
    const elapsedSeconds = Math.floor(
      (Date.parse(decidedApproval.decidedAt) - Date.parse(decidedApproval.createdAt)) / 1000,
    );
    expect(elapsedSeconds).toBeGreaterThanOrEqual(0);
    const elapsedLabel =
      elapsedSeconds >= 60 ? `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s` : `${elapsedSeconds}s`;
    await visible(approvalRow.locator(`time[datetime="${decidedApproval.decidedAt}"]`));
    await approvalRow.getByRole('button', { name: 'Review action' }).click();
    const decidedReview = page.getByRole('dialog', { name: 'Review approval action' });
    const decisionTiming = decidedReview.getByText('Decision time / latency', { exact: true }).locator('..');
    await visible(decisionTiming.locator(`time[datetime="${decidedApproval.decidedAt}"]`));
    await visible(decisionTiming.locator('p').filter({ hasText: new RegExp(` · ${elapsedLabel}$`) }));
    await decidedReview.getByRole('button', { name: 'Close', exact: true }).click();
    const job = await waitFor(async () => {
      const items = z
        .object({ items: z.array(z.object({ state: z.string(), result: z.unknown() }).passthrough()) })
        .parse((await lab.request(`/api/investigations/${investigation.id}/jobs`)).data).items;
      return items.find(item => item.state === 'COMPLETED');
    }, 400);
    expect(z.object({ outcome: z.string() }).parse(job.result).outcome).toBe('CONFIRMED');
    const modelRun = await waitFor(async () => {
      const runs = z
        .object({
          runs: z.array(
            z.object({
              id: z.string().uuid(),
              investigationId: z.string().uuid(),
              role: z.string(),
              modelId: z.string(),
              usageTokens: z.number().nullable(),
              occurredAt: z.string().datetime(),
            }),
          ),
        })
        .parse((await lab.request('/api/agents?limit=25&offset=0')).data).runs;
      return runs.find(run => run.investigationId === investigation.id && run.role === 'watson');
    });
    expect(modelRun.modelId).toBe('morph/morph-glm53-744b');
    expect(modelRun.usageTokens).toBe(8);
    await navigate(page, 'Scans');
    await page
      .getByRole('row')
      .filter({ hasText: scan.id.slice(0, 8) })
      .getByRole('button', { name: 'Investigate' })
      .click();
    const secondInvestigation = await waitFor(async () => {
      const items = z
        .object({
          items: z.array(
            z
              .object({ id: z.string().uuid(), lineage: z.object({ scanId: z.string().uuid() }).passthrough() })
              .passthrough(),
          ),
        })
        .parse((await lab.request('/api/investigations?limit=100')).data).items;
      return items.find(item => item.lineage.scanId === scan.id && item.id !== investigation.id);
    });
    const secondRow = page.locator('.investigation-detail').filter({ hasText: secondInvestigation.id });
    await visible(secondRow.getByRole('button', { name: 'Plan investigation' }));
    await secondRow.getByRole('button', { name: 'Plan investigation' }).click();
    const secondHypothesis = await waitFor(async () => {
      const items = z
        .object({ items: z.array(z.object({ id: z.string().uuid(), category: z.string() }).passthrough()) })
        .parse((await lab.request(`/api/investigations/${secondInvestigation.id}/hypotheses`)).data).items;
      return items.find(item => item.category === 'ssrf');
    });
    await visible(secondRow.getByText('ssrf', { exact: false }).first());
    await secondRow.getByRole('button', { name: 'Request exact approval' }).click();
    await waitFor(async () => {
      const items = z
        .object({ items: z.array(z.object({ hypothesisId: z.string().uuid() }).passthrough()) })
        .parse((await lab.request('/api/approvals?limit=100')).data).items;
      return items.find(item => item.hypothesisId === secondHypothesis.id);
    });
    const currentSettings = z
      .object({
        discovery: z.object({ driver: z.string() }),
        sandbox: z.object({ driver: z.string(), platform: z.string(), memoryMiB: z.number() }),
        limits: z.object({ commandTimeoutMs: z.number() }),
      })
      .parse((await lab.request('/api/settings')).data);
    const currentRuntime = z
      .object({ scanningEnabled: z.boolean(), nativeExecutionEnabled: z.boolean() })
      .parse((await lab.request('/api/runtime')).data);
    expect(currentRuntime.scanningEnabled).toBe(true);
    const replay = await lab.request(
      `/api/approvals/${approvalId}/decision`,
      'POST',
      { decision: 'denied', revision: 1 },
      1,
    );
    expect(replay.status).toBe(409);
    expect((await lab.request(`/api/approvals/${approvalId}`)).data.decision).toBe('approved');

    await navigate(page, 'Vulnerabilities');
    await page.getByRole('button', { name: 'Synchronize advisories' }).click();
    await visible(page.getByRole('row').filter({ hasText: advisory.id }));
    expect((await lab.request('/api/advisories/status')).data.lastSuccessAt).toBeTruthy();
    await page.getByRole('combobox', { name: `Triage ${advisory.id}` }).selectOption('triaged');
    await waitFor(async () =>
      (await lab.request(`/api/advisories/${advisory.id}`)).data.triageStatus === 'triaged' ? true : undefined,
    );

    const streamCase = await discoveryCase(lab, { path: '/stream' });
    const beforeStream = await lab.stats();
    const streaming = await streamCase.admit();
    expect(streaming.status).toBe(202);
    await waitFor(async () =>
      (await lab.stats())['stream-contacts']! > (beforeStream['stream-contacts'] ?? 0) ? true : undefined,
    );
    await navigate(page, 'Scans');
    await page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Scans', exact: true, level: 2 }) })
      .getByRole('button', { name: 'Refresh' })
      .click();
    const streamId = z.object({ id: z.string().uuid() }).parse(streaming.data).id;
    const streamRow = page.getByRole('row').filter({ hasText: streamId.slice(0, 8) });
    await visible(streamRow);
    await streamRow.getByRole('button', { name: 'Cancel scan' }).click();
    await waitFor(async () =>
      (await lab.request(`/api/scans/${streamId}`)).data.state === 'CANCELLED' ? true : undefined,
    );

    for (const view of [
      'Overview',
      'Scans',
      'Targets',
      'Agents',
      'Findings',
      'Vulnerabilities',
      'Policies',
      'Approvals',
      'Evaluations',
      'Settings',
    ]) {
      await navigate(page, view);
      const expected =
        view === 'Agents'
          ? 'Nemo'
          : view === 'Findings'
            ? 'CONFIRMED'
            : view === 'Vulnerabilities'
              ? advisory.id
              : view === 'Policies'
                ? 'Owned browser policy'
                : view === 'Targets'
                  ? 'Owned browser target'
                  : view === 'Approvals'
                    ? 'approved'
                    : view === 'Evaluations'
                      ? 'ssrf'
                      : '';
      if (expected) await visible(page.getByText(expected, { exact: false }).first());
      if (view === 'Policies') {
        await page.getByRole('button', { name: 'Owned browser policy', exact: true }).click();
        await visible(page.getByRole('dialog', { name: 'Revision history' }).getByText('Revision 1', { exact: true }));
      }
      if (view === 'Evaluations') {
        await page.getByRole('button', { name: 'Inspect', exact: true }).first().click();
        const dialog = page.getByRole('dialog', { name: /^Evaluation / });
        await visible(dialog.getByText('Approved scope', { exact: false }));
      }
      if (view === 'Agents') {
        const runRow = page
          .getByRole('row')
          .filter({ hasText: modelRun.investigationId.slice(0, 8) })
          .filter({ hasText: modelRun.modelId })
          .filter({ hasText: modelRun.role })
          .first();
        await visible(runRow);
        await visible(runRow.locator(`time[datetime="${modelRun.occurredAt}"]`));
        await visible(runRow.getByText(String(modelRun.usageTokens), { exact: true }));
      }
      if (view === 'Settings') {
        await visible(
          page.getByText('Discovery driver', { exact: true }).locator('..').getByText(currentSettings.discovery.driver),
        );
        await visible(
          page
            .getByText('Sandbox', { exact: true })
            .locator('..')
            .getByText(`${currentSettings.sandbox.driver} · ${currentSettings.sandbox.platform}`),
        );
        await visible(
          page
            .getByText('Memory / PIDs', { exact: true })
            .locator('..')
            .getByText(`${currentSettings.sandbox.memoryMiB} MiB`, { exact: false }),
        );
        await visible(
          page
            .getByText('Command timeout', { exact: true })
            .locator('..')
            .getByText(`${currentSettings.limits.commandTimeoutMs} ms`),
        );
        await visible(
          page
            .getByText('Discovery availability', { exact: true })
            .locator('..')
            .getByText(currentRuntime.scanningEnabled ? 'Available' : 'Unavailable'),
        );
        await visible(
          page
            .getByText('Native execution', { exact: true })
            .locator('..')
            .getByText(currentRuntime.nativeExecutionEnabled ? 'Available' : 'Disabled'),
        );
      }
    }
    await navigate(page, 'Findings');
    const firstFinding = page.getByRole('button', { name: /^[a-f0-9]{8}$/ }).first();
    const findingPrefix = (await firstFinding.textContent())?.trim();
    const findings = z
      .object({
        items: z.array(
          z.object({
            id: z.string().uuid(),
            hypothesisId: z.string().uuid(),
            proofId: z.string().uuid(),
            evidenceIds: z.array(z.string().uuid()),
          }),
        ),
      })
      .parse((await lab.request('/api/findings?limit=25&offset=0')).data).items;
    const selectedFindings = findings.filter(item => item.id.startsWith(findingPrefix ?? ''));
    expect(selectedFindings).toHaveLength(1);
    const selectedFinding = selectedFindings[0]!;
    const proofEvidenceId = selectedFinding.evidenceIds[0];
    expect(proofEvidenceId).toBeDefined();
    const selectedEvaluation = z
      .object({
        id: z.string().uuid(),
        hypothesisId: z.string().uuid(),
        evidence: z.array(z.object({ id: z.string().uuid(), kind: z.string() })),
      })
      .parse((await lab.request(`/api/evaluations/${selectedFinding.proofId}`)).data);
    expect(selectedEvaluation.id).toBe(selectedFinding.proofId);
    expect(selectedEvaluation.hypothesisId).toBe(selectedFinding.hypothesisId);
    const proofEvidence = selectedEvaluation.evidence.find(item => item.id === proofEvidenceId);
    expect(proofEvidence).toBeDefined();
    const selectedHypothesis = z
      .object({
        evidenceIds: z.array(z.string().uuid()),
        lineage: z.object({ scanId: z.string().uuid() }),
        ruleBinding: z.object({ playbookId: z.string(), playbookVersion: z.number() }).optional(),
      })
      .parse((await lab.request(`/api/hypotheses/${selectedFinding.hypothesisId}`)).data);
    const discoveryEvidenceId = selectedHypothesis.evidenceIds[0];
    expect(discoveryEvidenceId).toBeDefined();
    await firstFinding.click();
    await visible(page.getByRole('dialog', { name: `Finding ${selectedFinding.id.slice(0, 8)}` }));
    await visible(page.getByText('Playbook / catalog provenance'));
    await visible(
      page.getByText(
        selectedHypothesis.ruleBinding
          ? `${selectedHypothesis.ruleBinding.playbookId} v${selectedHypothesis.ruleBinding.playbookVersion}`
          : 'No playbook binding recorded',
        { exact: false },
      ),
    );
    const verification = page.getByText('Verification proof evidence', { exact: true }).locator('..');
    await visible(verification.getByText(`${proofEvidence!.kind} · ${proofEvidenceId}`, { exact: true }));
    const discovery = page.getByText('Discovery scan evidence IDs', { exact: true }).locator('..');
    await visible(discovery.getByText(selectedHypothesis.evidenceIds.join(', '), { exact: true }));
    await page.getByRole('button', { name: 'Inspect scan observations' }).click();
    const observations = page.locator('section.section').filter({
      has: page.getByRole('heading', { name: 'Sanitized scan observations' }),
    });
    const matchedEvidence = observations.getByText(`Evidence ${discoveryEvidenceId} · matches hypothesis`, {
      exact: true,
    });
    const pager = observations.locator('.pager');
    await visible(pager.getByRole('button', { name: 'Next' }));
    let evidenceOffset = 0;
    while (!(await matchedEvidence.count())) {
      const next = pager.getByRole('button', { name: 'Next' });
      expect(await next.isEnabled()).toBe(true);
      await next.click();
      evidenceOffset += 100;
      await visible(pager.getByText(new RegExp(`^${evidenceOffset + 1}–`)));
    }
    await visible(matchedEvidence);
    const scanEvidence = z
      .object({
        items: z.array(
          z.object({
            id: z.string().uuid(),
            observation: z.object({ method: z.string(), origin: z.string(), path: z.string(), role: z.string() }),
          }),
        ),
      })
      .parse(
        (
          await lab.request(
            `/api/scans/${selectedHypothesis.lineage.scanId}/evidence?limit=100&offset=${evidenceOffset}`,
          )
        ).data,
      ).items;
    const matchingObservation = scanEvidence.find(item => item.id === discoveryEvidenceId);
    expect(matchingObservation).toBeDefined();
    const observationRecord = matchedEvidence.locator('..');
    await visible(
      observationRecord.getByText(
        `${matchingObservation!.observation.method} ${matchingObservation!.observation.origin}${matchingObservation!.observation.path}`,
        { exact: true },
      ),
    );
    await visible(observationRecord.getByText(matchingObservation!.observation.role, { exact: false }));
    await page.reload();
    await visible(page.getByRole('heading', { name: 'Findings', exact: true, level: 1 }));
    await navigate(page, 'Vulnerabilities');
    await visible(page.getByRole('combobox', { name: `Triage ${advisory.id}` }));
    expect(await page.getByRole('combobox', { name: `Triage ${advisory.id}` }).inputValue()).toBe('triaged');
    await navigate(page, 'Approvals');
    await visible(page.getByRole('row').filter({ hasText: 'approved' }));
    await navigate(page, 'Scans');
    await visible(
      page
        .getByRole('row')
        .filter({ hasText: streamId.slice(0, 8) })
        .getByText('CANCELLED'),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await navigate(page, 'Agents');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('.sidebar').count()).toBe(1);
    expect(await page.locator('.topbar').count()).toBe(1);
    await visible(page.getByRole('button', { name: 'Sign out' }));
    expect(wire.received.join('')).not.toContain(lab.privateValues.viewer);
    expect(lab.exported.join('')).not.toContain(lab.privateValues.viewer);
    expect(consoleMessages.join('')).not.toContain(lab.privateValues.viewer);
    await noCredentialInBrowser(page, lab.privateValues.viewer);
    await noCredentialInBrowser(page, lab.bootstrapSecret);
  }, 420000);

  // J-F6-002: Empty, expired, stale, and unavailable states are visible while rejected writes preserve storage.
  it('console_exposes_empty_auth_conflict_and_failure_states', async () => {
    const rootFolder = await mkdtemp(join(tmpdir(), 'scanner-console-browser-'));
    cleanup.push(() => rm(rootFolder, { recursive: true, force: true }));
    await mkdir(join(rootFolder, 'web'), { recursive: true });
    await cp(join(root, 'web', 'dist'), join(rootFolder, 'web', 'dist'), { recursive: true });
    const secret = 'owned_empty_console_bootstrap_secret_123456789';
    const settings = loadSettings(
      { CONTROL_BOOTSTRAP_SECRET: secret, SCANNER_ENCRYPTION_KEY: 'ab'.repeat(32) },
      rootFolder,
    );
    const running = await startControlPlane(settings, 0);
    let runningClosed = false;
    /** Close the running console fixture only once across journey and cleanup paths. */
    const closeRunning = async () => {
      if (runningClosed) return;
      runningClosed = true;
      await running.close();
    };
    cleanup.push(closeRunning);
    const { page } = await browser(running.url);
    await visible(page.getByLabel('Bootstrap secret'));
    expect((await page.request.get(`${running.url}/api/settings`)).status()).toBe(403);
    const wrongSecret = 'wrong_bootstrap_secret_longer_than_32_chars';
    await page.getByLabel('Bootstrap secret').fill(wrongSecret);
    const rejectedLogin = page.waitForResponse(
      response => response.url() === `${running.url}/api/session` && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Sign in' }).click();
    const denial = await rejectedLogin;
    expect(denial.status()).toBe(403);
    expect(await denial.json()).toEqual({ code: 'LOCAL_SESSION_REQUIRED' });
    await visible(page.getByRole('alert').filter({ hasText: 'Incorrect bootstrap secret. Try again.' }));
    await noCredentialInBrowser(page, wrongSecret);
    await loginConsole(page, secret);
    for (const view of ['Scans', 'Findings', 'Evaluations', 'Approvals']) {
      await navigate(page, view);
      await visible(
        page.getByText(
          /No scans recorded|No confirmed findings recorded|No measured verification results recorded|No approval requests recorded/,
        ),
      );
    }
    await navigate(page, 'Policies');
    await page.getByRole('button', { name: 'New policy' }).click();
    let dialog = page.getByRole('dialog', { name: 'New policy' });
    await dialog.getByLabel('Name').fill('Initial policy');
    await dialog.getByRole('button', { name: 'Save policy' }).click();
    await visible(page.getByRole('button', { name: 'Initial policy' }));
    const policy = z
      .object({ id: z.string().uuid(), revision: z.number(), name: z.string() })
      .passthrough()
      .parse(
        z
          .object({ items: z.array(z.unknown()) })
          .parse(await (await page.request.get(`${running.url}/api/policies`)).json()).items[0],
      );
    await navigate(page, 'Targets');
    await page.getByRole('button', { name: 'New target' }).click();
    dialog = page.getByRole('dialog', { name: 'New target' });
    await dialog.getByLabel('Name').fill('Expired identity target');
    await dialog.getByLabel('Entry URL').fill('http://owned.lab/');
    await dialog.getByLabel('Authorization evidence reference').fill('approval:owned-empty-lab');
    await dialog.getByLabel('Policy').selectOption(policy.id);
    await dialog.getByRole('checkbox', { name: 'I confirm authorization to scan this target.' }).check();
    await dialog.getByRole('button', { name: 'Save target' }).click();
    await page.getByRole('button', { name: 'Expired identity target' }).click();
    const target = z
      .object({ id: z.string().uuid() })
      .parse(
        z
          .object({ items: z.array(z.unknown()) })
          .parse(await (await page.request.get(`${running.url}/api/targets`)).json()).items[0],
      );
    const targetBinding = z
      .object({ policyId: z.string().uuid(), policyRevision: z.number() })
      .parse(await (await page.request.get(`${running.url}/api/targets/${target.id}`)).json());
    expect(targetBinding).toEqual({ policyId: policy.id, policyRevision: policy.revision });
    const marker = 'F6_TEST_CREDENTIAL_MARKER_12345';
    await page.getByRole('button', { name: 'Add profile' }).click();
    dialog = page.getByRole('dialog', { name: 'Add profile' });
    await dialog.getByLabel('Name').fill('Expired viewer');
    await dialog.getByLabel('Role').fill('viewer');
    await dialog.getByLabel('Expires at, ISO UTC (optional)').fill('2020-01-01T00:00:00.000Z');
    await dialog.getByLabel('Identity type').selectOption('header');
    await dialog.getByLabel('Identity endpoint').fill('http://owned.lab/identity');
    await dialog.getByLabel('Expected identity').fill('viewer-account');
    await dialog.getByLabel('Header name').selectOption('x-api-key');
    await dialog.getByLabel('Credential', { exact: true }).fill(marker);
    await dialog.getByRole('button', { name: 'Save profile' }).click();
    await visible(page.getByRole('row').filter({ hasText: 'Expired viewer' }).getByText('AUTH REQUIRED'));
    await noCredentialInBrowser(page, marker);
    const profileReadback = await (await page.request.get(`${running.url}/api/targets/${target.id}/profiles`)).text();
    expect(profileReadback).not.toContain(marker);
    const database = createClient({ url: settings.databaseUrl });
    try {
      expect(JSON.stringify((await database.execute('SELECT * FROM scanner_credentials')).rows)).not.toContain(marker);
    } finally {
      database.close();
    }

    await navigate(page, 'Policies');
    await page.getByRole('row').filter({ hasText: policy.name }).getByRole('button', { name: 'Edit' }).click();
    dialog = page.getByRole('dialog', { name: 'Edit policy' });
    const activeSession = z
      .object({ csrfToken: z.string() })
      .parse(await (await page.request.get(`${running.url}/api/session`)).json());
    const update = await page.request.put(`${running.url}/api/policies/${policy.id}`, {
      headers: { origin: running.url, 'x-csrf-token': activeSession.csrfToken, 'if-match': `"${policy.revision}"` },
      data: {
        name: 'Externally revised policy',
        permittedMethods: ['GET', 'HEAD'],
        scanLimits: { maxRequests: 100, maxDurationSeconds: 300, maxResponseBytes: 1048576, maxConcurrency: 1 },
      },
    });
    expect(update.status()).toBe(200);
    await dialog.getByLabel('Name').fill('Stale browser edit');
    await dialog.getByRole('button', { name: 'Save policy' }).click();
    await visible(dialog.getByRole('alert').filter({ hasText: 'record changed' }));
    const persisted = z
      .object({ name: z.string(), revision: z.number() })
      .parse(await (await page.request.get(`${running.url}/api/policies/${policy.id}`)).json());
    expect(persisted).toMatchObject({ name: 'Externally revised policy', revision: 2 });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    const newPolicyButton = page.getByRole('button', { name: 'New policy' });
    await newPolicyButton.click();
    await visible(page.getByRole('dialog', { name: 'New policy' }));
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'New policy' }).waitFor({ state: 'hidden' });
    expect(await newPolicyButton.evaluate((element: Element) => element === document.activeElement)).toBe(true);
    await page.reload();
    await visible(page.getByRole('button', { name: 'Externally revised policy' }));
    await closeRunning();
    await navigate(page, 'Settings');
    await visible(page.getByRole('alert').filter({ hasText: 'local control plane is unavailable' }));

    const expiryRoot = await mkdtemp(join(tmpdir(), 'scanner-console-expiry-'));
    cleanup.push(() => rm(expiryRoot, { recursive: true, force: true }));
    await mkdir(join(expiryRoot, 'web'), { recursive: true });
    await cp(join(root, 'web', 'dist'), join(expiryRoot, 'web', 'dist'), { recursive: true });
    const expiry = await startControlPlane(
      loadSettings(
        { CONTROL_BOOTSTRAP_SECRET: secret, CONTROL_SESSION_TTL_SECONDS: '3', SCANNER_ENCRYPTION_KEY: 'ab'.repeat(32) },
        expiryRoot,
      ),
      0,
    );
    cleanup.push(expiry.close);
    await page.goto(expiry.url);
    await loginConsole(page, secret);
    await visible(page.getByLabel('Bootstrap secret'));
    await visible(page.getByRole('alert').filter({ hasText: 'Session expired. Sign in again.' }));
    await page.reload();
    await visible(page.getByRole('alert').filter({ hasText: 'Your session is no longer active. Sign in again.' }));
    const expiredSession = await page.request.get(`${expiry.url}/api/session`);
    expect(expiredSession.status()).toBe(403);
    expect(await expiredSession.json()).toEqual({ code: 'LOCAL_SESSION_REQUIRED' });
    await noCredentialInBrowser(page, secret);

    const approvalWire = await modelWire();
    const approvalLab = await startDiscoveryLab({ investigationModels: approvalWire.models });
    const owned = await discoveryCase(approvalLab, { path: '/owned/entry' });
    const admitted = await owned.admit();
    expect(admitted.status).toBe(202);
    const ownedScan = z.object({ id: z.string().uuid() }).parse(admitted.data);
    expect((await approvalLab.wait(ownedScan.id)).state).toBe('COMPLETED');
    const admittedInvestigation = await approvalLab.request('/api/investigations', 'POST', {
      scanId: ownedScan.id,
      idempotencyKey: crypto.randomUUID().replaceAll('-', ''),
      maxRequests: 20,
      maxTokens: 16384,
      maxDurationSeconds: 600,
    });
    expect(admittedInvestigation.status).toBe(201);
    const investigationId = z.object({ id: z.string().uuid() }).parse(admittedInvestigation.data).id;
    expect((await approvalLab.request(`/api/investigations/${investigationId}/plan`, 'POST', {})).status).toBe(200);
    const planned = z
      .object({ items: z.array(z.object({ id: z.string().uuid(), category: z.string() }).passthrough()) })
      .parse((await approvalLab.request(`/api/investigations/${investigationId}/hypotheses`)).data).items;
    const plannedHypothesis = planned.find(item => item.category === 'ssrf');
    expect(plannedHypothesis).toBeDefined();
    const callback = z
      .object({ investigation: z.object({ approvalCallback: z.string() }) })
      .parse((await approvalLab.request('/api/settings')).data).investigation.approvalCallback;
    const requested = await approvalLab.request(`/api/hypotheses/${plannedHypothesis!.id}/approval`, 'POST', {
      callback,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    expect(requested.status).toBe(201);
    const pendingApproval = z.object({ id: z.string().uuid(), revision: z.number() }).parse(requested.data);
    await page.goto(approvalLab.url());
    await loginConsole(page, approvalLab.bootstrapSecret);
    await navigate(page, 'Approvals');
    await page.getByRole('button', { name: 'Refresh' }).click();
    await page
      .getByRole('row')
      .filter({ hasText: pendingApproval.id.slice(0, 8) })
      .getByRole('button', { name: 'Review action' })
      .click();
    const approvalDialog = page.getByRole('dialog', { name: 'Review approval action' });
    await visible(approvalDialog.getByRole('button', { name: 'Approve exact action' }));
    expect(
      (
        await approvalLab.request(
          `/api/approvals/${pendingApproval.id}/decision`,
          'POST',
          { decision: 'denied', revision: pendingApproval.revision },
          pendingApproval.revision,
        )
      ).status,
    ).toBe(200);
    await approvalDialog.getByRole('button', { name: 'Approve exact action' }).click();
    await visible(approvalDialog.getByRole('alert').filter({ hasText: 'record changed' }));
    const unchanged = z
      .object({ decision: z.string(), revision: z.number() })
      .parse((await approvalLab.request(`/api/approvals/${pendingApproval.id}`)).data);
    expect(unchanged).toEqual({ decision: 'denied', revision: pendingApproval.revision + 1 });
  }, 240000);
});
