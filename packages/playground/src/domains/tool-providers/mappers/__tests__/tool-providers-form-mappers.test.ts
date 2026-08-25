import type { StoredToolProviderConfig } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import {
  buildToolProvidersForSave,
  extractFormToolProviders,
  isConditionalStoredToolProviders,
} from '../tool-providers-form-mappers';

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

describe('isConditionalStoredToolProviders', () => {
  it('recognises the conditional variant array the UI cannot edit', () => {
    expect(isConditionalStoredToolProviders([{ when: {}, value: {} }])).toBe(true);
  });

  it.each([
    ['a static record', { composio: { tools: {}, connections: {} } }],
    ['nothing', undefined],
    ['null', null],
  ])('does not treat %s as conditional', (_label, value) => {
    expect(isConditionalStoredToolProviders(value)).toBe(false);
  });
});

describe('buildToolProvidersForSave', () => {
  it('saves nothing when the form has no providers', () => {
    expect(buildToolProvidersForSave(undefined)).toBeUndefined();
  });

  it('saves nothing when the form has an empty provider map', () => {
    expect(buildToolProvidersForSave({})).toBeUndefined();
  });

  it('keeps a provider that has no tools and no connections', () => {
    expect(buildToolProvidersForSave({ composio: { tools: {}, connections: {} } })).toEqual({
      composio: { tools: {}, connections: {} },
    });
  });

  it('fills in the empty maps when the form left them out', () => {
    expect(buildToolProvidersForSave({ composio: {} as never })).toEqual({
      composio: { tools: {}, connections: {} },
    });
  });

  it('carries each selected tool through with its toolkit', () => {
    const saved = buildToolProvidersForSave({
      composio: { tools: { GMAIL_SEND: { toolkit: 'gmail', description: 'Send mail' } }, connections: {} },
    });

    expect(saved?.composio.tools).toEqual({ GMAIL_SEND: { toolkit: 'gmail', description: 'Send mail' } });
  });

  describe('the connection labels it writes', () => {
    const withLabel = (label?: string | null) =>
      buildToolProvidersForSave({
        composio: {
          tools: {},
          connections: { gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'c-1', label } as never] },
        },
      })?.composio.connections.gmail[0];

    it('trims a padded label', () => {
      expect(withLabel('  work  ')).toMatchObject({ label: 'work' });
    });

    it.each([
      ['a blank label', '   '],
      ['an empty label', ''],
      ['no label', undefined],
      ['a null label', null],
    ])('omits the label field entirely for %s', (_case, label) => {
      expect(withLabel(label)).not.toHaveProperty('label');
    });
  });

  it('keeps an explicit scope but omits it when the form has none', () => {
    const saved = buildToolProvidersForSave({
      composio: {
        tools: {},
        connections: {
          gmail: [
            { kind: 'author', toolkit: 'gmail', connectionId: 'c-1', scope: 'per-author' },
            { kind: 'author', toolkit: 'gmail', connectionId: 'c-2' } as never,
          ],
        },
      },
    });

    expect(saved?.composio.connections.gmail[0]).toMatchObject({ scope: 'per-author' });
    expect(saved?.composio.connections.gmail[1]).not.toHaveProperty('scope');
  });
});

