import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

/**
 * The components Mastra Studio renders in agent replies, drawn with its design system.
 * Give it to an agent's `JsonRenderProcessor` to let the agent compose interfaces in Studio chat.
 * `@json-render/react/schema` only describes the spec format; it does not load React.
 */
export const studioCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({
        direction: z.enum(['vertical', 'horizontal']).optional(),
        gap: z.enum(['sm', 'md', 'lg']).optional(),
        align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
      }),
      slots: ['default'],
      description: 'Lays children out in a column (default) or a wrapping row.',
    },
    Grid: {
      props: z.object({ columns: z.number().int().min(1).max(4) }),
      slots: ['default'],
      description: 'Grid of equal columns; collapses to one column on narrow screens. Use for Stat or Card groups.',
    },
    Card: {
      props: z.object({ title: z.string().optional(), description: z.string().optional() }),
      slots: ['default'],
      description: 'Surface grouping related content, with an optional title and description.',
    },
    Heading: {
      props: z.object({ text: z.string(), size: z.enum(['lg', 'md', 'sm']).optional() }),
      slots: [],
      description: 'Section heading.',
    },
    Text: {
      props: z.object({ text: z.string(), tone: z.enum(['default', 'muted']).optional() }),
      slots: [],
      description: 'A paragraph of plain text.',
    },
    Badge: {
      props: z.object({
        text: z.string(),
        variant: z.enum(['neutral', 'success', 'warning', 'destructive', 'info']).optional(),
      }),
      slots: [],
      description: 'Short status or category label, e.g. "On track" or "Blocked".',
    },
    Stat: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        detail: z.string().optional(),
        trend: z.enum(['up', 'down', 'flat']).optional(),
      }),
      slots: [],
      description:
        "A key figure with its label, e.g. a metric, price or score. `detail` is a short note like '+12% vs last week'.",
    },
    Table: {
      props: z.object({
        columns: z.array(z.string()).min(1),
        rows: z.array(z.array(z.union([z.string(), z.number()]))),
      }),
      slots: [],
      description: 'Tabular data. Each row lists one cell per column, in column order.',
    },
    List: {
      props: z.object({ items: z.array(z.string()), ordered: z.boolean().optional() }),
      slots: [],
      description: 'Bulleted (or numbered when `ordered`) list of short items.',
    },
    Progress: {
      props: z.object({ label: z.string(), value: z.number().min(0).max(100), detail: z.string().optional() }),
      slots: [],
      description: 'Labeled progress bar; `value` is a percentage from 0 to 100.',
    },
    Notice: {
      props: z.object({
        text: z.string(),
        title: z.string().optional(),
        variant: z.enum(['info', 'success', 'warning', 'destructive', 'note']).optional(),
      }),
      slots: [],
      description: 'Callout that draws attention to a note, tip, warning or error.',
    },
    Separator: {
      props: z.object({}),
      slots: [],
      description: 'Horizontal divider between sections.',
    },
    Button: {
      props: z.object({ label: z.string(), variant: z.enum(['primary', 'default', 'ghost']).optional() }),
      slots: [],
      events: ['press'],
      description:
        "Button. Bind its `press` event with `on`, e.g. to `sendMessage` to answer on the user's behalf, or to `setState`.",
    },
    Input: {
      props: z.object({
        label: z.string(),
        value: z.string().optional(),
        placeholder: z.string().optional(),
        type: z.enum(['text', 'number', 'email']).optional(),
      }),
      slots: [],
      description: 'Labeled text field. Bind `value` to state with { "$bindState": "/path" } so its value can be read.',
    },
    Select: {
      props: z.object({
        label: z.string(),
        options: z.array(z.object({ label: z.string(), value: z.string() })).min(1),
        value: z.string().optional(),
        placeholder: z.string().optional(),
      }),
      slots: [],
      description: 'Labeled dropdown. Bind `value` to state with { "$bindState": "/path" }.',
    },
    Checkbox: {
      props: z.object({ label: z.string(), checked: z.boolean().optional() }),
      slots: [],
      description: 'Labeled checkbox. Bind `checked` to state with { "$bindState": "/path" }.',
    },
  },
  actions: {
    sendMessage: {
      params: z.object({ message: z.string().min(1) }),
      description:
        'Sends `message` to you as the user\'s next turn, e.g. when they pick an option or submit a form. Pass a field\'s value with { "$state": "/path" }.',
    },
  },
});

export type StudioCatalog = typeof studioCatalog;
