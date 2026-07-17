import { visibleWidth } from '@earendil-works/pi-tui';
import type {
  KnowledgeInspector,
  KnowledgeInspectorEntityDetail,
  KnowledgeInspectorPageDetail,
  KnowledgeInspectorRecordSummary,
  KnowledgeInspectorScopeTree,
} from '@mastra/code-sdk';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeBrowserComponent } from '../knowledge-browser.js';

const tree = (identityKey = 'identity-1'): KnowledgeInspectorScopeTree => ({
  identityKey,
  defaultLevel: 'resource',
  roots: [
    { level: 'org', id: 'org-1234567890-abcdefghijklmnopqrstuvwxyz', available: true },
    { level: 'resource', id: 'resource-project-alpha', available: true },
    { level: 'thread', id: 'thread-current', available: true },
  ],
});

function record(
  name: string,
  type: 'entity' | 'page' = 'entity',
  scope: 'org' | 'resource' | 'thread' = 'resource',
): KnowledgeInspectorRecordSummary {
  return {
    handle: `${type}:${name}`,
    type,
    name,
    kind: type === 'entity' ? 'project' : undefined,
    scope: { level: scope, id: `${scope}-id` },
    version: 1,
    updatedAt: '2026-07-15T00:00:00.000Z',
  };
}

function entityDetail(
  entity: KnowledgeInspectorRecordSummary,
  outgoingTargets = [] as KnowledgeInspectorRecordSummary[],
  incomingParents = [] as KnowledgeInspectorRecordSummary[],
): KnowledgeInspectorEntityDetail {
  return {
    identityKey: 'identity-1',
    scopeLevel: 'resource' as const,
    entity,
    facts: [
      {
        text: `${entity.name} ships Friday`,
        scope: entity.scope,
        sourceThreadId: 'thread-current',
        capturedAt: '2026-07-15T00:00:00.000Z',
      },
    ],
    incomingFacts: [],
    outgoingTargets: { items: outgoingTargets, partial: false },
    incomingParents: { items: incomingParents, partial: false },
  };
}

function pageDetail(page: KnowledgeInspectorRecordSummary): KnowledgeInspectorPageDetail {
  return {
    identityKey: 'identity-1',
    scopeLevel: 'resource' as const,
    page,
    body: 'Launch notes link to [[Atlas]].',
    bodyTruncated: false,
    links: [{ label: 'Atlas', entity: record('Atlas') }],
  };
}

function createInspector(overrides: Partial<KnowledgeInspector> = {}): KnowledgeInspector {
  const atlas = record('Atlas');
  const beta = record('Beta');
  const page = record('Launch brief', 'page');
  return {
    getScopeTree: vi.fn(async () => tree()),
    listEntities: vi.fn(async () => ({
      identityKey: 'identity-1',
      scopeLevel: 'resource' as const,
      items: [record('Organization policy', 'entity', 'org'), atlas],
    })),
    listPages: vi.fn(async () => ({ identityKey: 'identity-1', scopeLevel: 'resource' as const, items: [page] })),
    getEntity: vi.fn(async ({ handle }) =>
      handle === atlas.handle ? entityDetail(atlas, [beta]) : entityDetail(beta),
    ),
    getPage: vi.fn(async () => pageDetail(page)),
    listActivity: vi.fn(async () => ({
      identityKey: 'identity-1',
      scopeLevel: 'resource' as const,
      items: [
        {
          action: 'fact-created' as const,
          recordType: 'entity' as const,
          scope: atlas.scope,
          createdAt: '2026-07-15T00:00:00.000Z',
          record: atlas,
        },
      ],
    })),
    ...overrides,
  };
}

function createBrowser(inspector = createInspector()) {
  const requestRender = vi.fn();
  const onClose = vi.fn();
  const browser = new KnowledgeBrowserComponent({
    inspector,
    onClose,
    tui: { requestRender } as any,
  });
  browser.focused = true;
  return { browser, inspector, requestRender, onClose };
}

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

function text(browser: KnowledgeBrowserComponent, width = 100): string {
  return browser.render(width).map(stripAnsi).join('\n');
}

