import { describe, expect, it } from 'vitest';

import type { SessionModelCatalog } from '../../../../../hooks/useSessionModelCatalog';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { replyOwner } from '../reply-owner';
import type { ReplyOwner } from '../reply-owner';

const credentials = { anthropic: { type: 'oauth', subscription: 'Claude Pro/Max' } } as const;
const ward = { id: 'ward', name: 'Ward Peeters' };

describe('replyOwner', () => {
  const cases: Array<{
    name: string;
    catalog: SessionModelCatalog | undefined;
    sessionOwner: ChatSessionContextApi['owner'];
    expected: ReplyOwner | undefined;
  }> = [
    {
      name: 'nothing before the catalog has resolved the thread owner',
      catalog: undefined,
      sessionOwner: ward,
      expected: undefined,
    },
    {
      name: 'nothing when the catalog carries no owner credentials',
      catalog: { models: [], modelScope: 'user' },
      sessionOwner: ward,
      expected: undefined,
    },
    {
      name: 'the organization when it owns the credentials, whoever owns the session',
      catalog: { models: [], modelScope: 'factory', owner: { credentials } },
      sessionOwner: ward,
      expected: { credentials },
    },
    {
      name: 'the session owner when the credentials are theirs',
      catalog: { models: [], modelScope: 'user', owner: { credentials } },
      sessionOwner: ward,
      expected: { ...ward, credentials },
    },
    {
      name: 'nothing while the session owner is still unknown',
      catalog: { models: [], modelScope: 'user', owner: { credentials } },
      sessionOwner: undefined,
      expected: undefined,
    },
  ];

  it.each(cases)('resolves $name', ({ catalog, sessionOwner, expected }) => {
    expect(replyOwner(catalog, sessionOwner)).toEqual(expected);
  });
});
