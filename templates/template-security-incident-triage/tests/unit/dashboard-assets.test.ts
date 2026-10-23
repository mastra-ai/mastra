/* eslint-disable @typescript-eslint/no-explicit-any -- VM DOM fixture intentionally models dynamic browser nodes. */
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

import { dashboardJs } from '../../src/app/dashboard/assets.js';

type Element = {
  tagName: string;
  dataset: Record<string, string>;
  textContent: string;
  id: string;
  children: Element[];
  append(...values: Element[]): void;
  replaceChildren(): void;
};

function element(tagName: string): Element {
  return {
    tagName,
    dataset: {},
    textContent: '',
    id: '',
    children: [],
    append(...values) {
      this.children.push(...values);
    },
    replaceChildren() {
      this.children = [];
    },
  };
}

function liveDashboardFixture(canDecide: boolean) {
  const roots: any[] = [];
  const make = (tag: string): any => {
    const node: any = element(tag);
    node.attributes = new Map<string, string>();
    node.listeners = new Map<string, (event: any) => unknown>();
    node.isConnected = true;
    node.addEventListener = (type: string, listener: (event: any) => unknown) => node.listeners.set(type, listener);
    node.setAttribute = (name: string, value: string) => node.attributes.set(name, value);
    node.removeAttribute = (name: string) => node.attributes.delete(name);
    node.querySelector = (selector: string) => find(node.children, selector);
    node.querySelectorAll = (selector: string) => findAll(node.children, selector);
    node.append = (...values: any[]) => {
      for (const value of values) {
        value.isConnected = node.isConnected;
        node.children.push(value);
      }
    };
    node.replaceChildren = (...values: any[]) => {
      const disconnect = (value: any) => {
        value.isConnected = false;
        for (const child of value.children ?? []) disconnect(child);
      };
      for (const child of node.children) disconnect(child);
      node.children = [];
      node.append(...values);
    };
    node.showModal = () => {
      node.open = true;
    };
    node.close = () => {
      node.open = false;
      node.listeners.get('close')?.({});
    };
    node.focus = () => {
      document.activeElement = node;
    };
    return node;
  };
  const matches = (value: any, selector: string) => {
    const data = /^\[data-(.+)\]$/u.exec(selector);
    const name = /^\[name="(.+)"\]$/u.exec(selector);
    return data?.[1]
      ? data[1].replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase()) in value.dataset
      : name?.[1] === value.name || selector === value.tagName;
  };
  const find = (values: any[], selector: string): any =>
    values.find(value => matches(value, selector)) ??
    values.map(value => find(value.children ?? [], selector)).find(Boolean) ??
    null;
  const findAll = (values: any[], selector: string): any[] =>
    selector
      .split(',')
      .flatMap(part =>
        values.flatMap(value => [...(matches(value, part) ? [value] : []), ...findAll(value.children ?? [], part)]),
      );
  const root = make('section');
  root.dataset = {
    incidentId: 'incident_1',
    timelineCursor: 'incident_1:1',
    canDecide: String(canDecide),
    canReview: String(canDecide),
    csrfToken: 'csrf',
  };
  const timeline = make('div');
  timeline.dataset.timeline = '';
  const evidence = make('section');
  evidence.dataset.evidenceProjection = '';
  const triage = make('div');
  triage.dataset.triageProjection = '';
  const operational = make('section');
  operational.dataset.operationalProjection = '';
  const decisionHost = make('div');
  decisionHost.dataset.decisionHost = '';
  const summary = make('p');
  summary.dataset.incidentSummary = '';
  const live = make('p');
  live.dataset.liveStatus = '';
  roots.push(root, timeline, evidence, triage, operational, decisionHost, summary, live);
  const document: any = {
    activeElement: null,
    querySelector: (selector: string) => find(roots, selector),
    querySelectorAll: (selector: string) => findAll(roots, selector),
    getElementById: (id: string) => findAll(roots, '').find(value => value.id === id) ?? null,
    createElement: make,
  };
  class EventSource {
    static latest: EventSource;
    static all: EventSource[] = [];
    onmessage?: (event: { data: string }) => void;
    closed = false;
    listeners = new Map<string, () => void>();
    constructor(readonly url: string) {
      EventSource.latest = this;
      EventSource.all.push(this);
    }
    addEventListener(type: string, listener: () => void) {
      this.listeners.set(type, listener);
    }
    close() {
      this.closed = true;
    }
  }
  const responses: any[] = [];
  const timers = new Map<number, () => void>();
  let nextTimerId = 0;
  class FormData {
    constructor(private readonly form: any) {}
    get(name: string) {
      const all = (values: any[]): any[] => values.flatMap(value => [value, ...all(value.children ?? [])]);
      return all([this.form]).find(value => value.name === name)?.value;
    }
  }
  vm.runInNewContext(dashboardJs, {
    document,
    window: { EventSource },
    EventSource,
    FormData,
    setTimeout: (callback: () => void) => {
      nextTimerId += 1;
      timers.set(nextTimerId, callback);
      return nextTimerId;
    },
    clearTimeout: (timerId: number) => timers.delete(timerId),
    fetch: async () => {
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    },
  });
  return {
    document,
    source: EventSource,
    enqueue(response: unknown) {
      responses.push(response);
    },
    emitEvent(sequence: number, data = { sequence, type: 'incident.status_changed' }) {
      EventSource.latest.onmessage?.({ data: JSON.stringify(data) });
    },
    flushRetry() {
      const timer = timers.entries().next().value;
      if (!timer) return;
      timers.delete(timer[0]);
      timer[1]();
    },
    timerCount() {
      return timers.size;
    },
    emit(detail: unknown, sequence = 2) {
      responses.push({ ok: true, json: async () => detail });
      EventSource.latest.onmessage?.({ data: JSON.stringify({ sequence }) });
    },
  };
}