describe('KnowledgeBrowserComponent', () => {
  it('renders bound scope roots and middle-truncates long IDs at narrow widths', async () => {
    const { browser } = createBrowser();
    await settle();

    expect(text(browser, 120)).toContain('org-1234567890-abcdefghijklmnopqrstuvwxyz');
    const narrow = text(browser, 40);
    expect(narrow).toContain('…');
    for (const line of browser.render(40)) expect(visibleWidth(line)).toBeLessThanOrEqual(36);
  });

  it('uses keyboard navigation to select a root and labels exact and inherited records', async () => {
    const { browser, inspector } = createBrowser();
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();

    expect(inspector.listEntities).toHaveBeenCalledWith({ level: 'resource', sort: 'relevant', limit: 12 });
    expect(text(browser)).toContain('[inherited:org]');
    expect(text(browser)).toContain('[exact:resource]');
  });

  it('traverses entity connections without changing the selected scope', async () => {
    const { browser, inspector } = createBrowser();
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();

    expect(text(browser)).toContain('Outgoing links');
    expect(text(browser)).toContain('→ Beta');
    browser.handleInput('\r');
    await settle();
    expect(inspector.getEntity).toHaveBeenLastCalledWith({ handle: 'entity:Beta' });
    expect(text(browser)).toContain('Beta ships Friday');
    expect(text(browser)).toContain('Entities / Atlas / Beta');
    browser.handleInput('\x7f');
    expect(text(browser)).toContain('Atlas ships Friday');
    expect(text(browser)).toContain('resource:resource-project-alpha');
  });

  it('shows incoming parent relationships and navigates back through breadcrumbs', async () => {
    const atlas = record('Atlas');
    const portfolio = record('Portfolio');
    const inspector = createInspector({
      listEntities: vi.fn(async () => ({
        identityKey: 'identity-1',
        scopeLevel: 'resource' as const,
        items: [atlas],
        sort: 'relevant' as const,
        coverage: 'recent-window' as const,
      })),
      getEntity: vi.fn(async ({ handle }) =>
        handle === atlas.handle ? entityDetail(atlas, [], [portfolio]) : entityDetail(portfolio),
      ),
    });
    const { browser } = createBrowser(inspector);
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();
    browser.handleInput('\r');
    await settle();

    expect(text(browser)).toContain('Referenced by');
    expect(text(browser)).toContain('← Portfolio');
    browser.handleInput('\r');
    await settle();
    expect(text(browser)).toContain('Entities / Atlas / Portfolio');
    browser.handleInput('\x7f');
    expect(text(browser)).toContain('Referenced by');
  });

  it('cycles entity sorting between relevant, recent, and connected', async () => {
    const inspector = createInspector({
      listEntities: vi.fn(async input => ({
        identityKey: 'identity-1',
        scopeLevel: 'resource' as const,
        items: [
          { ...record(input.sort ?? 'relevant'), sampledRelationshipDegree: input.sort === 'recent' ? undefined : 3 },
        ],
        sort: input.sort,
        coverage: input.sort === 'recent' ? ('exact' as const) : ('recent-window' as const),
      })),
    });
    const { browser } = createBrowser(inspector);
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();
    expect(text(browser)).toContain('Sort: Relevant · recent window');
    expect(text(browser)).toContain('3 links');

    browser.handleInput('\x13');
    await settle();
    expect(text(browser)).toContain('Sort: Recent');
    expect(inspector.listEntities).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'recent', level: 'resource' }),
    );
    browser.handleInput('\x13');
    await settle();
    expect(text(browser)).toContain('Sort: Connected · recent window');
  });

  it('keeps pages separate, follows resolved page links, and leaves unresolved links as text', async () => {
    const page = record('Launch brief', 'page');
    const inspector = createInspector({
      getPage: vi.fn(async () => ({
        ...pageDetail(page),
        links: [{ label: 'Atlas', entity: record('Atlas') }, { label: 'Unknown' }],
      })),
    });
    const { browser } = createBrowser(inspector);
    await settle();
    browser.handleInput('\t');
    browser.handleInput('\t');
    await settle();

    expect(text(browser)).toContain('Launch brief');
    expect(text(browser)).not.toContain('Organization policy');
    browser.handleInput('\r');
    await settle();
    expect(text(browser)).toContain('Atlas → Atlas');
    expect(text(browser)).toContain('Unknown (unresolved)');
    browser.handleInput('\r');
    await settle();
    expect(inspector.getEntity).toHaveBeenCalledWith({ handle: 'entity:Atlas' });
  });

  it('filters names and ignores stale async responses', async () => {
    let resolveOld!: (value: any) => void;
    const old = new Promise(resolve => (resolveOld = resolve));
    const inspector = createInspector({
      listEntities: vi
        .fn()
        .mockImplementationOnce(() => old)
        .mockResolvedValueOnce({ identityKey: 'identity-1', scopeLevel: 'resource' as const, items: [record('Beta')] }),
    });
    const { browser } = createBrowser(inspector);
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    while (!vi.mocked(inspector.listEntities).mock.calls.length) await settle();
    browser.handleInput('b');
    await settle();
    resolveOld({ identityKey: 'identity-1', scopeLevel: 'resource' as const, items: [record('Stale Atlas')] });
    await settle();

    expect(inspector.listEntities).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: 'resource', namePrefix: 'b', limit: 12 }),
    );
    expect(text(browser)).toContain('Beta');
    expect(text(browser)).not.toContain('Stale Atlas');
  });

  it('loads cursor pages incrementally', async () => {
    const inspector = createInspector({
      listEntities: vi
        .fn()
        .mockResolvedValueOnce({
          identityKey: 'identity-1',
          scopeLevel: 'resource' as const,
          items: [record('Atlas')],
          nextCursor: 'next-page',
        })
        .mockResolvedValueOnce({ identityKey: 'identity-1', scopeLevel: 'resource' as const, items: [record('Beta')] }),
    });
    const { browser } = createBrowser(inspector);
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();

    expect(inspector.listEntities).toHaveBeenLastCalledWith({
      level: 'resource',
      sort: 'relevant',
      cursor: 'next-page',
      limit: 12,
    });
    expect(text(browser)).toContain('Atlas');
    expect(text(browser)).toContain('Beta');
  });

  it('preserves related entities while loading more facts', async () => {
    const atlas = record('Atlas');
    const alpha = record('Alpha dependency');
    const beta = record('Beta dependency');
    const first = { ...entityDetail(atlas, [alpha]), factsNextCursor: 'facts-page-2' };
    const second = {
      ...entityDetail(atlas, [{ ...alpha, handle: 'entity:Alpha-new-handle' }, beta]),
      facts: [{ ...entityDetail(atlas).facts[0]!, text: 'Atlas follows Beta dependency.' }],
    };
    const inspector = createInspector({
      getEntity: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second),
    });
    const { browser } = createBrowser(inspector);
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();

    expect(text(browser)).toContain('Alpha dependency');
    browser.handleInput('\r');
    await settle();

    expect(inspector.getEntity).toHaveBeenLastCalledWith({
      handle: atlas.handle,
      factsCursor: 'facts-page-2',
      incomingFactsCursor: undefined,
    });
    expect(text(browser).match(/Alpha dependency/g)).toHaveLength(1);
    expect(text(browser)).toContain('Beta dependency');
  });

  it('resets to the resource scope when session identity changes', async () => {
    const getScopeTree = vi.fn().mockResolvedValueOnce(tree()).mockResolvedValue(tree('identity-2'));
    const { browser } = createBrowser(createInspector({ getScopeTree }));
    await settle();
    browser.handleInput('j');
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();

    await browser.refresh();
    expect(text(browser)).toContain('[scopes]');
    expect(text(browser)).toContain('resource:resource-project-alpha');
    expect(text(browser)).not.toContain('Atlas ships Friday');
  });

  it('renders activity targets, empty states, loading, and errors', async () => {
    const failing = createInspector({
      listEntities: vi.fn(async () => {
        throw new Error('storage unavailable');
      }),
    });
    const { browser } = createBrowser(failing);
    expect(text(browser)).toContain('Loading…');
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();
    expect(text(browser)).toContain('Error: storage unavailable');

    browser.handleInput('\t');
    browser.handleInput('\t');
    await settle();
    expect(text(browser)).toContain('fact-created: Atlas');
  });

  it('closes on escape and returns from detail with backspace', async () => {
    const { browser, onClose } = createBrowser();
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();
    expect(text(browser)).toContain('Facts (1)');
    browser.handleInput('\x7f');
    expect(text(browser)).toContain('Organization policy');
    browser.handleInput('\x1b');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
