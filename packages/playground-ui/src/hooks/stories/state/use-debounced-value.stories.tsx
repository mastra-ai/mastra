import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { Txt } from '@/ds/components/Txt';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

function DebouncedValueDemo({ delay }: { delay: number }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, delay);
  return (
    <HookDemo>
      <Field>
        <FieldLabel>Search query</FieldLabel>
        <Input value={query} onChange={event => setQuery(event.target.value)} />
      </Field>
      <Txt>Input: {query || '(empty)'}</Txt>
      <Txt role="status">Debounced: {debouncedQuery || '(empty)'}</Txt>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useDebouncedValue',
  component: DebouncedValueDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Defers a value until typing pauses for the configured delay in milliseconds. Import from `@mastra/playground-ui/hooks/use-debounced-value`.',
      },
    },
  },
  args: { delay: 500 },
  argTypes: { delay: { control: { type: 'range', min: 100, max: 2000, step: 100 } } },
} satisfies Meta<typeof DebouncedValueDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