describe('extractFormToolProviders', () => {
  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a conditional variant array', [{ when: {}, value: {} }]],
  ])('surfaces %s as no providers, since the form cannot edit it', (_label, value) => {
    expect(extractFormToolProviders(value)).toBeUndefined();
  });

  it('reads a provider that has no tools at all', () => {
    expect(extractFormToolProviders({ composio: { connections: {} } })).toEqual({
      composio: { tools: {}, connections: {} },
    });
  });

  it('omits a description the stored tool does not carry', () => {
    const form = extractFormToolProviders({
      composio: { tools: { GMAIL_SEND: { toolkit: 'gmail' } }, connections: {} },
    });

    expect(form?.composio.tools.GMAIL_SEND).toEqual({ toolkit: 'gmail' });
  });

  it('omits an empty description rather than storing a blank one', () => {
    const form = extractFormToolProviders({
      composio: { tools: { GMAIL_SEND: { toolkit: 'gmail', description: '' } }, connections: {} },
    });

    expect(form?.composio.tools.GMAIL_SEND).toEqual({ toolkit: 'gmail' });
  });

  describe('when a stored tool records no toolkit', () => {
    it('infers it from a connection whose service prefixes the slug', () => {
      const form = extractFormToolProviders({
        composio: {
          tools: { GMAIL_SEND_EMAIL: {} },
          connections: {
            gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'c-1' }],
            slack: [{ kind: 'author', toolkit: 'slack', connectionId: 'c-2' }],
          },
        },
      });

      expect(form?.composio.tools.GMAIL_SEND_EMAIL).toEqual({ toolkit: 'gmail' });
    });

    it('infers it from a service that matches the slug exactly', () => {
      const form = extractFormToolProviders({
        composio: {
          tools: { gmail: {} },
          connections: {
            gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'c-1' }],
            slack: [{ kind: 'author', toolkit: 'slack', connectionId: 'c-2' }],
          },
        },
      });

      expect(form?.composio.tools.gmail).toEqual({ toolkit: 'gmail' });
    });

    it('falls back to the only connected service when nothing matches', () => {
      const form = extractFormToolProviders({
        composio: {
          tools: { SOMETHING_ELSE: {} },
          connections: { gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'c-1' }] },
        },
      });

      expect(form?.composio.tools.SOMETHING_ELSE).toEqual({ toolkit: 'gmail' });
    });

    it('drops the tool when several services are connected and none matches', () => {
      const form = extractFormToolProviders({
        composio: {
          tools: { SOMETHING_ELSE: {} },
          connections: {
            gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'c-1' }],
            slack: [{ kind: 'author', toolkit: 'slack', connectionId: 'c-2' }],
          },
        },
      });

      expect(form?.composio.tools).toEqual({});
    });

    it('drops the tool when no service is connected at all', () => {
      const form = extractFormToolProviders({ composio: { tools: { SOMETHING_ELSE: {} }, connections: {} } });

      expect(form?.composio.tools).toEqual({});
    });

    it('matches the service case-insensitively', () => {
      const form = extractFormToolProviders({
        composio: {
          tools: { GMAIL_SEND: {} },
          connections: {
            GMail: [{ kind: 'author', toolkit: 'GMail', connectionId: 'c-1' }],
            slack: [{ kind: 'author', toolkit: 'slack', connectionId: 'c-2' }],
          },
        },
      });

      expect(form?.composio.tools.GMAIL_SEND).toEqual({ toolkit: 'GMail' });
    });

    it('survives a stored tool entry that is null', () => {
      const form = extractFormToolProviders({
        composio: {
          tools: { GMAIL_SEND: null },
          connections: { gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'c-1' }] },
        },
      });

      expect(form?.composio.tools.GMAIL_SEND).toEqual({ toolkit: 'gmail' });
    });

    it('prefers the toolkit the tool records over any inference', () => {
      const form = extractFormToolProviders({
        composio: {
          tools: { GMAIL_SEND: { toolkit: 'slack' } },
          connections: { gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'c-1' }] },
        },
      });

      expect(form?.composio.tools.GMAIL_SEND).toEqual({ toolkit: 'slack' });
    });
  });

  describe('the connection labels it reads', () => {
    const withLabel = (label?: string | null) =>
      extractFormToolProviders({
        composio: {
          tools: {},
          connections: { gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'c-1', label }] },
        },
      })?.composio.connections?.gmail[0];

    it('trims a padded label', () => {
      expect(withLabel('  work  ')).toMatchObject({ label: 'work' });
    });

    it.each([
      ['a blank label', '   '],
      ['no label', undefined],
      ['a null label', null],
    ])('omits the label field entirely for %s', (_case, label) => {
      expect(withLabel(label)).not.toHaveProperty('label');
    });

    it('re-keys the connection to the bucket it was stored under', () => {
      const form = extractFormToolProviders({
        composio: {
          tools: {},
          connections: { gmail: [{ kind: 'author', toolkit: 'stale', connectionId: 'c-1' }] },
        },
      });

      expect(form?.composio.connections?.gmail[0]).toMatchObject({ toolkit: 'gmail' });
    });

    it('keeps an explicit scope but omits it when the stored row has none', () => {
      const form = extractFormToolProviders({
        composio: {
          tools: {},
          connections: {
            gmail: [
              { kind: 'author', toolkit: 'gmail', connectionId: 'c-1', scope: 'per-author' },
              { kind: 'author', toolkit: 'gmail', connectionId: 'c-2' },
            ],
          },
        },
      });

      expect(form?.composio.connections?.gmail[0]).toMatchObject({ scope: 'per-author' });
      expect(form?.composio.connections?.gmail[1]).not.toHaveProperty('scope');
    });
  });
});
