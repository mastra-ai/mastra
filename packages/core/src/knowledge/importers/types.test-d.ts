import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { defineKnowledgeImporter } from './index';
import type {
  KnowledgeImporterContext,
  KnowledgeImporterDefinition,
  KnowledgeImporterHost,
  KnowledgeImporterRunStart,
} from './index';

describe('Knowledge importer public types', () => {
  it('types sync settings as the parsed side of the schema and credentials as the declared slots', () => {
    const definition = defineKnowledgeImporter({
      id: 'helpspot',
      label: 'HelpSpot',
      settings: z.object({ baseUrl: z.string(), pageSize: z.number().default(100) }),
      credentials: { apiKey: { description: 'Token' } },
      async sync(ctx) {
        expectTypeOf(ctx.settings).toEqualTypeOf<{ baseUrl: string; pageSize: number }>();
        expectTypeOf(ctx.credentials).toEqualTypeOf<Readonly<Record<'apiKey', string>>>();
        // @ts-expect-error undeclared slot
        void ctx.credentials.password;
      },
    });
    expectTypeOf(definition).toEqualTypeOf<
      KnowledgeImporterDefinition<{ baseUrl: string; pageSize: number }, 'apiKey'>
    >();
    expectTypeOf(definition.parseSettings).returns.resolves.toEqualTypeOf<{ baseUrl: string; pageSize: number }>();
  });

  it('gives an importer without settings or credentials empty records', () => {
    defineKnowledgeImporter({
      id: 'calendar',
      label: 'Calendar',
      async sync(ctx) {
        expectTypeOf(ctx.settings).toEqualTypeOf<Record<string, never>>();
        expectTypeOf(ctx.credentials).toEqualTypeOf<Readonly<Record<never, string>>>();
      },
    });
  });

  it('keeps item writes behind items and the cursor behind state', () => {
    expectTypeOf<KnowledgeImporterContext['items']['upsert']>().parameter(0).toHaveProperty('sourceId');
    expectTypeOf<KnowledgeImporterContext['state']['set']>().returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf<KnowledgeImporterHost['flush']>().parameter(0).toHaveProperty('digest');
  });

  it('lets a remote host hand the runner its binding with resolved credentials', () => {
    type Started = Extract<KnowledgeImporterRunStart, { status: 'started' }>;
    expectTypeOf<NonNullable<Started['binding']>>().toEqualTypeOf<{
      id: string;
      importer: string;
      target: string;
      settings: unknown;
      credentials: Record<string, string>;
    }>();
    expectTypeOf<Extract<KnowledgeImporterRunStart, { status: 'skipped' }>>().not.toHaveProperty('binding');
  });
});
