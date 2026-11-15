import { decodeKnowledgeScopeId, encodeKnowledgeScopeId as coreEncode } from '@mastra/core/knowledge';
import { describe, expect, it } from 'vitest';

import { encodeKnowledgeScopeId } from './knowledge-scope-id.js';

const ids = [
  '',
  'plain-id',
  'auth0|a:b',
  'slack:U1/x#y%',
  'a/b:c',
  '%2F already encoded',
  '%%::##//',
  'org_123',
  '/Users/me/code/repo',
  'https://example.com/a#b',
  'ünïcødé:🙂/x',
  'spaces and\ttabs',
];

describe('encodeKnowledgeScopeId', () => {
  it.each(ids)('matches @mastra/core for %j', id => {
    expect(encodeKnowledgeScopeId(id)).toBe(coreEncode(id));
  });

  it.each(ids)('round-trips through core decode for %j', id => {
    expect(decodeKnowledgeScopeId(encodeKnowledgeScopeId(id))).toBe(id);
  });
});
