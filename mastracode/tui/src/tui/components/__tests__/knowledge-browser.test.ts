import { visibleWidth } from '@earendil-works/pi-tui';
import type {
  KnowledgeInspector,
  KnowledgeInspectorNodeDetail,
  KnowledgeInspectorNodeSummary,
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
  _type: 'node' = 'node',
  scope: 'org' | 'resource' | 'thread' = 'resource',
  relationshipCounts?: KnowledgeInspectorNodeSummary['relationshipCounts'],
  kind = 'project',
): KnowledgeInspectorNodeSummary {
  return {
    handle: `node:${name}`,
    type: 'node',
    name,
    kind,
    scope: { level: scope, id: `${scope}-id` },
    version: 1,
    updatedAt: '2026-07-15T00:00:00.000Z',
    relationshipCounts,
  };
}

function nodeDetail(
  node: KnowledgeInspectorNodeSummary,
  outgoingTargets = [] as KnowledgeInspectorNodeSummary[],
  incomingParents = [] as KnowledgeInspectorNodeSummary[],
  content?: string,
): KnowledgeInspectorNodeDetail {
  const relationshipCounts = node.relationshipCounts ?? { records: 1, outgoing: 0, incoming: 0, sampled: false };
  return {
    identityKey: 'identity-1',
    scopeLevel: 'resource' as const,
    node: { ...node, relationshipCounts },
    records: [
      {
        text: `${node.name} ships Friday`,
        scope: node.scope,
        sourceThreadId: 'thread-current',
        capturedAt: '2026-07-15T00:00:00.000Z',
      },
    ],
    mentioningRecords: [],
    outgoingTargets: { nodes: outgoingTargets, partial: false },
    incomingParents: { nodes: incomingParents, partial: false },
    relationshipCounts,
    content,
    contentTruncated: false,
    links: outgoingTargets.map(target => ({ label: target.name, node: target })),
  };
}

