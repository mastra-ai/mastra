// @vitest-environment jsdom
import { createElement, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PoliciesView, PolicyForm, ProfileForm, ScansView, TargetsView } from '../web/operations.js';
import { ApprovalsView, FindingsView, OverviewView, VulnerabilitiesView } from '../web/intelligence.js';
import { SettingsView } from '../web/main.js';
import type { Approval } from '../web/api.js';
import { ScanInvestigations } from '../web/investigation.js';
import { Empty, Notice, Pager, Status } from '../web/ui.js';

let root: Root | undefined;
let host: HTMLDivElement | undefined;
function render(node: ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // jsdom does not implement the native dialog methods used by the form shell.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  host = undefined;
  root = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('console component outcomes', () => {
  it('shows persisted approval timing only after a decision', async () => {
    const createdAt = '2026-10-31T12:00:00.000Z';
    const decidedAt = '2026-10-31T12:01:15.000Z';
    /** Build an approval record with the selected decision and optional decision timestamp. */
    const approval = (id: string, decision: string, time: string | null): Approval => ({
      id,
      investigationId: 'investigation',
      hypothesisId: 'hypothesis',
      jobId: 'job',
      toolId: 'check_ssrf',
      callback: `http://owned.test/${id}`,
      maxRequests: 1,
      expiresAt: '2026-10-31T12:10:00.000Z',
      createdAt,
      decidedAt: time,
      decision,
      revision: time ? 2 : 1,
      lineage: {
        targetId: 'target',
        targetRevision: 1,
        policyId: 'policy',
        policyRevision: 1,
        scanId: 'scan',
        profiles: [],
      },
    });
    const records = [
      approval('pending', 'pending', null),
      approval('approved', 'approved', decidedAt),
      approval('expired', 'expired', null),
    ];
    vi.stubGlobal('fetch', async (input: string) => {
      if (input.startsWith('/api/approvals?')) return Response.json({ items: records, limit: 25, offset: 0 });
      if (input.startsWith('/api/approvals/')) return Response.json(records.find(item => input.endsWith(item.id)));
      if (input === '/api/hypotheses/hypothesis')
        return Response.json({
          category: 'ssrf',
          risk: 'active',
          expectedBehavior: 'Owned callback',
          origin: 'playbook',
          evidenceIds: [],
          referenceIds: [],
        });
      throw new Error(`Unexpected ${input}`);
    });
    const view = render(createElement(ApprovalsView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const row = (id: string) =>
      Array.from(view.querySelectorAll('tbody tr')).find(item => item.textContent?.includes(`/${id}`))!;
    for (const id of ['pending', 'expired']) {
      expect(row(id).querySelectorAll('time')).toHaveLength(2);
      expect(row(id).children[8]?.textContent).toBe('—');
    }
    expect(row('approved').querySelector('time[datetime="2026-10-31T12:01:15.000Z"]')).not.toBeNull();
    expect(row('approved').children[8]?.textContent).toBe('1m 15s');
    await act(async () => {
      row('pending').querySelector('button')!.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const pendingTiming = Array.from(view.querySelectorAll('dialog .eyebrow')).find(
      item => item.textContent === 'Decision time / latency',
    )!.parentElement!;
    expect(pendingTiming.querySelector('time')).toBeNull();
    expect(pendingTiming.textContent).toContain('— · —');
    await act(async () => {
      Array.from(view.querySelectorAll<HTMLButtonElement>('dialog button'))
        .find(item => item.textContent === 'Close')!
        .click();
    });
    await act(async () => {
      row('approved').querySelector('button')!.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const decidedTiming = Array.from(view.querySelectorAll('dialog .eyebrow')).find(
      item => item.textContent === 'Decision time / latency',
    )!.parentElement!;
    expect(decidedTiming.querySelector(`time[datetime="${decidedAt}"]`)).not.toBeNull();
    expect(decidedTiming.textContent).toContain('1m 15s');
  });
  it('plans the second investigation row and requests approval for its own hypothesis', async () => {
    const requests: string[] = [];
    const investigation = (id: string) => ({
      id,
      state: 'QUEUED',
      lineage: { scanId: 'scan-1' },
      limits: { maxRequests: 20, maxTokens: 1000, maxDurationSeconds: 60 },
    });
    let planned = false;
    vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        requests.push(input);
        if (input === '/api/investigations/second/plan') planned = true;
        return Response.json({ id: 'approval-second' });
      }
      if (input.startsWith('/api/investigations?'))
        return Response.json({ items: [investigation('first'), investigation('second')], limit: 25, offset: 0 });
      if (input.includes('/hypotheses?'))
        return Response.json({
          items:
            input.includes('/second/') && planned
              ? [
                  {
                    id: 'hypothesis-second',
                    category: 'ssrf',
                    toolId: 'check_ssrf',
                    origin: 'playbook',
                    risk: 'active',
                    state: 'AWAITING_APPROVAL',
                    expectedBehavior: 'Owned callback',
                    maxRequests: 1,
                    evidenceIds: ['evidence-second'],
                  },
                ]
              : [],
          limit: 25,
          offset: 0,
        });
      if (input.startsWith('/api/approvals?')) return Response.json({ items: [], limit: 100, offset: 0 });
      if (input === '/api/settings')
        return Response.json({
          investigation: {
            requested: true,
            modelConfigured: true,
            approvalCallback: 'http://owned.test/callback',
          },
        });
      throw new Error(`Unexpected ${input}`);
    });
    const view = render(createElement(ScanInvestigations, { scanId: 'scan-1' }));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const rows = view.querySelectorAll('.investigation-detail');
    expect(rows).toHaveLength(2);
    await act(async () => {
      Array.from(rows[1]!.querySelectorAll('button'))
        .find(button => button.textContent === 'Plan investigation')!
        .click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(requests).toContain('/api/investigations/second/plan');
    expect(requests).not.toContain('/api/investigations/first/plan');
    const activeSecondRow = Array.from(view.querySelectorAll('.investigation-detail')).find(
      row => row.querySelector('.investigation-summary strong')?.textContent === 'second',
    )!;
    expect(activeSecondRow.textContent).toContain('evidence-second');
    const requestApproval = Array.from(activeSecondRow.querySelectorAll('button')).find(
      button => button.textContent === 'Request exact approval',
    )!;
    expect(requestApproval.disabled).toBe(false);
    expect(view.contains(requestApproval)).toBe(true);
    await act(async () => {
      requestApproval.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.querySelector('[role="alert"]')?.textContent ?? null).toBeNull();
    expect(requests).toContain('/api/hypotheses/hypothesis-second/approval');
  });

  it.each(['expired', 'unknown'] as const)(
    'marks %s evidence unavailable while retaining the dated outcome',
    async state => {
      vi.stubGlobal('fetch', async (input: string) => {
        if (input.startsWith('/api/findings?'))
          return Response.json({
            items: [
              {
                id: 'finding-12345678',
                investigationId: 'investigation-1',
                hypothesisId: 'hypothesis-1',
                jobId: 'job-1',
                proofId: 'proof-1',
                evidenceIds: [],
                createdAt: '2026-01-01T00:00:00Z',
                availability: { state, at: null },
              },
            ],
            limit: 25,
            offset: 0,
          });
        if (input === '/api/hypotheses/hypothesis-1')
          return Response.json({
            category: 'idor',
            origin: 'playbook',
            toolId: 'check_idor',
            referenceIds: [],
            evidenceIds: [],
            lineage: {
              targetId: 'target-1',
              targetRevision: 1,
              policyId: 'policy-1',
              policyRevision: 1,
              scanId: 'scan-1',
            },
          });
        if (input === '/api/evaluations/proof-1')
          return Response.json({
            source: 'owned-gateway',
            requestCount: 2,
            withheld: true,
            evidence: [],
            availability: { state, at: null },
          });
        if (input === '/api/jobs/job-1')
          return Response.json({ result: { outcome: 'CONFIRMED', reason: 'DATED_OWNED_PROOF' } });
        throw new Error(`Unexpected ${input}`);
      });
      const view = render(createElement(FindingsView));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(view.textContent).toContain(state === 'expired' ? 'EVIDENCE EXPIRED' : 'EVIDENCE UNKNOWN');
      expect(view.textContent).not.toContain('CONFIRMED');
      await act(async () => {
        Array.from(view.querySelectorAll('button'))
          .find(button => button.textContent === 'finding-')!
          .click();
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(view.textContent).toContain('Historical outcome');
      expect(view.textContent).toContain('CONFIRMED');
      expect(view.textContent).toContain(`Evidence availability: ${state}`);
      expect(view.textContent).toContain('withheld evidence');
    },
  );

  it('shows verification proof and discovery scan evidence as separate provenance', async () => {
    const finding = {
      id: 'finding-12345678',
      investigationId: 'investigation-1',
      hypothesisId: 'hypothesis-1',
      jobId: 'job-1',
      proofId: 'proof-1',
      evidenceIds: ['proof-evidence-1'],
      createdAt: '2026-01-01T00:00:00Z',
    };
    vi.stubGlobal('fetch', async (input: string) => {
      if (input.startsWith('/api/findings?')) return Response.json({ items: [finding], limit: 25, offset: 0 });
      if (input === '/api/hypotheses/hypothesis-1')
        return Response.json({
          category: 'ssrf',
          origin: 'playbook',
          toolId: 'check_ssrf',
          evidenceIds: ['evidence-2'],
          referenceIds: [],
          lineage: {
            targetId: 'target-1',
            targetRevision: 1,
            policyId: 'policy-1',
            policyRevision: 1,
            scanId: 'scan-1',
          },
        });
      if (input === '/api/evaluations/proof-1')
        return Response.json({
          source: 'owned',
          requestCount: 1,
          withheld: false,
          evidence: [{ id: 'proof-evidence-1', kind: 'owned_callback' }],
        });
      if (input === '/api/jobs/job-1')
        return Response.json({ result: { outcome: 'CONFIRMED', reason: 'OWNED_PROOF' } });
      if (input === '/api/scans/scan-1/evidence?limit=100&offset=0')
        return Response.json({
          items: [
            {
              id: 'evidence-1',
              observation: { method: 'GET', origin: 'http://owned.test', path: '/other', role: 'public' },
            },
            {
              id: 'evidence-2',
              observation: { method: 'GET', origin: 'http://owned.test', path: '/owned', role: 'public' },
            },
          ],
          limit: 100,
          offset: 0,
        });
      throw new Error(`Unexpected ${input}`);
    });
    const view = render(createElement(FindingsView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await act(async () => {
      Array.from(view.querySelectorAll('button'))
        .find(button => button.textContent === 'finding-')!
        .click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await act(async () => {
      Array.from(view.querySelectorAll('button'))
        .find(button => button.textContent === 'Inspect scan observations')!
        .click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.textContent).toContain('Verification proof evidenceowned_callback · proof-evidence-1');
    expect(view.textContent).toContain('Discovery scan evidence IDsevidence-2');
    const matching = Array.from(view.querySelectorAll('.record')).find(row =>
      row.textContent?.includes('Evidence evidence-2'),
    )!;
    expect(matching.textContent).toContain('matches hypothesis');
    expect(matching.textContent).toContain('http://owned.test/owned');
    expect(view.textContent).toContain('Evidence evidence-1');
    expect(view.textContent).not.toContain('Evidence proof-evidence-1 · matches hypothesis');
  });
  it.each(['settings', 'runtime'])(
    'keeps last-known settings and runtime visible as stale when the %s refresh fails',
    async failedEndpoint => {
      let refresh = false;
      const settings = {
        discovery: { driver: 'owned-driver', requested: true },
        investigation: { requested: true, modelConfigured: true },
        sandbox: { driver: 'owned-sandbox', platform: 'linux/amd64', memoryMiB: 512, pids: 64 },
        storage: { driver: 'libsql' },
        queue: { driver: 'local' },
        limits: { commandTimeoutMs: 1500, outputBytes: 4096 },
        session: { ttlSeconds: 900 },
      };
      const runtime = {
        status: 'control-plane',
        scanningEnabled: true,
        discoveryRequested: true,
        nativeExecutionEnabled: false,
      };
      vi.stubGlobal('fetch', async (input: string) => {
        if (input === '/api/operations')
          return Response.json({
            operation: { state: 'NOT_PERFORMED', detail: null, at: null },
            retention: { state: 'READY', batchLimit: 128, pending: false },
            imageRecordsPending: 0,
          });
        const endpoint = input === '/api/settings' ? 'settings' : input === '/api/runtime' ? 'runtime' : '';
        if (!endpoint) throw new Error(`Unexpected ${input}`);
        return refresh && endpoint === failedEndpoint
          ? Response.json({ code: 'CONTROL_PLANE_UNAVAILABLE' }, { status: 503 })
          : Response.json(endpoint === 'settings' ? settings : runtime);
      });
      const view = render(createElement(SettingsView));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(view.textContent).toContain('owned-driver');
      expect(view.textContent).toContain('owned-sandbox');
      expect(view.textContent).toContain('Discovery availabilityAvailable');
      expect(view.textContent).not.toContain('stale');

      refresh = true;
      await act(async () => {
        Array.from(view.querySelectorAll('button'))
          .find(button => button.textContent === 'Refresh settings')
          ?.click();
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(view.textContent).toContain('owned-driver');
      expect(view.textContent).toContain('owned-sandbox');
      expect(view.textContent).toContain('Discovery availabilityAvailable');
      expect(view.textContent).toContain('Last successful records are stale; current state is unavailable.');
      expect(view.textContent).toContain(`${failedEndpoint === 'settings' ? 'Settings' : 'Runtime'} data is stale`);
      refresh = false;
      await act(async () => {
        Array.from(view.querySelectorAll('button'))
          .find(button => button.textContent === 'Reload')
          ?.click();
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(view.textContent).toContain('owned-driver');
      expect(view.textContent).toContain('owned-sandbox');
      expect(view.textContent).not.toContain('data is stale');
    },
  );

  it('creates a target with a later-page policy after navigating away and back', async () => {
    const limits = { maxRequests: 3, maxDurationSeconds: 20, maxResponseBytes: 2048, maxConcurrency: 1 };
    const first = Array.from({ length: 100 }, (_, index) => ({
      id: `policy-${index}`,
      name: `Policy ${index}`,
      revision: 1,
      scanLimits: limits,
    }));
    const later = { id: 'policy-100', name: 'Later policy', revision: 4, scanLimits: limits };
    let submitted: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
      if (input === '/api/targets' && init?.method === 'POST') {
        submitted = JSON.parse(String(init.body));
        return Response.json({ id: 'created-target' });
      }
      if (input.startsWith('/api/targets?')) return Response.json({ items: [], limit: 25, offset: 0 });
      if (input.startsWith('/api/policies?')) {
        const offset = Number(new URL(input, 'http://localhost').searchParams.get('offset'));
        return Response.json({ items: offset === 0 ? first : [later], limit: 100, offset });
      }
      throw new Error(`Unexpected ${input}`);
    });
    const view = render(createElement(TargetsView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await act(async () => {
      Array.from(view.querySelectorAll('button'))
        .find(button => button.textContent === 'New target')
        ?.click();
    });
    const dialog = view.querySelector('dialog')!;
    const page = async (name: string) => {
      await act(async () => {
        Array.from(dialog.querySelectorAll('button'))
          .find(button => button.textContent === name)
          ?.click();
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    };
    await page('Next');
    const select = dialog.querySelector<HTMLSelectElement>('select[name="policy"]')!;
    expect(Array.from(select.options).some(option => option.value === later.id)).toBe(true);
    await act(async () => {
      select.value = later.id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page('Previous');
    expect(select.value).toBe(later.id);
    await page('Next');
    expect(select.value).toBe(later.id);
    const form = dialog.querySelector<HTMLFormElement>('form')!;
    form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Later-page target';
    form.querySelector<HTMLInputElement>('input[name="entryUrl"]')!.value = 'http://owned.test/';
    form.querySelector<HTMLInputElement>('input[name="evidence"]')!.value = 'approval:owned';
    const confirmation = form.querySelector<HTMLInputElement>('input[name="authorizationConfirmed"]')!;
    expect(confirmation.checked).toBe(false);
    expect(form.checkValidity()).toBe(false);
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(submitted).toBeUndefined();
    confirmation.checked = true;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(submitted).toMatchObject({
      authorizationConfirmed: true,
      policyId: later.id,
      policyRevision: 4,
      scanLimits: limits,
    });
  });

  it('keeps New target available after an exact full policy page leads to an empty page', async () => {
    const policies = Array.from({ length: 100 }, (_, index) => ({
      id: `policy-${index}`,
      name: `Policy ${index}`,
      revision: 1,
      scanLimits: { maxRequests: 3, maxDurationSeconds: 20, maxResponseBytes: 2048, maxConcurrency: 1 },
    }));
    vi.stubGlobal('fetch', async (input: string) => {
      if (input.startsWith('/api/targets?')) return Response.json({ items: [], limit: 25, offset: 0 });
      if (input.startsWith('/api/policies?')) {
        const offset = Number(new URL(input, 'http://localhost').searchParams.get('offset'));
        return Response.json({ items: offset === 0 ? policies : [], limit: 100, offset });
      }
      throw new Error(`Unexpected ${input}`);
    });
    const view = render(createElement(TargetsView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const newTarget = Array.from(view.querySelectorAll('button')).find(button => button.textContent === 'New target')!;
    await act(async () => {
      newTarget.click();
    });
    let dialog = view.querySelector('dialog')!;
    await act(async () => {
      Array.from(dialog.querySelectorAll('button'))
        .find(button => button.textContent === 'Next')!
        .click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(dialog.textContent).toContain('No records');
    await act(async () => {
      Array.from(dialog.querySelectorAll('button'))
        .find(button => button.textContent === 'Cancel')!
        .click();
    });
    expect(newTarget.disabled).toBe(false);
    await act(async () => {
      newTarget.click();
    });
    dialog = view.querySelector('dialog')!;
    await act(async () => {
      Array.from(dialog.querySelectorAll('button'))
        .find(button => button.textContent === 'Previous')!
        .click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(
      Array.from(dialog.querySelector<HTMLSelectElement>('select[name="policy"]')!.options).some(
        option => option.value === 'policy-0',
      ),
    ).toBe(true);
  });

  it('requires a selected header name when replacing a sealed header credential', async () => {
    let submitted: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
      expect(input).toBe('/api/targets/target-1/profiles/profile-1');
      expect(init?.method).toBe('PUT');
      submitted = JSON.parse(String(init?.body));
      return Response.json({ id: 'profile-1' });
    });
    const target = { id: 'target-1', revision: 2 } as Parameters<typeof ProfileForm>[0]['target'];
    const profile = {
      id: 'profile-1',
      revision: 3,
      name: 'Viewer',
      role: 'viewer',
      kind: 'header',
      identityEndpoint: 'http://owned.test/identity',
      expectedIdentity: 'viewer-account',
    } as unknown as Parameters<typeof ProfileForm>[0]['profile'];
    const view = render(createElement(ProfileForm, { target, profile, onClose: () => {}, onSaved: () => {} }));
    const form = view.querySelector<HTMLFormElement>('form')!;
    const header = form.querySelector<HTMLSelectElement>('select[name="header"]')!;
    const credential = form.querySelector<HTMLInputElement>('input[name="credential"]')!;
    credential.value = 'replacement-value';
    expect(header.value).toBe('');
    expect(form.checkValidity()).toBe(false);
    expect(header.validity.valueMissing).toBe(true);
    header.value = 'cookie';
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(submitted).toMatchObject({ credential: { name: 'cookie', value: 'replacement-value' } });
  });

  it('keeps profile metadata editable after a rejected save while clearing the credential', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ code: 'REVISION_CONFLICT' }, { status: 409 }));
    const target = { id: 'target-1', revision: 2 } as Parameters<typeof ProfileForm>[0]['target'];
    const profile = {
      id: 'profile-1',
      revision: 3,
      name: 'Original name',
      role: 'viewer',
      kind: 'header',
      identityEndpoint: 'http://owned.test/identity',
      expectedIdentity: 'viewer-account',
    } as unknown as Parameters<typeof ProfileForm>[0]['profile'];
    const view = render(createElement(ProfileForm, { target, profile, onClose: () => {}, onSaved: () => {} }));
    const form = view.querySelector<HTMLFormElement>('form')!;
    form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Edited name';
    form.querySelector<HTMLInputElement>('input[name="role"]')!.value = 'admin';
    form.querySelector<HTMLInputElement>('input[name="expiresAt"]')!.value = '2027-01-01T00:00:00.000Z';
    form.querySelector<HTMLInputElement>('input[name="endpoint"]')!.value = 'http://owned.test/account';
    form.querySelector<HTMLInputElement>('input[name="expected"]')!.value = 'admin-account';
    form.querySelector<HTMLSelectElement>('select[name="header"]')!.value = 'x-api-key';
    form.querySelector<HTMLInputElement>('input[name="credential"]')!.value = 'secret-marker';
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.textContent).toContain('This record changed');
    expect(form.querySelector<HTMLInputElement>('input[name="name"]')!.value).toBe('Edited name');
    expect(form.querySelector<HTMLInputElement>('input[name="role"]')!.value).toBe('admin');
    expect(form.querySelector<HTMLInputElement>('input[name="expiresAt"]')!.value).toBe('2027-01-01T00:00:00.000Z');
    expect(form.querySelector<HTMLSelectElement>('select[name="kind"]')!.value).toBe('header');
    expect(form.querySelector<HTMLInputElement>('input[name="endpoint"]')!.value).toBe('http://owned.test/account');
    expect(form.querySelector<HTMLInputElement>('input[name="expected"]')!.value).toBe('admin-account');
    expect(form.querySelector<HTMLSelectElement>('select[name="header"]')!.value).toBe('x-api-key');
    expect(form.querySelector<HTMLInputElement>('input[name="credential"]')!.value).toBe('');
    expect(view.innerHTML).not.toContain('secret-marker');
  });

  it('keeps the last successful advisory records visibly stale after a failed refresh, then recovers on retry', async () => {
    let reads = 0;
    vi.stubGlobal('fetch', async (input: string) => {
      if (input === '/api/advisories/status')
        return Response.json({ lastSuccessAt: '2026-01-01T00:00:00Z', stale: false });
      if (input.startsWith('/api/advisories?')) {
        reads += 1;
        return reads === 2
          ? Response.json({ code: 'CONTROL_PLANE_UNAVAILABLE' }, { status: 503 })
          : Response.json({
              items: [
                {
                  id: 'CVE-2026-12345',
                  revision: 1,
                  recordRevision: 1,
                  providerModifiedAt: '2026-01-01T00:00:00Z',
                  triageStatus: 'new',
                  detail: { title: 'Retained advisory' },
                },
              ],
              limit: 25,
              offset: 0,
            });
      }
      throw new Error(`Unexpected ${input}`);
    });
    const view = render(createElement(VulnerabilitiesView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.textContent).toContain('Retained advisory');
    const refresh = () => Array.from(view.querySelectorAll('button')).find(button => button.textContent === 'Refresh');
    await act(async () => {
      refresh()?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.textContent).toContain('Retained advisory');
    expect(view.textContent).toContain('Last successful records are stale');
    expect(view.textContent).not.toContain('No advisory records.');
    await act(async () => {
      refresh()?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.textContent).toContain('Retained advisory');
    expect(view.textContent).not.toContain('Last successful records are stale');
  });

  it('does not present an old empty advisory page as the result of a failed refresh', async () => {
    let reads = 0;
    vi.stubGlobal('fetch', async (input: string) => {
      if (input === '/api/advisories/status') return Response.json({ lastSuccessAt: null, stale: false });
      if (input.startsWith('/api/advisories?')) {
        reads += 1;
        return reads === 1
          ? Response.json({ items: [], limit: 25, offset: 0 })
          : Response.json({ code: 'CONTROL_PLANE_UNAVAILABLE' }, { status: 503 });
      }
      throw new Error(`Unexpected ${input}`);
    });
    const view = render(createElement(VulnerabilitiesView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.textContent).toContain('No advisory records.');
    const refresh = Array.from(view.querySelectorAll('button')).find(button => button.textContent === 'Refresh');
    await act(async () => {
      refresh?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.textContent).toContain('Last successful records are stale');
    expect(view.textContent).not.toContain('No advisory records.');
    expect(view.textContent).not.toContain('No records');
  });

  it('keeps a target policy and finite limits when its policy is absent from the first page', async () => {
    const limits = { maxRequests: 3, maxDurationSeconds: 20, maxResponseBytes: 2048, maxConcurrency: 1 };
    const target = {
      id: 'target-1',
      name: 'Owned target',
      revision: 1,
      entryUrl: 'http://owned.test/',
      approvedOrigins: ['http://owned.test'],
      allowedPaths: ['/'],
      excludedPaths: [],
      permittedMethods: ['GET'],
      environment: 'lab',
      authorizationEvidenceRef: 'approval:owned',
      policyId: 'older-policy',
      policyRevision: 4,
      scanLimits: limits,
      authProfileIds: [],
    };
    let submitted: unknown;
    vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
      if (input.startsWith('/api/targets/target-1') && init?.method === 'PUT') {
        submitted = JSON.parse(String(init.body));
        return Response.json({ ...target, name: 'Edited target', revision: 2 });
      }
      if (input.startsWith('/api/targets?')) return Response.json({ items: [target], limit: 25, offset: 0 });
      if (input.startsWith('/api/policies?'))
        return Response.json({
          items: [{ id: 'new-policy', name: 'New policy', revision: 1, scanLimits: { maxRequests: 100 } }],
          limit: 100,
          offset: 0,
        });
      throw new Error(`Unexpected ${input}`);
    });
    const view = render(createElement(TargetsView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const edit = Array.from(view.querySelectorAll('button')).find(button => button.textContent === 'Edit');
    await act(async () => {
      edit?.click();
    });
    expect(view.querySelector('dialog select[name="policy"]')).toBeNull();
    const form = view.querySelector<HTMLFormElement>('dialog form');
    expect(form).not.toBeNull();
    expect(form?.checkValidity()).toBe(false);
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(submitted).toBeUndefined();
    form?.querySelector<HTMLInputElement>('input[name="authorizationConfirmed"]')?.click();
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(submitted).toMatchObject({
      authorizationConfirmed: true,
      policyId: 'older-policy',
      policyRevision: 4,
      scanLimits: limits,
    });
  });

  it('reaches sanitized scan evidence after the first page', async () => {
    const scan = {
      id: 'scan-1',
      targetId: 'target-1',
      state: 'COMPLETED',
      reason: 'DONE',
      partial: false,
      cleanup: 'COMPLETE',
      budget: { remainingRequests: 2, remainingBytes: 2048, exhausted: false, reason: null },
      roles: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      request: { mode: 'http' },
    };
    vi.stubGlobal('fetch', async (input: string) => {
      if (input.startsWith('/api/scans?')) return Response.json({ items: [scan], limit: 25, offset: 0 });
      if (input.includes('/evidence?')) {
        const offset = Number(new URL(input, 'http://localhost').searchParams.get('offset'));
        const items =
          offset === 0
            ? Array.from({ length: 25 }, (_, index) => ({
                id: `e-${index}`,
                observation: { method: 'GET', origin: 'http://owned.test', path: `/first-${index}`, role: 'public' },
              }))
            : [
                {
                  id: 'e-25',
                  observation: {
                    method: 'GET',
                    origin: 'http://owned.test',
                    path: '/after-first-page',
                    role: 'public',
                  },
                },
              ];
        return Response.json({ items, limit: 25, offset });
      }
      if (input.startsWith('/api/investigations?') || input.startsWith('/api/approvals?'))
        return Response.json({ items: [], limit: 25, offset: 0 });
      if (input === '/api/settings')
        return Response.json({ investigation: { requested: false, modelConfigured: false, approvalCallback: null } });
      throw new Error(`Unexpected ${input}`);
    });
    const view = render(createElement(ScansView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await act(async () => {
      view.querySelector<HTMLButtonElement>('button.link')?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.textContent).toContain('/first-24');
    const detail = view.querySelector('dialog[aria-label="Scan scan-1"]');
    const next = Array.from(detail?.querySelectorAll('button') ?? []).find(button => button.textContent === 'Next');
    await act(async () => {
      next?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.textContent).toContain('/after-first-page');
  });
  it('retries a failed policy read and reveals the real empty-state message', async () => {
    let reads = 0;
    vi.stubGlobal('fetch', async (input: string) => {
      expect(input).toBe('/api/policies?limit=25&offset=0');
      reads += 1;
      return reads === 1
        ? Response.json({ code: 'CONTROL_PLANE_UNAVAILABLE' }, { status: 503 })
        : Response.json({ items: [], limit: 25, offset: 0 });
    });
    const view = render(createElement(PoliciesView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('Request failed: control plane unavailable.');
    expect(view.textContent).not.toContain('Create a policy before registering a target.');
    expect(view.textContent).not.toContain('No records');
    const retry = Array.from(view.querySelectorAll('button')).find(button => button.textContent === 'Reload');
    expect(retry).toBeDefined();
    await act(async () => {
      retry!.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.querySelector('[role="alert"]')).toBeNull();
    expect(view.textContent).toContain('Create a policy before registering a target.');
    expect(reads).toBe(2);
  });

  it('keeps overview counts and record claims unknown when their reads fail', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ code: 'CONTROL_PLANE_UNAVAILABLE' }, { status: 503 }));
    const view = render(createElement(OverviewView, { navigate: () => {} }));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('Request failed: control plane unavailable.');
    expect(view.querySelectorAll('.metric')[2]?.querySelector('strong')?.textContent).toBe('—');
    expect(view.textContent).toContain('Advisory syncUnavailable');
    expect(view.textContent).not.toContain('No scans recorded.');
    expect(view.textContent).not.toContain('No investigations recorded.');
    expect(view.textContent).not.toContain('No pending approvals in the latest records.');
    expect(view.textContent).not.toContain('No successful sync recorded');
  });

  it('shows a skipped advisory cycle without calling it complete', async () => {
    vi.stubGlobal('fetch', async (input: string) => {
      if (input === '/api/advisories/status')
        return Response.json({ lastSuccessAt: '2026-11-04T00:00:00Z', stale: true, incomplete: true });
      if (input.startsWith('/api/advisories?')) return Response.json({ items: [], limit: 25, offset: 0 });
      if (input === '/api/advisories/sync')
        return Response.json({ outcome: 'SKIPPED', reasonCode: 'ADVISORY_DETAIL_PRIMARY_OTHER_4XX' });
      throw new Error(`Unexpected ${input}`);
    });
    const view = render(createElement(VulnerabilitiesView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const sync = Array.from(view.querySelectorAll('button')).find(
      button => button.textContent === 'Synchronize advisories',
    );
    await act(async () => {
      sync?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.querySelector('[role="status"]')?.textContent).toContain('Advisory synchronization skipped');
    expect(view.querySelector('[role="status"]')?.textContent).toContain('ADVISORY_DETAIL_PRIMARY_OTHER_4XX');
    expect(view.textContent).not.toContain('Advisory synchronization completed.');
  });

  it('does not call a failed advisory status read an unsynced inbox', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ code: 'CONTROL_PLANE_UNAVAILABLE' }, { status: 503 }));
    const view = render(createElement(VulnerabilitiesView));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('Request failed: control plane unavailable.');
    expect(view.textContent).toContain('Inbox: Unavailable');
    expect(view.textContent).not.toContain('No sync');
    expect(view.textContent).not.toContain('No advisory records.');
    expect(view.textContent).not.toContain('No records');
  });

  it('presents an empty result and authentication failure as distinct visible states', () => {
    const view = render(
      createElement(
        'div',
        null,
        createElement(Empty, null, 'No scans recorded.'),
        createElement(Status, { value: 'AUTH_REQUIRED' }),
        createElement(Notice, { code: 'INCORRECT_BOOTSTRAP_SECRET' }),
        createElement(Pager, { offset: 0, count: 0, limit: 25, onChange: () => {} }),
      ),
    );
    expect(view.textContent).toContain('No scans recorded.');
    expect(view.textContent).toContain('AUTH REQUIRED');
    expect(view.querySelector('[role="alert"]')?.textContent).toBe('Incorrect bootstrap secret. Try again.');
    expect(view.textContent).toContain('No records');
    expect(Array.from(view.querySelectorAll('button')).filter(button => button.disabled)).toHaveLength(2);
  });

  it('keeps an invalid policy in the form and exposes native field validation', () => {
    const saved = vi.fn();
    const closed = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const view = render(createElement(PolicyForm, { onSaved: saved, onClose: closed }));
    const form = view.querySelector('form');
    const name = view.querySelector<HTMLInputElement>('input[name="name"]');
    const requests = view.querySelector<HTMLInputElement>('input[name="requests"]');
    const save = Array.from(view.querySelectorAll('button')).find(button => button.textContent === 'Save policy');
    expect(form && name && requests && save).toBeTruthy();
    expect(form!.checkValidity()).toBe(false);
    expect(name!.validity.valueMissing).toBe(true);
    expect(name!.validationMessage).not.toBe('');
    act(() => save!.click());
    expect(saved).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    name!.value = 'Owned lab policy';
    requests!.value = '0';
    expect(requests!.validity.rangeUnderflow).toBe(true);
    expect(requests!.validationMessage).not.toBe('');
    act(() => save!.click());
    expect(saved).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(view.querySelector('dialog[open]')).not.toBeNull();
  });
});