function decisionDetail(overrides: Record<string, unknown> = {}) {
  return {
    incident: { severity: 'high', status: 'awaiting_approval' },
    evidence: [],
    triage: { summary: 'triage', runbook: 'runbook', actions: [] },
    plan: {
      planId: 'plan-1',
      planHashVersion: 1,
      planHash: 'a'.repeat(64),
      expiresAt: '2099-08-28T18:15:00.000Z',
    },
    approval: { decision: null },
    actions: [],
    outcome: { status: 'pending', completedCount: 0, failedCount: 0 },
    timelineCursor: 'incident_1:2',
    timeline: [],
    ...overrides,
  };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('dashboard dashboard progressive enhancement', () => {
  it('replaces visible plan A with B and submits the same B binding', async () => {
    const make = (tag: string): any => {
      const value: any = element(tag);
      value.listeners = new Map<string, (event: any) => unknown>();
      value.addEventListener = (type: string, listener: (event: any) => unknown) => value.listeners.set(type, listener);
      value.setAttribute = () => undefined;
      value.querySelector = (selector: string) => find(value.children, selector);
      value.querySelectorAll = (selector: string) => findAll(value.children, selector);
      value.close = () => undefined;
      value.showModal = () => undefined;
      value.focus = () => undefined;
      return value;
    };
    const matches = (value: any, selector: string) => {
      const data = /^\[data-(.+)\]$/u.exec(selector);
      const name = /^\[name="(.+)"\]$/u.exec(selector);
      return data?.[1]
        ? data[1].replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase()) in value.dataset
        : name?.[1] === value.name;
    };
    const find = (values: any[], selector: string): any =>
      values.find(value => matches(value, selector)) ??
      values.map(value => find(value.children ?? [], selector)).find(Boolean) ??
      null;
    const findAll = (values: any[], selector: string): any[] =>
      values.flatMap(value => [
        ...(matches(value, selector) ? [value] : []),
        ...findAll(value.children ?? [], selector),
      ]);
    const root: any = make('section');
    root.dataset = {
      incidentId: 'incident_1',
      timelineCursor: 'incident_1:1',
      canDecide: 'true',
      csrfToken: 'csrf',
    };
    const timeline: any = make('div');
    timeline.dataset.timeline = '';
    const evidence: any = make('section');
    evidence.dataset.evidenceProjection = '';
    const triage: any = make('div');
    triage.dataset.triageProjection = '';
    const old = make('p');
    old.textContent = 'OLD PLAN A';
    triage.append(old);
    const operational: any = make('section');
    operational.dataset.operationalProjection = '';
    const decisionHost: any = make('div');
    decisionHost.dataset.decisionHost = '';
    const summary: any = make('p');
    summary.dataset.incidentSummary = '';
    const live: any = make('p');
    live.dataset.liveStatus = '';
    const roots = [root, timeline, evidence, triage, operational, decisionHost, summary, live];
    const document: any = {
      querySelector: (selector: string) => find(roots, selector),
      querySelectorAll: (selector: string) => findAll(roots, selector),
      getElementById: (identifier: string) => findAll(roots, '').find(value => value.id === identifier) ?? null,
      createElement: make,
    };
    class EventSource {
      static latest: EventSource;
      onmessage?: (event: { data: string; lastEventId: string }) => void;
      listeners = new Map<string, () => void>();
      constructor(readonly url: string) {
        EventSource.latest = this;
      }
      addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, listener);
      }
      close() {}
    }
    const projection = (planId: string, cursor: number) => ({
      incident: { severity: 'high', status: 'awaiting_approval' },
      evidence: [
        {
          state: 'missing',
          source: 'MISSING B',
          provider: 'p',
          confidence: 0,
          observedAt: 't',
        },
      ],
      triage: {
        summary: 'TRIAGE B',
        runbook: 'RB-B',
        facts: ['FACT B'],
        hypotheses: ['HYPOTHESIS B'],
        actions: [
          {
            actionId: 'ACTION B',
            type: 'revoke_session',
            targetRef: 'target-b',
            impact: 'impact-b',
            preconditions: ['pre-b'],
            rollback: 'rollback-b',
            verification: 'verify-b',
          },
        ],
      },
      plan: {
        planId,
        planHashVersion: 1,
        planHash: 'b'.repeat(64),
        expiresAt: '2099-08-28T18:15:00.000Z',
      },
      approval: null,
      actions: [],
      outcome: { status: 'pending', completedCount: 0, failedCount: 0 },
      timelineCursor: 'incident_1:' + cursor,
      timeline: [{ sequence: cursor, type: 'incident.status_changed', occurredAt: 't' }],
    });
    let submitted: unknown;
    class FormData {
      constructor(private readonly form: any) {}
      get(name: string) {
        const all = (values: any[]): any[] => values.flatMap(value => [value, ...all(value.children ?? [])]);
        return all([this.form]).find(value => value.name === name)?.value ?? null;
      }
    }
    const responses = [
      { ok: true, json: async () => projection('plan-b', 2) },
      { ok: true, json: async () => projection('plan-b', 2) },
      { ok: false },
      {
        ok: true,
        json: async () => ({
          ...projection('plan-b', 3),
          incident: { severity: 'high', status: 'closed' },
          triage: null,
          plan: null,
        }),
      },
    ];
    vm.runInNewContext(dashboardJs, {
      document,
      window: { EventSource },
      EventSource,
      FormData,
      setTimeout: () => 1,
      fetch: async (_url: string, init?: { method?: string; body?: string }) => {
        if (init?.method === 'POST') {
          submitted = JSON.parse(init.body ?? '{}');
          return { ok: true };
        }
        return responses.shift();
      },
    });
    EventSource.latest.onmessage?.({
      lastEventId: 'incident_1:2',
      data: JSON.stringify({
        sequence: 2,
        type: 'incident.status_changed',
        occurredAt: 't',
      }),
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(JSON.stringify(triage.children)).not.toContain('OLD PLAN A');
    expect(JSON.stringify(triage.children)).toContain('ACTION B');
    expect(JSON.stringify(triage.children)).toContain('Fingerprint v1');
    const form: any = document.querySelector('[data-decision-form]');
    expect(form).not.toBeNull();
    expect(form.dataset.planBinding).toContain('plan-b');
    const select: any = form.querySelector('[name="decision"]');
    select.value = 'approved';
    await form.listeners.get('submit')?.({ preventDefault: () => undefined });
    expect(submitted).toMatchObject({
      planId: 'plan-b',
      planHash: 'b'.repeat(64),
    });
    EventSource.latest.onmessage?.({
      lastEventId: 'incident_1:3',
      data: JSON.stringify({
        sequence: 3,
        type: 'incident.status_changed',
        occurredAt: 't',
      }),
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(JSON.stringify(triage.children)).toContain('ACTION B');
    expect(document.querySelector('[data-decision-form]')?.dataset.planBinding).toContain('plan-b');
    EventSource.latest.onmessage?.({
      lastEventId: 'incident_1:4',
      data: JSON.stringify({
        sequence: 4,
        type: 'incident.status_changed',
        occurredAt: 't',
      }),
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.querySelector('[data-decision-form]')).toBeNull();
  });

  it('buffers burst SSE events until monotonic detail snapshots confirm them and rotates the decision binding atomically', async () => {
    const timeline = element('div');
    const operational = element('section');
    const evidence = element('section');
    const triage = element('div');
    const decisionHost = element('div');
    const live = { textContent: '' };
    const summary = { textContent: '' };
    const root = {
      dataset: { incidentId: 'incident_1', timelineCursor: 'incident_1:1' },
    };
    const inputs = new Map(
      ['planId', 'planHashVersion', 'planHash', 'planExpiresAt'].map(name => [name, { value: `old-${name}` }]),
    );
    const form = {
      dataset: { planBinding: 'old:1:old:2026-08-28T18:00:00.000Z' },
      addEventListener: () => undefined,
      querySelector(selector: string) {
        const match = /^\[name="(.+)"\]$/u.exec(selector);
        return match?.[1] ? (inputs.get(match[1]) ?? null) : null;
      },
      querySelectorAll: () => [],
      setAttribute: () => undefined,
    };
    const dialog = {
      addEventListener: () => undefined,
      close: () => undefined,
    };
    const document = {
      querySelector(selector: string) {
        if (selector === '[data-incident-id]') return root;
        if (selector === '[data-live-status]') return live;
        if (selector === '[data-timeline]') return timeline;
        if (selector === '[data-incident-summary]') return summary;
        if (selector === '[data-operational-projection]') return operational;
        if (selector === '[data-evidence-projection]') return evidence;
        if (selector === '[data-triage-projection]') return triage;
        if (selector === '[data-decision-host]') return decisionHost;
        if (selector === '[data-decision-form]') return form;
        return null;
      },
      querySelectorAll(selector: string) {
        return selector === '[data-timeline-event]' ? [{ dataset: { timelineEvent: '1' } }] : [];
      },
      getElementById: () => dialog,
      createElement: element,
    };
    class EventSource {
      static all: EventSource[] = [];
      onopen?: () => void;
      onmessage?: (event: { data: string; lastEventId: string }) => void;
      onerror?: () => void;
      listeners = new Map<string, () => void>();
      constructor(readonly url: string) {
        EventSource.all.push(this);
      }
      addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, listener);
      }
      close() {}
    }
    const resolvers: Array<(value: unknown) => void> = [];
    const response = (cursor: number) => ({
      ok: true,
      json: async () => ({
        incident: { severity: 'high', status: 'awaiting_approval' },
        plan: {
          planId: 'new-plan',
          planHashVersion: 1,
          planHash: 'b'.repeat(64),
          expiresAt: '2099-08-28T18:15:00.000Z',
        },
        approval: { decision: null },
        actions: [],
        outcome: { status: 'pending', completedCount: 0, failedCount: 0 },
        timelineCursor: `incident_1:${cursor}`,
        timeline: Array.from({ length: cursor - 1 }, (_, index) => ({
          sequence: index + 2,
          type: 'incident.status_changed',
          occurredAt: '2026-08-28T00:00:00.000Z',
        })),
      }),
    });
    vm.runInNewContext(dashboardJs, {
      document,
      window: { EventSource },
      EventSource,
      setTimeout: () => 1,
      fetch: () => new Promise(resolve => resolvers.push(resolve)),
    });
    for (const sequence of [2, 3, 4]) {
      EventSource.all[0]?.onmessage?.({
        lastEventId: `incident_1:${sequence}`,
        data: JSON.stringify({
          sequence,
          type: 'incident.status_changed',
          occurredAt: '2026-08-28T00:00:00.000Z',
        }),
      });
    }
    expect(root.dataset.timelineCursor).toBe('incident_1:1');
    expect(timeline.children).toHaveLength(0);
    expect(resolvers).toHaveLength(1);

    resolvers[0]?.(response(2));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(root.dataset.timelineCursor).toBe('incident_1:2');
    expect(EventSource.all).toHaveLength(1);
    expect(resolvers).toHaveLength(2);

    resolvers[1]?.(response(4));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(root.dataset.timelineCursor).toBe('incident_1:4');
    expect(EventSource.all).toHaveLength(1);
    expect(JSON.stringify(operational.children)).toContain('Decision and execution');
  });

  it('materializes an approval after approval-less SSR, preserves headings, and keeps the last confirmed projection on refresh failure', async () => {
    const timeline = element('div');
    const operational = element('section');
    const evidence = element('section');
    const triage = element('div');
    const decisionHost = element('div');
    const live = { textContent: '' };
    const summary = { textContent: '' };
    const root = {
      dataset: { incidentId: 'incident_1', timelineCursor: 'incident_1:1' },
    };
    const document = {
      querySelector(selector: string) {
        if (selector === '[data-incident-id]') return root;
        if (selector === '[data-live-status]') return live;
        if (selector === '[data-timeline]') return timeline;
        if (selector === '[data-incident-summary]') return summary;
        if (selector === '[data-operational-projection]') return operational;
        if (selector === '[data-evidence-projection]') return evidence;
        if (selector === '[data-triage-projection]') return triage;
        if (selector === '[data-decision-host]') return decisionHost;
        return null;
      },
      querySelectorAll(selector: string) {
        return selector === '[data-timeline-event]' ? [{ dataset: { timelineEvent: '1' } }] : [];
      },
      getElementById: () => null,
      createElement: element,
    };
    class EventSource {
      static all: EventSource[] = [];
      onopen?: () => void;
      onmessage?: (event: { data: string; lastEventId: string }) => void;
      onerror?: () => void;
      url: string;
      listeners = new Map<string, () => void>();
      constructor(url: string) {
        this.url = url;
        EventSource.all.push(this);
      }
      addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, listener);
      }
      close() {}
    }
    let failRefresh = false;
    vm.runInNewContext(dashboardJs, {
      document,
      window: { EventSource },
      EventSource,
      setTimeout: () => 1,
      fetch: async () => {
        if (failRefresh) return { ok: false };
        return {
          ok: true,
          json: async () => ({
            incident: { severity: 'high', status: 'awaiting_approval' },
            plan: {
              planHashVersion: 1,
              planHash: 'a'.repeat(64),
              expiresAt: '2099-08-28T18:15:00.000Z',
            },
            approval: { decision: 'approved' },
            actions: [
              {
                actionId: 'action_1',
                type: 'revoke_session',
                status: 'completed',
              },
            ],
            outcome: { status: 'completed', completedCount: 1, failedCount: 0 },
            timelineCursor: 'incident_1:3',
            timeline: [
              {
                sequence: 2,
                type: 'approval.decided',
                occurredAt: '2026-08-28T00:00:00.000Z',
              },
              {
                sequence: 3,
                type: 'containment.completed',
                occurredAt: '2026-08-28T00:00:01.000Z',
              },
            ],
          }),
        };
      },
    });
    expect(EventSource.all[0]?.url).toContain('after=incident_1%3A1');

    EventSource.all[0]?.onmessage?.({
      lastEventId: 'incident_1:2',
      data: JSON.stringify({
        sequence: 2,
        type: 'approval.decided',
        occurredAt: '2026-08-28T00:00:00.000Z',
      }),
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(summary.textContent).toBe('high · awaiting_approval');
    expect(root.dataset.timelineCursor).toBe('incident_1:3');
    expect(JSON.stringify(timeline.children)).toContain('Decision recorded');
    expect(JSON.stringify(timeline.children)).toContain('Containment completed');
    expect(JSON.stringify(operational.children)).toContain('Decision and execution');
    expect(JSON.stringify(operational.children)).toContain('Approved');
    expect(JSON.stringify(operational.children)).toContain('Completed');
    expect(JSON.stringify(operational.children)).toContain('Revoke suspicious session');

    EventSource.all[0]?.listeners.get('resync')?.();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(EventSource.all).toHaveLength(2);
    expect(EventSource.all[1]?.url).toContain('after=incident_1%3A3');

    failRefresh = true;
    EventSource.all[1]?.listeners.get('resync')?.();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(live.textContent).toBe('Incident refresh failed. Showing last confirmed state.');
    expect(root.dataset.timelineCursor).toBe('incident_1:3');
    expect(EventSource.all).toHaveLength(2);
    expect(JSON.stringify(operational.children)).toContain('approval-heading');
    expect(dashboardJs).not.toContain('innerHTML');
    expect(dashboardJs).toContain('/approvals');
    expect(dashboardJs).not.toContain('location.reload');
    expect(dashboardJs).toContain('X-CSRF-Token');
  });

  it('gives a manager with no SSR plan a complete labelled decision dialog when a valid plan arrives live', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.emit(decisionDetail());
    await tick();

    const button: any = fixture.document.querySelector('[data-open-decision]');
    const dialog: any = fixture.document.getElementById('decision-dialog');
    const form: any = fixture.document.querySelector('[data-decision-form]');
    expect(button).not.toBeNull();
    expect(form.dataset.planBinding).toContain('plan-1');
    expect(dialog.attributes.get('aria-labelledby')).toBe('decision-heading');
    expect(dialog.attributes.get('aria-describedby')).toBe('decision-help decision-error');
    expect(
      form
        .querySelectorAll('label')
        .map((label: any) => label.htmlFor)
        .filter(Boolean),
    ).toEqual(['decision-select', 'decision-reason']);
    expect(form.querySelector('[name="reason"]').attributes.get('aria-describedby')).toBe('decision-help');
  });

  it('offers a resolved-and-close action after manual handling is accepted', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.emit(
      decisionDetail({
        incident: {
          severity: null,
          status: 'investigating',
          workflowRunId: 'run-1',
        },
        triage: null,
        plan: null,
        approval: null,
        manualReview: {
          status: 'manual-review',
          reasonCodes: ['CONFIDENCE_BELOW_THRESHOLD'],
          decision: {
            decision: 'accepted',
            decidedAt: '2026-08-28T18:02:00.000Z',
            reason: null,
          },
        },
      }),
    );
    await tick();

    const button: any = fixture.document.querySelector('[data-open-manual-review]');
    const form: any = fixture.document.querySelector('[data-manual-review-form]');
    const select: any = form.querySelector('[name="decision"]');
    const reason: any = form.querySelector('[name="reason"]');
    expect(button.textContent).toBe('Finish manual review');
    expect(select.children.map((option: any) => option.value)).toEqual(['resolved']);
    expect(reason.placeholder).toContain('summarize how the incident was resolved');
  });

  it('never gives a viewer controls when a valid plan arrives after plan-less SSR', async () => {
    const fixture = liveDashboardFixture(false);
    fixture.emit(decisionDetail());
    await tick();

    expect(fixture.document.querySelector('[data-open-decision]')).toBeNull();
    expect(fixture.document.querySelector('[data-decision-form]')).toBeNull();
  });

  it('never materializes controls for a live expired plan', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.emit(
      decisionDetail({
        plan: {
          ...decisionDetail().plan,
          expiresAt: '2000-01-01T00:00:00.000Z',
        },
      }),
    );
    await tick();

    expect(fixture.document.querySelector('[data-open-decision]')).toBeNull();
    expect(fixture.document.querySelector('[data-decision-form]')).toBeNull();
  });

  it('removes an open dialog on terminal or expired updates and restores connected fallback focus', async () => {
    for (const replacement of [
      decisionDetail({
        incident: { severity: 'high', status: 'closed' },
        plan: null,
        approval: { decision: 'approved' },
        timelineCursor: 'incident_1:3',
      }),
      decisionDetail({
        plan: {
          ...decisionDetail().plan,
          expiresAt: '2000-01-01T00:00:00.000Z',
        },
        timelineCursor: 'incident_1:3',
      }),
    ]) {
      const fixture = liveDashboardFixture(true);
      fixture.emit(decisionDetail());
      await tick();
      const opener: any = fixture.document.querySelector('[data-open-decision]');
      opener.listeners.get('click')?.({});
      expect(fixture.document.getElementById('decision-dialog').open).toBe(true);

      fixture.emit(replacement, 3);
      await tick();
      expect(fixture.document.querySelector('[data-decision-form]')).toBeNull();
      expect(fixture.document.activeElement?.isConnected).toBe(true);
    }
  });

  it('retries an unconfirmed live event after detail failure without advancing the confirmed cursor', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.enqueue({ ok: false });
    fixture.emitEvent(2);
    await tick();
    expect(fixture.document.querySelector('[data-incident-id]').dataset.timelineCursor).toBe('incident_1:1');

    fixture.enqueue({ ok: true, json: async () => decisionDetail() });
    fixture.emitEvent(2);
    await tick();
    expect(fixture.document.querySelector('[data-incident-id]').dataset.timelineCursor).toBe('incident_1:2');
  });

  it('applies an unconfirmed event through bounded detail retry after a transient failure', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.enqueue({ ok: false });
    fixture.emitEvent(2);
    await tick();
    fixture.enqueue({ ok: true, json: async () => decisionDetail() });
    fixture.flushRetry();
    await tick();

    expect(fixture.document.querySelector('[data-incident-id]').dataset.timelineCursor).toBe('incident_1:2');
  });

  it('resyncs a monotonic SSE gap instead of silently discarding it', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.enqueue({
      ok: true,
      json: async () => decisionDetail({ timelineCursor: 'incident_1:3' }),
    });
    fixture.emitEvent(3);
    await tick();

    expect(fixture.source.all[0]?.closed).toBe(true);
    expect(fixture.source.all).toHaveLength(2);
    expect(fixture.document.querySelector('[data-incident-id]').dataset.timelineCursor).toBe('incident_1:3');
  });

  it('does not reconnect a newer resync from an older in-flight snapshot when its own refresh fails', async () => {
    const fixture = liveDashboardFixture(true);
    let resolveFirst!: (value: unknown) => void;
    fixture.enqueue(
      new Promise(resolve => {
        resolveFirst = resolve;
      }),
    );
    fixture.emitEvent(2);
    fixture.enqueue({ ok: false });
    fixture.emitEvent(4);
    resolveFirst({
      ok: true,
      json: async () => decisionDetail({ timelineCursor: 'incident_1:2' }),
    });
    await tick();
    await tick();

    expect(fixture.document.querySelector('[data-incident-id]').dataset.timelineCursor).toBe('incident_1:2');
    expect(fixture.source.all).toHaveLength(1);
    expect(fixture.source.all[0]?.closed).toBe(true);

    fixture.enqueue({
      ok: true,
      json: async () => decisionDetail({ timelineCursor: 'incident_1:4' }),
    });
    fixture.flushRetry();
    await tick();
    expect(fixture.source.all).toHaveLength(2);
    expect(fixture.source.all[1]?.url).toContain('after=incident_1%3A4');
  });

  it('absorbs coalesced successful POST refreshes into the current resync generation', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.emit(decisionDetail());
    await tick();
    const form: any = fixture.document.querySelector('[data-decision-form]');
    let resolvePostOne!: (value: unknown) => void;
    let resolvePostTwo!: (value: unknown) => void;
    let resolveResync!: (value: unknown) => void;
    fixture.enqueue(
      new Promise(resolve => {
        resolvePostOne = resolve;
      }),
    );
    const firstPost = form.listeners.get('submit')?.({
      preventDefault: () => undefined,
    });
    fixture.enqueue(
      new Promise(resolve => {
        resolvePostTwo = resolve;
      }),
    );
    const secondPost = form.listeners.get('submit')?.({
      preventDefault: () => undefined,
    });
    fixture.enqueue(
      new Promise(resolve => {
        resolveResync = resolve;
      }),
    );
    fixture.emitEvent(4);
    resolvePostOne({ ok: true });
    resolvePostTwo({ ok: true });
    await tick();
    resolveResync({
      ok: true,
      json: async () => decisionDetail({ timelineCursor: 'incident_1:4' }),
    });
    await Promise.all([firstPost, secondPost]);
    await tick();

    expect(fixture.document.querySelector('[data-incident-id]').dataset.timelineCursor).toBe('incident_1:4');
    expect(fixture.source.all).toHaveLength(2);
    expect(fixture.source.all[0]?.closed).toBe(true);
    expect(fixture.source.all[1]?.closed).toBe(false);
    expect(fixture.source.all[1]?.url).toContain('after=incident_1%3A4');
    expect(fixture.timerCount()).toBe(0);
  });

  it('keeps queued normal refreshes on the resync epoch after failure and lets its retry reconnect', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.emit(decisionDetail());
    await tick();
    const form: any = fixture.document.querySelector('[data-decision-form]');
    let resolvePost!: (value: unknown) => void;
    fixture.enqueue(
      new Promise(resolve => {
        resolvePost = resolve;
      }),
    );
    const post = form.listeners.get('submit')?.({
      preventDefault: () => undefined,
    });
    fixture.enqueue({ ok: false });
    fixture.emitEvent(4);
    resolvePost({ ok: true });
    await post;
    await tick();
    expect(fixture.source.all).toHaveLength(1);
    expect(fixture.source.all[0]?.closed).toBe(true);
    expect(fixture.timerCount()).toBe(1);

    fixture.enqueue({
      ok: true,
      json: async () => decisionDetail({ timelineCursor: 'incident_1:4' }),
    });
    fixture.flushRetry();
    await tick();
    expect(fixture.source.all).toHaveLength(2);
    expect(fixture.source.all[1]?.url).toContain('after=incident_1%3A4');
  });

  it('keeps the complete redacted projection and restores an open dialog to its opener on cancel', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.emit(
      decisionDetail({
        evidence: [
          {
            state: 'missing',
            source: 'source',
            provider: 'provider',
            confidence: 0,
            observedAt: '2026-08-28T00:00:00.000Z',
          },
        ],
        triage: {
          summary: 'triage',
          runbook: 'runbook',
          facts: ['confirmed fact'],
          hypotheses: ['test hypothesis'],
          actions: [],
        },
        approval: {
          decision: 'rejected',
          decidedAt: '2026-08-28T01:00:00.000Z',
          reason: 'operator rationale',
        },
        timeline: [
          {
            sequence: 2,
            type: 'approval.decided',
            occurredAt: '2026-08-28T01:00:00.000Z',
            payloadRedacted: {
              decision: 'rejected',
              reason: 'redacted reason',
            },
          },
        ],
      }),
    );
    await tick();

    const text = JSON.stringify(fixture.document.querySelector('[data-triage-projection]').children);
    expect(text).toContain('confirmed fact');
    expect(text).toContain('test hypothesis');
    expect(JSON.stringify(fixture.document.querySelector('[data-evidence-projection]').children)).toContain(
      'No signals available',
    );
    expect(JSON.stringify(fixture.document.querySelector('[data-operational-projection]').children)).toContain(
      'operator rationale',
    );
    expect(JSON.stringify(fixture.document.querySelector('[data-timeline]').children)).toContain('redacted reason');

    // A fresh pending snapshot makes the manager dialog eligible for this focus probe.
    fixture.emit(decisionDetail({ timelineCursor: 'incident_1:3' }), 3);
    await tick();
    const opener: any = fixture.document.querySelector('[data-open-decision]');
    opener.listeners.get('click')?.({});
    const dialog: any = fixture.document.getElementById('decision-dialog');
    dialog.listeners.get('cancel')?.({});
    dialog.close();
    expect(fixture.document.activeElement).toBe(opener);
  });

  it('contains submit network errors, announces them, and clears busy controls for retry', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.emit(decisionDetail());
    await tick();
    const form: any = fixture.document.querySelector('[data-decision-form]');
    let reject!: (error: Error) => void;
    fixture.enqueue(
      new Promise((_, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    const submission = form.listeners.get('submit')?.({
      preventDefault: () => undefined,
    });
    await tick();
    expect(form.attributes.get('aria-busy')).toBe('true');
    expect(form.querySelectorAll('button').every((button: any) => button.disabled)).toBe(true);
    reject(new Error('offline'));
    await submission;

    expect(form.attributes.has('aria-busy')).toBe(false);
    expect(form.querySelectorAll('button').every((button: any) => !button.disabled)).toBe(true);
    expect(fixture.document.querySelector('[data-decision-error]').textContent).toContain('could not be sent');
    expect(fixture.document.querySelector('[data-live-status]').textContent).toContain('could not be sent');
    expect(fixture.document.querySelector('[data-incident-id]').dataset.timelineCursor).toBe('incident_1:2');
  });

  it('shows rejection validation inside the open decision dialog', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.emit(decisionDetail());
    await tick();
    const form: any = fixture.document.querySelector('[data-decision-form]');
    fixture.document.querySelector('[data-open-decision]').listeners.get('click')?.({});
    form.querySelector('[name="decision"]').value = 'rejected';

    await form.listeners.get('submit')?.({
      preventDefault: () => undefined,
    });

    expect(fixture.document.querySelector('[data-decision-error]').textContent).toContain('Explain why');
    expect(fixture.document.getElementById('decision-dialog').open).toBe(true);
  });

  it('explains a stale plan and refreshes away its decision controls', async () => {
    const fixture = liveDashboardFixture(true);
    fixture.emit(decisionDetail());
    await tick();
    const form: any = fixture.document.querySelector('[data-decision-form]');
    form.querySelector('[name="decision"]').value = 'approved';
    fixture.enqueue({ ok: false, status: 409 });
    fixture.enqueue({
      ok: true,
      json: async () =>
        decisionDetail({
          incident: { severity: 'high', status: 'failed' },
          timelineCursor: 'incident_1:3',
        }),
    });

    await form.listeners.get('submit')?.({
      preventDefault: () => undefined,
    });
    await tick();

    expect(fixture.document.querySelector('[data-live-status]').textContent).toContain('no longer current');
    expect(fixture.document.querySelector('[data-decision-form]')).toBeNull();
  });
});
