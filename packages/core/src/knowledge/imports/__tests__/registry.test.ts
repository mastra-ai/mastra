import { describe, expect, it } from 'vitest';

import { Knowledge } from '../../index';
import { KnowledgeImporterRegistry } from '../registry';
import type { KnowledgeImporterDefinition } from '../types';

const calendarImporter: KnowledgeImporterDefinition = {
  id: 'calendar-sync',
  source: { type: 'calendar', id: 'primary' },
  kind: 'static',
  scope: ['org:acme', 'resource:shipyard'],
  role: 'append',
  triggers: { cron: '0 * * * *', webhook: true },
};

describe('KnowledgeImporterRegistry', () => {
  it('registers static and agentic importers with host-vouched context and programmatic availability', () => {
    const registry = new KnowledgeImporterRegistry();
    const calendar = registry.register(calendarImporter);
    const github = registry.register({
      id: 'github-distiller',
      source: { type: 'github', id: 'mastra-ai/mastra' },
      kind: 'agentic',
      scope: ['org:acme', 'resource:shipyard', 'repository:mastra'],
      role: 'owner',
      triggers: { webhook: true },
    });

    expect(calendar).toMatchObject({
      importerId: 'calendar-sync',
      sourceKey: '["calendar","primary"]',
      kind: 'static',
      scope: ['org:acme', 'resource:shipyard'],
      role: 'append',
      programmatic: true,
    });
    expect(github).toMatchObject({
      sourceKey: '["github","mastra-ai/mastra"]',
      kind: 'agentic',
      programmatic: true,
    });
    expect(calendar.webhookPath?.('primary')).toBe('/api/knowledge/primary/importers/calendar-sync/webhook');
    expect(github.webhookPath?.('analytics')).toBe('/api/knowledge/analytics/importers/github-distiller/webhook');
    expect(registry.get('calendar-sync')).toBe(calendar);
    expect(registry.list()).toEqual([calendar, github]);
  });

  it('rejects duplicate importer IDs and duplicate source identities', () => {
    const registry = new KnowledgeImporterRegistry();
    registry.register(calendarImporter);

    expect(() => registry.register({ ...calendarImporter, source: { type: 'calendar', id: 'secondary' } })).toThrow(
      'Knowledge importer calendar-sync is already registered',
    );
    expect(() => registry.register({ ...calendarImporter, id: 'calendar-copy' })).toThrow(
      'Knowledge importer source ["calendar","primary"] is already registered by calendar-sync',
    );
  });

  it('rejects unsupported trigger endpoint flags and ad-hoc authority', () => {
    const registry = new KnowledgeImporterRegistry();

    expect(() =>
      registry.register({
        ...calendarImporter,
        id: 'bad-endpoint',
        source: { type: 'calendar', id: 'bad-endpoint' },
        triggers: { endpoint: '/run' } as never,
      }),
    ).toThrow('Unsupported Knowledge importer trigger: endpoint');
    expect(() =>
      registry.register({
        ...calendarImporter,
        id: 'readonly-importer',
        source: { type: 'calendar', id: 'readonly' },
        role: 'readonly' as never,
      }),
    ).toThrow('Unsupported Knowledge importer role: readonly');
  });

  it('derives webhook paths from encoded importer IDs only', () => {
    const registry = new KnowledgeImporterRegistry();
    const handle = registry.register({
      ...calendarImporter,
      id: 'github/org repo',
      source: { type: 'github', id: 'org/repo' },
      triggers: { webhook: true },
    });

    expect(handle.webhookPath?.('customer knowledge')).toBe(
      '/api/knowledge/customer%20knowledge/importers/github%2Forg%20repo/webhook',
    );
    expect(handle.triggers).toEqual({ webhook: true });
  });

  it('keeps delimiter-bearing source identities distinct', () => {
    const registry = new KnowledgeImporterRegistry();
    registry.register({ ...calendarImporter, source: { type: 'a:b', id: 'c' } });

    expect(() =>
      registry.register({ ...calendarImporter, id: 'second', source: { type: 'a', id: 'b:c' } }),
    ).not.toThrow();
    expect(registry.list().map(handle => handle.sourceKey)).toEqual(['["a:b","c"]', '["a","b:c"]']);
  });

  it('publishes immutable whitelisted registration context', () => {
    const registry = new KnowledgeImporterRegistry();
    const input = {
      ...calendarImporter,
      scope: [...calendarImporter.scope],
      source: { ...calendarImporter.source },
      triggers: { cron: ['0 * * * *'], webhook: true as const },
      authority: 'ad-hoc',
    };
    const handle = registry.register(input);

    input.scope.push('thread:private');
    input.source.id = 'mutated';
    input.triggers.cron.push('*/5 * * * *');

    expect(handle.definition).not.toHaveProperty('authority');
    expect(handle.scope).toEqual(['org:acme', 'resource:shipyard']);
    expect(handle.source).toEqual({ type: 'calendar', id: 'primary' });
    expect(handle.triggers.cron).toEqual(['0 * * * *']);
    expect(() => ((handle.scope as string[])[0] = 'org:other')).toThrow(TypeError);
    expect(registry.get('calendar-sync')).toBe(handle);
  });

  it('rejects malformed cron trigger values', () => {
    const registry = new KnowledgeImporterRegistry();

    expect(() => registry.register({ ...calendarImporter, triggers: { cron: ' ' } })).toThrow(
      'Knowledge importer cron trigger is required',
    );
    expect(() => registry.register({ ...calendarImporter, triggers: { cron: ['0 * * * *', ' '] } })).toThrow(
      'Knowledge importer cron trigger[1] is required',
    );
  });

  it('registers configured importers on the Knowledge runtime', () => {
    const knowledge = new Knowledge({ importers: [calendarImporter] });

    expect(knowledge.getImporter('calendar-sync')).toMatchObject({
      sourceKey: '["calendar","primary"]',
      programmatic: true,
    });
    expect(knowledge.listImporters()).toHaveLength(1);
  });
});
