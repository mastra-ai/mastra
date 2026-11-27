import { describe, expect, it } from 'vitest';

import type { KnowledgePagePayload } from '../pageTypes';
import { bodyLinkEdges, bodyLinkRefs, knowledgePageRefIndex, noteMentionTarget } from './pageRefs';

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

describe('knowledgePageRefIndex with pages fetched by ref', () => {
  // An imported page two levels under a scope the explorer hasn't loaded.
  const plan = page('plan', 'parent', { scopeId: 'notion', name: 'Q3 launch plan', key: 'abc123' });

  it('resolves a ref the host fetched its page by, when the pages on its path are not loaded', () => {
    const index = knowledgePageRefIndex([docs], new Map([['notion:acme:conn#parent/abc123', plan]]));
    expect(index.resolve(' notion:acme:conn#parent/abc123 ')?.id).toBe('plan');
    expect(knowledgePageRefIndex([docs]).resolve('notion:acme:conn#parent/abc123')).toBeUndefined();
  });

  it('skips a fetched page that has since been deleted or merged', () => {
    const merged = { ...plan, mergedInto: 'other' };
    expect(
      knowledgePageRefIndex([], new Map([['notion:acme:conn#parent/abc123', merged]])).resolve(
        'notion:acme:conn#parent/abc123',
      ),
    ).toBeUndefined();
  });
});

describe('noteMentionTarget', () => {
  const notion = page('notion', null, { name: 'Notion', address: 'notion:acme:conn' });
  const plan = page('plan', 'parent', { scopeId: 'notion', name: 'Q3 launch plan', key: 'abc123' });
  const twin = page('twin', 'elsewhere', { scopeId: 'notion', name: 'Twin', key: 'abc123' });
  const byId = (...pages: KnowledgePagePayload[]) =>
    new Map([notion, ...pages].map(candidate => [candidate.id, candidate]));
  const index = knowledgePageRefIndex([docs, workflows, suspend, notion]);

  it('links a ref the index resolves only to a page the note mentions', () => {
    expect(noteMentionTarget(index, byId(suspend), ['suspend'], 'docs:mastra#workflows/suspend-and-resume')?.id).toBe(
      'suspend',
    );
    expect(noteMentionTarget(index, byId(suspend), [], 'docs:mastra#workflows/suspend-and-resume')).toBeUndefined();
  });

  it('links a ref whose path is not loaded to the mentioned page its last key names', () => {
    expect(noteMentionTarget(index, byId(plan), ['plan'], 'notion:acme:conn#parent/abc123')?.id).toBe('plan');
  });

  it("links nothing to a mentioned page in another scope that shares the ref's last key", () => {
    // [[x#foo]] is loaded and mentioned; [[y#bar/foo]] is mentioned but not loaded.
    const x = page('x', null, { name: 'X', address: 'x' });
    const y = page('y', null, { name: 'Y', address: 'y' });
    const xFoo = page('x-foo', 'x', { scopeId: 'x', name: 'X foo', key: 'foo' });
    const pages = byId(x, y, xFoo);
    const refs = knowledgePageRefIndex(pages.values());
    expect(noteMentionTarget(refs, pages, ['x-foo', 'y-foo'], 'y#bar/foo')).toBeUndefined();
    expect(noteMentionTarget(refs, pages, ['x-foo', 'y-foo'], 'x#foo')?.id).toBe('x-foo');
    // Same path shape in the other scope, with its parent unloaded: only the scope tells them apart.
    const xBarFoo = page('x-bar-foo', 'x-bar', { scopeId: 'x', name: 'X bar foo', key: 'foo' });
    const nested = byId(x, y, xBarFoo);
    expect(
      noteMentionTarget(knowledgePageRefIndex(nested.values()), nested, ['x-bar-foo'], 'y#bar/foo'),
    ).toBeUndefined();
  });

  it("links nothing when the ref's scope isn't loaded, or a loaded parent on the way has another key", () => {
    const y = page('y', null, { name: 'Y', address: 'y' });
    const baz = page('baz', 'y', { scopeId: 'y', name: 'Baz', key: 'baz' });
    const yFoo = page('y-foo', 'baz', { scopeId: 'y', name: 'Y foo', key: 'foo' });
    expect(noteMentionTarget(index, byId(yFoo), ['y-foo'], 'y#bar/foo')).toBeUndefined();
    const pages = byId(y, baz, yFoo);
    const refs = knowledgePageRefIndex([y, yFoo]);
    expect(noteMentionTarget(refs, pages, ['y-foo'], 'y#bar/foo')).toBeUndefined();
    expect(noteMentionTarget(refs, byId(y, yFoo), ['y-foo'], 'y#bar/foo')?.id).toBe('y-foo');
  });

  it("links nothing to a nested page for a ref that names it at the scope's top level", () => {
    // [[x#foo]] names a top-level page; the mentioned foo sits under x#parent, which isn't loaded.
    const x = page('x', null, { name: 'X', address: 'x' });
    const nestedFoo = page('nested-foo', 'x-parent', { scopeId: 'x', name: 'Nested foo', key: 'foo' });
    const pages = byId(x, nestedFoo);
    const refs = knowledgePageRefIndex(pages.values());
    expect(noteMentionTarget(refs, pages, ['nested-foo'], 'x#foo')).toBeUndefined();
    expect(noteMentionTarget(refs, pages, ['nested-foo'], 'x#parent/foo')?.id).toBe('nested-foo');
  });

  it('links nothing when no mentioned page, or more than one, has that key', () => {
    expect(noteMentionTarget(index, byId(plan), ['plan'], 'notion:acme:conn#parent/zzz')).toBeUndefined();
    expect(noteMentionTarget(index, byId(plan), [], 'notion:acme:conn#parent/abc123')).toBeUndefined();
    expect(
      noteMentionTarget(index, byId(plan, twin), ['plan', 'twin'], 'notion:acme:conn#parent/abc123'),
    ).toBeUndefined();
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
