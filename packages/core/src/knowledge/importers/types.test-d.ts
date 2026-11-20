import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { KnowledgeImporter } from './index';
import type {
  KnowledgeImporterContext,
  KnowledgeImporterDefinition,
  KnowledgeImporterHost,
  KnowledgeImporterRunStart,
} from './index';

describe('Knowledge importer public types', () => {
  it('types import() settings as the parsed side of the schema and credentials as the declared slots', () => {
    class HelpSpot extends KnowledgeImporter({
      id: 'helpspot',
      label: 'HelpSpot',
      settings: z.object({ baseUrl: z.string(), pageSize: z.number().default(100) }),
      credentials: { apiKey: { description: 'Token' } },
    }) {
      async import(ctx: KnowledgeImporterContext<{ baseUrl: string; pageSize: number }, 'apiKey'>) {
        expectTypeOf(ctx.settings).toEqualTypeOf<{ baseUrl: string; pageSize: number }>();
        expectTypeOf(ctx.credentials).toEqualTypeOf<Readonly<Record<'apiKey', string>>>();
        // @ts-expect-error undeclared slot
        void ctx.credentials.password;
      }
    }
    expectTypeOf(HelpSpot.definition).toEqualTypeOf<
      KnowledgeImporterDefinition<{ baseUrl: string; pageSize: number }, 'apiKey'>
    >();
    // A binding supplies the input side: pageSize has a default, so it may be left out.
    new HelpSpot({ id: 'support', target: 'docs#support', settings: { baseUrl: 'x' }, credentials: { apiKey: 't' } });
    // @ts-expect-error the declared credential slot is required
    new HelpSpot({ id: 'support', target: 'docs#support', settings: { baseUrl: 'x' } });
    // @ts-expect-error settings without the required baseUrl
    new HelpSpot({ id: 'support', target: 'docs#support', settings: {}, credentials: { apiKey: 't' } });
  });

  it('lets an importer without settings or credentials be bound with just an id and target', () => {
    class Calendar extends KnowledgeImporter({ id: 'calendar', label: 'Calendar' }) {
      async import(ctx: KnowledgeImporterContext<Record<string, never>, never>) {
        expectTypeOf(ctx.settings).toEqualTypeOf<Record<string, never>>();
        expectTypeOf(ctx.credentials).toEqualTypeOf<Readonly<Record<never, string>>>();
      }
    }
    new Calendar({ id: 'cal', target: 'docs#calendar' });
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
