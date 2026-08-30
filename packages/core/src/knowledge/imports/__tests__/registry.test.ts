import { describe, expect, it, vi } from 'vitest';

import { Knowledge } from '../../index';
import { KnowledgeImporterRegistry } from '../registry';
import type { KnowledgeImporterDefinition } from '../types';

const calendarBinding = { source: 'calendar:primary', scope: 'org:acme/calendar' } as const;
const handler = vi.fn(async () => {});
const calendarImporter: KnowledgeImporterDefinition = {
  id: 'calendar-sync',
  access: {
    'org:acme/calendar': 'edit',
    'org:acme/people': 'readonly',
  },
  triggers: {
    cron: { schedule: '0 * * * *', bindings: [calendarBinding] },
    webhook: { bindings: [calendarBinding] },
  },
  handler,
};

describe('KnowledgeImporterRegistry', () => {
  it('registers handler-aware importers with pre-bound triggers and programmatic availability', () => {
    const registry = new KnowledgeImporterRegistry();
    const calendar = registry.register(calendarImporter);
    const githubHandler = vi.fn(async () => {});
    const github = registry.register({
      id: 'github-distiller',
      access: { 'org:acme/repositories/mastra': 'owner' },
      canCreateRoots: true,
      triggers: { webhook: { bindings: [{ source: 'github:mastra', scope: 'org:acme/repositories/mastra' }] } },
      handler: githubHandler,
    });

    expect(calendar).toMatchObject({
      importerId: 'calendar-sync',
      access: {
        'org:acme/calendar': 'edit',
        'org:acme/people': 'readonly',
      },
      canCreateRoots: false,
      handler,
      programmatic: true,
    });
    expect(github).toMatchObject({
      access: { 'org:acme/repositories/mastra': 'owner' },
      canCreateRoots: true,
      handler: githubHandler,
      programmatic: true,
    });
    expect(calendar.webhookPath?.('primary')).toBe('/api/knowledge/primary/importers/calendar-sync/webhook');
    expect(github.webhookPath?.('analytics')).toBe('/api/knowledge/analytics/importers/github-distiller/webhook');
    expect(registry.get('calendar-sync')).toBe(calendar);
    expect(registry.list()).toEqual([calendar, github]);
    expect(handler).not.toHaveBeenCalled();
    expect(githubHandler).not.toHaveBeenCalled();
  });

  it('rejects duplicate importer IDs without treating runtime sources as registrations', () => {
    const registry = new KnowledgeImporterRegistry();
    registry.register(calendarImporter);

    expect(() => registry.register({ ...calendarImporter, handler: async () => {} })).toThrow(
      'Knowledge importer calendar-sync is already registered',
    );
    expect(() =>
      registry.register({
        ...calendarImporter,
        id: 'calendar-copy',
        handler: async () => {},
      }),
    ).not.toThrow();
  });

  it('validates definitions, access roles, handler, root creation, and trigger flags', () => {
    const registry = new KnowledgeImporterRegistry();

    expect(() => registry.register(null as never)).toThrow('Knowledge importer definition is required');
    expect(() =>
      registry.register({
        ...calendarImporter,
        id: 'bad-endpoint',
        triggers: { endpoint: '/run' } as never,
      }),
    ).toThrow('Unsupported Knowledge importer trigger: endpoint');
    expect(() =>
      registry.register({
        ...calendarImporter,
        id: 'bad-role',
        access: { 'org:acme': 'mirror' as never },
      }),
    ).toThrow('Unsupported Knowledge importer role for org:acme: mirror');
    expect(() =>
      registry.register({ ...calendarImporter, id: 'missing-handler', handler: undefined as never }),
    ).toThrow('Knowledge importer missing-handler handler is required');
    expect(() => registry.register({ ...calendarImporter, id: 'bad-roots', canCreateRoots: 'yes' as never })).toThrow(
      'Knowledge importer bad-roots canCreateRoots must be a boolean',
    );
  });

  it('derives webhook paths from encoded importer IDs only', () => {
    const registry = new KnowledgeImporterRegistry();
    const handle = registry.register({
      ...calendarImporter,
      id: 'github/org repo',
      triggers: { webhook: { bindings: [calendarBinding] } },
    });

    expect(handle.webhookPath?.('customer knowledge')).toBe(
      '/api/knowledge/customer%20knowledge/importers/github%2Forg%20repo/webhook',
    );
    expect(handle.triggers).toEqual({ webhook: { bindings: [calendarBinding] } });
  });

  it('distinguishes omitted access shorthand from an explicit empty access map', () => {
    const registry = new KnowledgeImporterRegistry();
    const shorthand = registry.register({ id: 'shorthand', handler: async () => {} });
    const externallyGranted = registry.register({ id: 'externally-granted', access: {}, handler: async () => {} });

    expect(shorthand.definition).not.toHaveProperty('access');
    expect(shorthand.access).toBeUndefined();
    expect(externallyGranted.access).toEqual({});
  });

  it('publishes immutable whitelisted registration context', () => {
    const registry = new KnowledgeImporterRegistry();
    const access = { ...calendarImporter.access };
    const bindings = [{ ...calendarBinding }];
    const schedules = ['0 * * * *'];
    const triggers = {
      cron: { schedule: schedules, bindings },
      webhook: { bindings },
    };
    const input = {
      ...calendarImporter,
      access,
      triggers,
      authority: 'ad-hoc',
    };
    const handle = registry.register(input);

    access['org:other'] = 'owner';
    schedules.push('*/5 * * * *');
    bindings.push({ source: 'calendar:other', scope: 'org:other' });

    expect(handle.definition).not.toHaveProperty('authority');
    expect(handle.access).toEqual(calendarImporter.access);
    expect(handle.triggers.cron).toEqual({ schedule: ['0 * * * *'], bindings: [calendarBinding] });
    expect(Object.isFrozen(handle)).toBe(true);
    expect(Object.isFrozen(handle.definition)).toBe(true);
    expect(Object.isFrozen(handle.access)).toBe(true);
    expect(Object.isFrozen(handle.triggers)).toBe(true);
    expect(Object.isFrozen(handle.triggers.cron)).toBe(true);
    expect(Object.isFrozen(handle.triggers.cron?.bindings)).toBe(true);
    expect(handle.triggers.cron?.bindings[0]).not.toBe(bindings[0]);
    expect(() => Object.assign(handle.access!, { 'org:other': 'owner' })).toThrow(TypeError);
    expect(registry.get('calendar-sync')).toBe(handle);
  });

  it('rejects malformed access addresses, schedules, and trigger bindings', () => {
    const registry = new KnowledgeImporterRegistry();

    expect(() => registry.register({ ...calendarImporter, access: { ' ': 'edit' } })).toThrow(
      'Knowledge importer access scope address is required',
    );
    expect(() =>
      registry.register({
        ...calendarImporter,
        access: { 'org:acme': 'readonly', ' org:acme ': 'owner' },
      }),
    ).toThrow('Knowledge importer access scope org:acme is declared more than once');
    expect(() => registry.register({ ...calendarImporter, triggers: null as never })).toThrow(
      'Knowledge importer triggers must be an object',
    );
    expect(() => registry.register({ ...calendarImporter, triggers: { cron: ' ' } as never })).toThrow(
      'Knowledge importer cron trigger must be an object',
    );
    expect(() =>
      registry.register({
        ...calendarImporter,
        triggers: { cron: { schedule: ['0 * * * *', ' '], bindings: [calendarBinding] } },
      }),
    ).toThrow('Knowledge importer cron schedule[1] is required');
    expect(() =>
      registry.register({
        ...calendarImporter,
        triggers: { cron: { schedule: 'not-a-cron', bindings: [calendarBinding] } },
      }),
    ).toThrow();
    expect(() =>
      registry.register({
        ...calendarImporter,
        triggers: { webhook: { bindings: [] } },
      }),
    ).toThrow('Knowledge importer webhook bindings cannot be empty');
    expect(() =>
      registry.register({
        ...calendarImporter,
        triggers: { webhook: { bindings: [calendarBinding, { ...calendarBinding }] } },
      }),
    ).toThrow('Knowledge importer webhook binding is declared more than once');
    expect(() =>
      registry.register({
        ...calendarImporter,
        triggers: {
          webhook: {
            bindings: [calendarBinding, { source: 'calendar:secondary', scope: calendarBinding.scope }],
          },
        },
      }),
    ).toThrow('Knowledge importer webhook triggers with multiple bindings require resolveBinding');
    expect(() =>
      registry.register({
        ...calendarImporter,
        triggers: { webhook: { bindings: [calendarBinding], resolveBinding: true as never } },
      }),
    ).toThrow('Knowledge importer webhook resolveBinding must be a function');
  });

  it('registers configured importers on the Knowledge runtime without executing handlers', () => {
    handler.mockClear();
    const knowledge = new Knowledge({ importers: [calendarImporter] });

    expect(knowledge.getImporter('calendar-sync')).toMatchObject({
      access: calendarImporter.access,
      programmatic: true,
    });
    expect(knowledge.listImporters()).toHaveLength(1);
    expect(handler).not.toHaveBeenCalled();
  });
});
