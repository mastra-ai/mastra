import { describe, expect, it } from 'vitest';

import type { KnowledgePagePayload } from '../pageTypes';
import { scopeSource, scopeTitle } from './pageAddress';
import { ConfluenceIcon, LinearIcon, NotionIcon, ZendeskIcon } from '@/ds/icons';

function scope(address: string, name = address): KnowledgePagePayload {
  return {
    id: address,
    scopeId: address,
    parentId: null,
    isScope: true,
    address,
    position: 'a0',
    name,
    version: 1,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

describe('scopeTitle', () => {
  it.each([
    ['linear:Mastra:lin_01', 'Linear'],
    ['notion:Mastra:not_01', 'Notion'],
    ['confluence:acme:conf_01', 'Confluence'],
    ['zendesk:acme:zd_01', 'Zendesk'],
    ['fireflies:acme:ff_01', 'Fireflies'],
  ])('names the importer scope %s after its source', (address, label) => {
    expect(scopeTitle(scope(address))).toBe(label);
  });

  it('keeps a name the scope was given', () => {
    expect(scopeTitle(scope('notion:Mastra:not_01', 'Engineering wiki'))).toBe('Engineering wiki');
  });

  it('names a built-in scope by its kind instead of its address', () => {
    expect(scopeTitle(scope('org:org_01KPRK1TA1J73YAV6ARRZYFM66'))).toBe('Organization');
  });

  it('names the page an importer writes under by its source, with its icon', () => {
    const notion = {
      ...scope('org:acme'),
      id: 'notion',
      isScope: false,
      address: undefined,
      scopeId: 'org',
      parentId: 'org',
      key: 'notion',
      name: 'notion',
    };
    expect(scopeTitle(notion)).toBe('Notion');
    expect(scopeSource(notion)?.icon).toBe(NotionIcon);
    expect(scopeTitle({ ...notion, parentId: 'deeper' })).toBe('notion');
  });

  it.each([
    ['org:org_01', 'Acme'],
    ['project:proj_01', 'Roadmap'],
    ['customer:c42', 'Customer success'],
  ])('uses the API label for %s', (address, displayLabel) => {
    expect(scopeTitle({ ...scope(address), displayLabel })).toBe(displayLabel);
  });

  it('uses the label of a child scope stored under its canonical child key', () => {
    expect(scopeTitle({ ...scope('org:acme/handbook', 'handbook'), displayLabel: 'Company handbook' })).toBe(
      'Company handbook',
    );
  });

  it('preserves explicit titles and importer source titles ahead of declaration labels', () => {
    expect(scopeTitle({ ...scope('project:p1', 'Launch roadmap'), displayLabel: 'Project' })).toBe('Launch roadmap');
    expect(scopeTitle({ ...scope('org:acme/handbook', 'Team reference'), displayLabel: 'Handbook' })).toBe(
      'Team reference',
    );
    expect(scopeTitle({ ...scope('notion:acme:n1'), displayLabel: 'Imported documents' })).toBe('Notion');
  });

  it('uses a readable custom kind when no label is available', () => {
    expect(scopeTitle(scope('region:eu'))).toBe('Region');
    expect(scopeTitle(scope('customer-account:c42'))).toBe('Customer account');
  });

  it('ignores blank labels and labels on ordinary pages', () => {
    expect(scopeTitle({ ...scope('org:acme'), displayLabel: '   ' })).toBe('Organization');
    expect(scopeTitle({ ...scope('org:acme', 'Overview'), isScope: false, displayLabel: 'Organization' })).toBe(
      'Overview',
    );
  });
});

describe('scopeSource', () => {
  it('has an icon for every importer source with a logo, and none for Fireflies', () => {
    expect(scopeSource(scope('linear:a:b'))?.icon).toBe(LinearIcon);
    expect(scopeSource(scope('notion:a:b'))?.icon).toBe(NotionIcon);
    expect(scopeSource(scope('confluence:a:b'))?.icon).toBe(ConfluenceIcon);
    expect(scopeSource(scope('zendesk:a:b'))?.icon).toBe(ZendeskIcon);
    expect(scopeSource(scope('fireflies:a:b'))).toStrictEqual({ label: 'Fireflies' });
  });

  it('ignores pages that are not scopes', () => {
    expect(scopeSource({ ...scope('notion:a:b'), isScope: false })).toBeUndefined();
  });

  it('does not treat inherited object keys as sources', () => {
    expect(scopeSource(scope('constructor:a:b'))).toBeUndefined();
  });
});