function createInspector(overrides: Partial<KnowledgeInspector> = {}): KnowledgeInspector {
  const atlas = record('Atlas');
  const beta = record('Beta');
  const brief = record('Launch brief', 'node', 'resource', undefined, 'document');
  return {
    getScopeTree: vi.fn(async () => tree()),
    listNodes: vi.fn(async () => ({
      identityKey: 'identity-1',
      scopeLevel: 'resource' as const,
      nodes: [record('Organization policy', 'node', 'org'), atlas, brief],
    })),
    getNode: vi.fn(async ({ handle }) => {
      if (handle === atlas.handle) return nodeDetail(atlas, [beta]);
      if (handle === brief.handle) return nodeDetail(brief, [atlas], [], 'Launch notes link to [[Atlas]].');
      return nodeDetail(beta);
    }),
    listActivity: vi.fn(async () => ({
      identityKey: 'identity-1',
      scopeLevel: 'resource' as const,
      events: [
        {
          action: 'record-created' as const,
          recordType: 'node' as const,
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

    expect(inspector.listNodes).toHaveBeenCalledWith({ level: 'resource', sort: 'relevant', limit: 12 });
    expect(text(browser)).toContain('[inherited:org]');
    expect(text(browser)).toContain('[exact:resource]');
  });

  it('traverses node connections without changing the selected scope', async () => {
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
    expect(inspector.getNode).toHaveBeenLastCalledWith({ handle: 'node:Beta' });
    expect(text(browser)).toContain('Beta ships Friday');
    expect(text(browser)).toContain('Nodes / Atlas / Beta');
    browser.handleInput('\x7f');
    expect(text(browser)).toContain('Atlas ships Friday');
    expect(text(browser)).toContain('resource:resource-project-alpha');
  });

  it('shows incoming parent relationships and navigates back through breadcrumbs', async () => {
    const atlas = record('Atlas');
    const portfolio = record('Portfolio');
    const inspector = createInspector({
      listNodes: vi.fn(async () => ({
        identityKey: 'identity-1',
        scopeLevel: 'resource' as const,
        nodes: [atlas],
        sort: 'relevant' as const,
        coverage: 'recent-window' as const,
      })),
      getNode: vi.fn(async ({ handle }) =>
        handle === atlas.handle ? nodeDetail(atlas, [], [portfolio]) : nodeDetail(portfolio),
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
    expect(text(browser)).toContain('Nodes / Atlas / Portfolio');
    browser.handleInput('\x7f');
    expect(text(browser)).toContain('Referenced by');
  });

  it('cycles node sorting between relevant, recent, and connected', async () => {
    const inspector = createInspector({
      listNodes: vi.fn(async input => ({
        identityKey: 'identity-1',
        scopeLevel: 'resource' as const,
        nodes: [
          record(input.sort ?? 'relevant', 'node', 'resource', {
            records: 4,
            outgoing: 2,
            incoming: 1,
            sampled: false,
          }),
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
    expect(text(browser)).toContain('→2 ←1');

    browser.handleInput('\x13');
    await settle();
    expect(text(browser)).toContain('Sort: Recent');
    expect(inspector.listNodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'recent', level: 'resource' }),
    );
    browser.handleInput('\x13');
    await settle();
    expect(text(browser)).toContain('Sort: Connected · recent window');
  });

  it('groups nodes by graph role and badges rows with directional counts', async () => {
    const bridge = record('Bridge', 'node', 'resource', { records: 3, outgoing: 2, incoming: 1, sampled: false });
    const source = record('Source', 'node', 'resource', { records: 1, outgoing: 2, incoming: 0, sampled: false });
    const referenced = record('Referenced', 'node', 'resource', {
      records: 1,
      outgoing: 0,
      incoming: 2,
      sampled: false,
    });
    const isolated = record('Isolated', 'node', 'resource', { records: 0, outgoing: 0, incoming: 0, sampled: false });
    const sampledHub = record('Sampled hub', 'node', 'resource', {
      records: 40,
      outgoing: 25,
      incoming: 25,
      sampled: true,
    });
    const inspector = createInspector({
      listNodes: vi.fn(async () => ({
        identityKey: 'identity-1',
        scopeLevel: 'resource' as const,
        nodes: [isolated, source, bridge, referenced, sampledHub],
        sort: 'relevant' as const,
        coverage: 'recent-window' as const,
      })),
      getNode: vi.fn(async () => nodeDetail(bridge, [source], [referenced])),
    });
    const { browser } = createBrowser(inspector);
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();

    const rendered = text(browser);
    const bridgesAt = rendered.indexOf('Bridges');
    const sourcesAt = rendered.indexOf('Sources');
    const referencedAt = rendered.indexOf('Referenced only');
    const isolatedAt = rendered.indexOf('Isolated\n');
    expect(bridgesAt).toBeGreaterThan(-1);
    expect(sourcesAt).toBeGreaterThan(bridgesAt);
    expect(referencedAt).toBeGreaterThan(sourcesAt);
    expect(isolatedAt).toBeGreaterThan(referencedAt);
    expect(rendered.indexOf('Bridge (project)')).toBeGreaterThan(bridgesAt);
    expect(rendered.indexOf('Bridge (project)')).toBeLessThan(sourcesAt);
    expect(rendered.indexOf('Source (project)')).toBeGreaterThan(sourcesAt);
    expect(rendered.indexOf('Source (project)')).toBeLessThan(referencedAt);
    expect(rendered.indexOf('Referenced (project)')).toBeGreaterThan(referencedAt);
    expect(rendered.indexOf('Referenced (project)')).toBeLessThan(isolatedAt);
    expect(rendered.indexOf('Isolated (project)')).toBeGreaterThan(isolatedAt);
    expect(rendered).toContain('→2 ←1');
    expect(rendered).toContain('→25 ←25+');

    browser.handleInput('\r');
    await settle();
    expect(text(browser)).toContain('Bridge · 3 records · 2 outgoing · 1 incoming');
  });

  it('renders content-capable nodes and follows their resolved links', async () => {
    const atlas = record('Atlas');
    const brief = record('Launch brief', 'node', 'resource', undefined, 'document');
    const inspector = createInspector({
      listNodes: vi.fn(async () => ({
        identityKey: 'identity-1',
        scopeLevel: 'resource' as const,
        nodes: [brief],
      })),
      getNode: vi.fn(async ({ handle }) =>
        handle === brief.handle
          ? {
              ...nodeDetail(brief, [atlas], [], 'Launch notes link to [[Atlas]].'),
              links: [{ label: 'Atlas', node: atlas }, { label: 'Unknown' }],
            }
          : nodeDetail(atlas),
      ),
    });
    const { browser } = createBrowser(inspector);
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();
    browser.handleInput('\r');
    await settle();

    expect(text(browser)).toContain('Launch notes link to [[Atlas]].');
    expect(text(browser)).toContain('→ Atlas');
    browser.handleInput('\r');
    await settle();
    expect(inspector.getNode).toHaveBeenCalledWith({ handle: 'node:Atlas' });
  });

  it('filters names and ignores stale async responses', async () => {
    let resolveOld!: (value: any) => void;
    const old = new Promise(resolve => (resolveOld = resolve));
    const inspector = createInspector({
      listNodes: vi
        .fn()
        .mockImplementationOnce(() => old)
        .mockResolvedValueOnce({ identityKey: 'identity-1', scopeLevel: 'resource' as const, nodes: [record('Beta')] }),
    });
    const { browser } = createBrowser(inspector);
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    while (!vi.mocked(inspector.listNodes).mock.calls.length) await settle();
    browser.handleInput('b');
    await settle();
    resolveOld({ identityKey: 'identity-1', scopeLevel: 'resource' as const, nodes: [record('Stale Atlas')] });
    await settle();

    expect(inspector.listNodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: 'resource', namePrefix: 'b', limit: 12 }),
    );
    expect(text(browser)).toContain('Beta');
    expect(text(browser)).not.toContain('Stale Atlas');
  });

  it('loads cursor pages incrementally', async () => {
    const inspector = createInspector({
      listNodes: vi
        .fn()
        .mockResolvedValueOnce({
          identityKey: 'identity-1',
          scopeLevel: 'resource' as const,
          nodes: [record('Atlas')],
          nextCursor: 'next-page',
        })
        .mockResolvedValueOnce({ identityKey: 'identity-1', scopeLevel: 'resource' as const, nodes: [record('Beta')] }),
    });
    const { browser } = createBrowser(inspector);
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();
    browser.handleInput('j');
    browser.handleInput('\r');
    await settle();

    expect(inspector.listNodes).toHaveBeenLastCalledWith({
      level: 'resource',
      sort: 'relevant',
      cursor: 'next-page',
      limit: 12,
    });
    expect(text(browser)).toContain('Atlas');
    expect(text(browser)).toContain('Beta');
  });

  it('preserves related nodes while loading more knowledge', async () => {
    const atlas = record('Atlas');
    const alpha = record('Alpha dependency');
    const beta = record('Beta dependency');
    const first = { ...nodeDetail(atlas, [alpha]), recordsNextCursor: 'items-page-2' };
    const second = {
      ...nodeDetail(atlas, [{ ...alpha, handle: 'node:Alpha-new-handle' }, beta]),
      records: [{ ...nodeDetail(atlas).records[0]!, text: 'Atlas follows Beta dependency.' }],
    };
    const inspector = createInspector({
      getNode: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second),
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

    expect(inspector.getNode).toHaveBeenLastCalledWith({
      handle: atlas.handle,
      recordsCursor: 'items-page-2',
      mentioningRecordsCursor: undefined,
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
      listNodes: vi.fn(async () => {
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
    await settle();
    expect(text(browser)).toContain('record-created: Atlas');
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
    expect(text(browser)).toContain('Knowledge (1)');
    browser.handleInput('\x7f');
    expect(text(browser)).toContain('Organization policy');
    browser.handleInput('\x1b');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
