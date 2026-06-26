import type { StoredToolProviderConfig } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { buildToolProvidersForSave, extractFormToolProviders } from '../tool-providers-form-mappers';

describe('tool provider form mappers', () => {
  it('round-trips labeled connections for multi-connection toolkits', () => {
    const stored: Record<string, StoredToolProviderConfig> = {
      composio: {
        tools: {
          GMAIL_FETCH_EMAILS: { toolkit: 'gmail' },
        },
        connections: {
          gmail: [
            { kind: 'author', toolkit: 'gmail', connectionId: 'conn_work', label: 'work', scope: 'per-author' },
            { kind: 'author', toolkit: 'gmail', connectionId: 'conn_personal', label: 'personal', scope: 'per-author' },
          ],
        },
      },
    };

    const formValue = extractFormToolProviders(stored);

    expect(formValue?.composio.connections.gmail).toEqual([
      expect.objectContaining({ kind: 'author', toolkit: 'gmail', connectionId: 'conn_work', label: 'work' }),
      expect.objectContaining({ kind: 'author', toolkit: 'gmail', connectionId: 'conn_personal', label: 'personal' }),
    ]);
    expect(buildToolProvidersForSave(formValue)?.composio.connections.gmail).toEqual([
      expect.objectContaining({ kind: 'author', toolkit: 'gmail', connectionId: 'conn_work', label: 'work' }),
      expect.objectContaining({ kind: 'author', toolkit: 'gmail', connectionId: 'conn_personal', label: 'personal' }),
    ]);
  });

  it('skips malformed provider entries instead of throwing', () => {
    const stored: Record<string, unknown> = {
      composio: null,
      arcade: 'oops',
      valid: {
        tools: { GMAIL_FETCH_EMAILS: { toolkit: 'gmail' } },
        connections: { gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'conn_a' }] },
      },
    };

    const formValue = extractFormToolProviders(stored);

    expect(formValue).toBeDefined();
    expect(Object.keys(formValue ?? {})).toEqual(['valid']);
  });

  it('returns undefined when every provider entry is malformed', () => {
    expect(extractFormToolProviders({ composio: null })).toBeUndefined();
  });
});
