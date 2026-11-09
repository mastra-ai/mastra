import { defineCatalog, defineSchema } from '@json-render/core';
import { z } from 'zod/v4';

/** A renderer-free json-render schema, as a server or a bot defines its own. */
const schema = defineSchema(s => ({
  spec: s.object({
    root: s.string(),
    elements: s.record(
      s.object({
        type: s.ref('catalog.components'),
        props: s.propsOf('catalog.components'),
        children: s.array(s.string()),
      }),
    ),
  }),
  catalog: s.object({
    components: s.map({ props: s.zod(), description: s.string() }),
    actions: s.map({ params: s.zod(), description: s.string() }),
  }),
}));

export const tripCatalog = defineCatalog(schema, {
  components: {
    Card: { props: z.object({ title: z.string() }), description: 'A titled card' },
    Toggle: {
      props: z.object({ label: z.string(), checked: z.boolean().optional() }),
      description: 'An on/off switch',
    },
  },
  actions: {
    book: { params: z.object({ city: z.string() }), description: 'Book the trip' },
  },
});

export const tripArgs = {
  root: 'card',
  state: { remind: false },
  elements: [
    { id: 'card', type: 'Card', props: { title: 'Trip' }, children: ['remind'] },
    { id: 'remind', type: 'Toggle', props: { label: 'Remind me', checked: { $bindState: '/remind' } } },
  ],
};
