import { KnowledgeImporter } from '@mastra/core/knowledge';
import { ConsoleLogger, LogLevel } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, expect, it, vi } from 'vitest';
import { PlatformKnowledge } from './index';

class HelpSpotImporter extends KnowledgeImporter({ id: 'helpspot', label: 'HelpSpot' }) {
  async import() {}
}

class UploadsImporter extends KnowledgeImporter({ id: 'uploads', label: 'Uploads' }) {
  async import() {}
}

// Another app's class that happens to use the same id as HelpSpotImporter.
class OtherHelpSpotImporter extends KnowledgeImporter({ id: 'helpspot', label: 'Other HelpSpot' }) {
  async import() {}
}

const connection = { accessToken: 'token', instanceId: 'instance', apiUrl: 'http://127.0.0.1:1' };

afterEach(() => {
  vi.restoreAllMocks();
});

it('exposes the importer classes it was given, in order', () => {
  const knowledge = new PlatformKnowledge({ ...connection, importers: [HelpSpotImporter, UploadsImporter] });

  expect(knowledge.importerClasses).toEqual([HelpSpotImporter, UploadsImporter]);
  expect(knowledge.importerClasses.map(importer => importer.toManifest().id)).toEqual(['helpspot', 'uploads']);
});

it('has no importer classes when none are given', () => {
  expect(new PlatformKnowledge(connection).importerClasses).toEqual([]);
});

it('skips a class registered twice without warning', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const knowledge = new PlatformKnowledge({
    ...connection,
    importers: [HelpSpotImporter, UploadsImporter, HelpSpotImporter],
  });

  expect(knowledge.importerClasses).toEqual([HelpSpotImporter, UploadsImporter]);
  expect(warn).not.toHaveBeenCalled();
});

it('keeps the first of two different classes that share an id, and warns through the app logger', () => {
  const knowledge = new PlatformKnowledge({
    ...connection,
    importers: [HelpSpotImporter, OtherHelpSpotImporter, UploadsImporter],
  });
  expect(knowledge.importerClasses).toEqual([HelpSpotImporter, UploadsImporter]);

  // Knowledge's own logger drops warnings until the app's Mastra hands it the real one.
  const warn = vi.spyOn(ConsoleLogger.prototype, 'warn').mockImplementation(() => {});
  new Mastra({ logger: new ConsoleLogger({ level: LogLevel.WARN }), knowledge: { platform: knowledge } });

  const duplicateWarnings = warn.mock.calls.filter(([message]) => String(message).includes('"helpspot"'));
  expect(duplicateWarnings).toHaveLength(1);
});

it('refuses an importer instance in place of its class', () => {
  const instance = new UploadsImporter({ id: 'uploads', target: 'org:acme#uploads' });

  expect(
    () => new PlatformKnowledge({ ...connection, importers: [instance as unknown as typeof UploadsImporter] }),
  ).toThrow(/importer classes/);
});

it('does not hand the classes to core as local importers', () => {
  const knowledge = new PlatformKnowledge({ ...connection, importers: [HelpSpotImporter] });

  // Platform runs these from bindings it stores, so the app has no local importers to run.
  expect(knowledge.importers).toBeUndefined();
});
