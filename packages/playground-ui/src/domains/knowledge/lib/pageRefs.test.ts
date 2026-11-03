import { describe, expect, it } from 'vitest';

import type { KnowledgePagePayload } from '../pageTypes';
import { bodyLinkEdges, bodyLinkRefs, knowledgePageRefIndex } from './pageRefs';

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: parentId === null ? id : 'docs',
    parentId,
    isScope: parentId === null,
    position: 'a0',
    name: id,
    version: 1,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...extra,
  };
}

const docs = page('docs', null, { name: 'Mastra docs', address: 'docs:mastra' });
const other = page('other', null, { name: 'Other docs', address: 'docs:other' });
const workflows = page('workflows', 'docs', { name: 'Workflows', key: 'workflows' });
const suspend = page('suspend', 'workflows', { name: 'Suspend  and Resume', key: 'suspend-and-resume' });
const otherWorkflows = page('other-workflows', 'other', { scopeId: 'other', name: 'Workflows', key: 'workflows' });
const gone = page('gone', 'docs', { name: 'Gone', key: 'gone', deletedAt: '2026-11-01T01:00:00.000Z' });

describe('knowledgePageRefIndex', () => {
  const index = knowledgePageRefIndex([docs, other, workflows, suspend, otherWorkflows, gone]);
  const resolved = (ref: string) => index.resolve(ref)?.id;

  it('resolves a page id', () => {
    expect(resolved('suspend')).toBe('suspend');
  });

  it('resolves a scope#path through nested keys', () => {
    expect(resolved('docs:mastra#workflows/suspend-and-resume')).toBe('suspend');
    expect(resolved('docs:other#workflows')).toBe('other-workflows');
  });

  it('resolves nothing for a path with a missing key or an unknown scope', () => {
    expect(resolved('docs:mastra#workflows/human-in-the-loop')).toBeUndefined();
    expect(resolved('docs:mastra#suspend-and-resume')).toBeUndefined();
    expect(resolved('docs:nowhere#workflows')).toBeUndefined();
  });

  it('resolves a scope address', () => {
    expect(resolved('docs:mastra')).toBe('docs');
  });

  it('resolves a unique name the way core canonicalizes it, and nothing for an ambiguous one', () => {
    expect(resolved(' suspend and resume ')).toBe('suspend');
    expect(resolved('Workflows')).toBeUndefined();
  });

  it('skips deleted pages', () => {
    expect(resolved('gone')).toBeUndefined();
    expect(resolved('docs:mastra#gone')).toBeUndefined();
  });
});

describe('bodyLinkRefs', () => {
  it('finds refs in prose but not in inline code or fenced code', () => {
    const body = 'See [[a]] and `[[b]]`.\n\n```ts\n[[c]]\n```\n\n~~~\n[[d]]\n~~~\nThen [[e]].';
    expect(bodyLinkRefs(body)).toEqual(['a', 'e']);
  });
});

describe('bodyLinkEdges', () => {
  it('draws one counted edge per linked page, dropping self links and unresolved refs', () => {
    const overview = page('overview', 'docs', {
      key: 'overview',
      body: '[[docs:mastra#workflows/suspend-and-resume]] [[suspend]] [[overview]] [[nowhere]] [[docs:mastra#workflows]]',
    });
    expect(bodyLinkEdges([docs, workflows, suspend, overview])).toEqual([
      { source: 'overview', target: 'suspend', kind: 'link', count: 2 },
      { source: 'overview', target: 'workflows', kind: 'link', count: 1 },
    ]);
  });
});
