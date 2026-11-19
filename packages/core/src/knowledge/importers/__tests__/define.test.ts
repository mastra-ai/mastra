import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import {
  KnowledgeImporterCredentialsError,
  KnowledgeImporterDefinitionError,
  KnowledgeImporterSettingsError,
  defineKnowledgeImporter,
  knowledgeImporterRegistry,
} from '../index';

const helpspot = () =>
  defineKnowledgeImporter({
    id: 'helpspot',
    label: 'HelpSpot',
    iconUrl: 'https://help.example.com/icon.svg',
    settings: z.object({
      baseUrl: z.url(),
      categories: z.array(z.string()).optional(),
      pageSize: z.number().int().default(100),
    }),
    credentials: { apiKey: { description: 'HelpSpot API token' } },
    defaultSchedule: '0 * * * *',
    async sync() {},
  });

describe('defineKnowledgeImporter', () => {
  it('builds a JSON manifest from the input side of the settings schema', () => {
    expect(helpspot().toManifest()).toMatchInlineSnapshot(`
      {
        "credentials": {
          "apiKey": {
            "description": "HelpSpot API token",
            "secret": true,
          },
        },
        "defaultSchedule": "0 * * * *",
        "iconUrl": "https://help.example.com/icon.svg",
        "id": "helpspot",
        "label": "HelpSpot",
        "settingsSchema": {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "additionalProperties": false,
          "properties": {
            "baseUrl": {
              "format": "uri",
              "type": "string",
            },
            "categories": {
              "items": {
                "type": "string",
              },
              "type": "array",
            },
            "pageSize": {
              "default": 100,
              "maximum": 9007199254740991,
              "minimum": -9007199254740991,
              "type": "integer",
            },
          },
          "required": [
            "baseUrl",
          ],
          "type": "object",
        },
      }
    `);
  });

  it('returns a fresh manifest copy each time', () => {
    const definition = helpspot();
    const manifest = definition.toManifest();
    manifest.credentials.apiKey!.description = 'changed';
    expect(definition.toManifest().credentials.apiKey!.description).toBe('HelpSpot API token');
    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
  });

  it('gives an importer without settings an empty-object schema and accepts no settings', async () => {
    const plain = defineKnowledgeImporter({ id: 'calendar', label: 'Calendar', async sync() {} });
    expect(plain.toManifest()).toEqual({
      id: 'calendar',
      label: 'Calendar',
      settingsSchema: { type: 'object', properties: {}, additionalProperties: false },
      credentials: {},
    });
    await expect(plain.parseSettings(undefined)).resolves.toEqual({});
    await expect(plain.parseSettings({})).resolves.toEqual({});
    await expect(plain.parseSettings({ extra: 1 })).rejects.toBeInstanceOf(KnowledgeImporterSettingsError);
  });

  it('parses settings with the schema, applying defaults', async () => {
    await expect(helpspot().parseSettings({ baseUrl: 'https://help.example.com' })).resolves.toEqual({
      baseUrl: 'https://help.example.com',
      pageSize: 100,
    });
  });

  it('reports each invalid settings field by path', async () => {
    const error = await helpspot()
      .parseSettings({ baseUrl: 'not a url', categories: [1] })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(KnowledgeImporterSettingsError);
    const paths = (error as KnowledgeImporterSettingsError).errors.map(e => e.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['baseUrl', 'categories.0']));
    expect((error as Error).message).toContain('- baseUrl:');
  });

  it('checks a binding supplies exactly the declared credential slots', () => {
    const definition = helpspot();
    expect(definition.checkCredentials({ apiKey: 'token' })).toEqual({ apiKey: 'token' });
    expect(() => definition.checkCredentials({})).toThrow(KnowledgeImporterCredentialsError);
    expect(() => definition.checkCredentials({ apiKey: '' })).toThrow(/missing credential "apiKey"/);
    expect(() => definition.checkCredentials({ apiKey: 'token', password: 'x' })).toThrow(
      /no credential slot "password"/,
    );
  });

  it.each([
    ['a bad id', { id: 'Help Spot' }],
    ['an empty label', { label: ' ' }],
    ['a script icon URL', { iconUrl: 'javascript:alert(1)' }],
    ['a bad credential slot name', { credentials: { 'api-key': { description: 'Token' } } }],
    ['a credential slot without a description', { credentials: { apiKey: { description: '' } } }],
    ['an empty schedule', { defaultSchedule: '' }],
    ['no sync function', { sync: undefined }],
    [
      'a settings schema that refers outside itself',
      { settings: { type: 'object', properties: { a: { $ref: 'https://example.com/a.json' } } } },
    ],
  ])('refuses %s', (_name, change) => {
    expect(() =>
      defineKnowledgeImporter({ id: 'source', label: 'Source', async sync() {}, ...change } as never),
    ).toThrow(KnowledgeImporterDefinitionError);
  });

  it('accepts a data:image icon', () => {
    expect(
      defineKnowledgeImporter({
        id: 'source',
        label: 'Source',
        iconUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
        async sync() {},
      }).iconUrl,
    ).toBe('data:image/svg+xml;base64,PHN2Zy8+');
  });
});

describe('knowledgeImporterRegistry', () => {
  it('indexes definitions by id', () => {
    const registry = knowledgeImporterRegistry([helpspot()]);
    expect([...registry.keys()]).toEqual(['helpspot']);
  });

  it('refuses two definitions with the same id', () => {
    expect(() => knowledgeImporterRegistry([helpspot(), helpspot()])).toThrow(
      /Two importer definitions have the id "helpspot"/,
    );
  });
});
