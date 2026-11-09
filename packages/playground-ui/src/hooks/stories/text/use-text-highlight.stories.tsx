import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { Txt } from '@/ds/components/Txt';
import { useTextHighlight } from '@/hooks/use-text-highlight';

function TextHighlightDemo() {
  const [search, setSearch] = useState('agent');
  const { ref } = useTextHighlight<HTMLDivElement>(search);
  const supportsHighlights = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
  return (
    <HookDemo>
      <Field>
        <FieldLabel>Find text (at least two characters)</FieldLabel>
        <Input value={search} onChange={event => setSearch(event.target.value)} />
      </Field>
      {!supportsHighlights && (
        <Txt role="status">This browser does not support CSS Custom Highlights. Text remains readable.</Txt>
      )}
      <div ref={ref} className="space-y-4">
        <Txt data-highlight>The agent calls a tool. Another AGENT returns the result.</Txt>
        <Txt>Agent navigation label: outside the searchable region.</Txt>
        <Txt data-highlight-indirect>Matching span metadata</Txt>
      </div>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useTextHighlight',
  component: TextHighlightDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Highlights literal, case-insensitive terms of at least two characters inside data-highlight regions. data-highlight-indirect marks labels whose match lives elsewhere. Only one highlight surface is active per document. Import from `@mastra/playground-ui/hooks/use-text-highlight`.',
      },
    },
  },
} satisfies Meta<typeof TextHighlightDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
