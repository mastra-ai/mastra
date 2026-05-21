import { describe, expect, it } from 'vitest';
import type { ToolProvidersFormValue } from '../schemas';
import { buildToolProvidersForSave, extractFormToolProviders } from './tool-providers-form-mappers';

describe('tool-providers-form-mappers', () => {
  describe('round-trip', () => {
    it('preserves a tool with no connections (added but not yet connected)', () => {
      const formIn: ToolProvidersFormValue = {
        composio: {
          tools: { GMAIL_FETCH_EMAILS: { toolkit: 'gmail' } },
          connections: {},
        },
      };

      const saved = buildToolProvidersForSave(formIn);
      expect(saved).toBeDefined();
      expect(saved!.composio.tools.GMAIL_FETCH_EMAILS).toMatchObject({ toolkit: 'gmail' });
      expect(saved!.composio.connections).toEqual({});

      const formOut = extractFormToolProviders(saved);
      expect(formOut).toEqual(formIn);
    });

    it('preserves a tool with one author connection', () => {
      const formIn: ToolProvidersFormValue = {
        composio: {
          tools: { GMAIL_FETCH_EMAILS: { toolkit: 'gmail', description: 'fetch' } },
          connections: {
            gmail: [
              {
                kind: 'author',
                toolkit: 'gmail',
                connectionId: 'ca_abc',
                scope: 'per-author',
              },
            ],
          },
        },
      };

      const saved = buildToolProvidersForSave(formIn);
      const formOut = extractFormToolProviders(saved);
      expect(formOut).toEqual(formIn);
    });

    it('drops only tool entries that have no toolkit and no inferable service', () => {
      const stored = {
        composio: {
          tools: { ORPHAN_TOOL: {} },
          connections: {},
        },
      };
      const formOut = extractFormToolProviders(stored);
      expect(formOut?.composio.tools).toEqual({});
    });
  });
});
