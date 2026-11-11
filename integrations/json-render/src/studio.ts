import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

/**
 * The components Mastra Studio can render in json-render interfaces.
 * Pass it to `JsonRenderProcessor` and `catalog.prompt()` so an agent's interfaces show in Studio.
 * `@json-render/react/schema` only describes the spec format; it does not load React.
 */
export const studioCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      description: 'Lays child nodes out in a column, or a wrapping row.',
      props: z.object({ direction: z.enum(['vertical', 'horizontal']).default('vertical') }),
    },
    Grid: {
      description: 'Lays child nodes out in equal columns.',
      props: z.object({ columns: z.number().int().min(1).max(4).default(2) }),
    },
    Card: {
      description: 'Groups child nodes on a surface, with an optional title.',
      props: z.object({ title: z.string().optional() }),
    },
    Heading: {
      description: 'Section heading.',
      props: z.object({ text: z.string() }),
    },
    Text: {
      description: 'Paragraph of plain text.',
      props: z.object({ text: z.string(), tone: z.enum(['default', 'muted']).default('default') }),
    },
    Badge: {
      description: 'Short status label, e.g. "On track" or "Blocked".',
      props: z.object({
        text: z.string(),
        variant: z.enum(['neutral', 'success', 'warning', 'destructive', 'info']).default('neutral'),
      }),
    },
    Metric: {
      description: 'Key number with a label, and optionally its change in percent against a previous period.',
      props: z.object({
        label: z.string(),
        value: z.string(),
        changePct: z.number().optional(),
        comparison: z.string().optional(),
        lowerIsBetter: z.boolean().optional(),
      }),
    },
    Notice: {
      description: 'Callout that draws attention to a message.',
      props: z.object({
        variant: z.enum(['info', 'success', 'warning', 'destructive', 'note']).default('info'),
        title: z.string().optional(),
        text: z.string(),
      }),
    },
  },
  actions: {},
});
