import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Txt } from '@/ds/components/Txt';
import { useScrollToFirstHighlight } from '@/hooks/use-scroll-to-first-highlight';
import { useTextHighlight } from '@/hooks/use-text-highlight';

function ScrollToFirstHighlightDemo() {
  const [search, setSearch] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const { ref: scrollRef } = useScrollToFirstHighlight<HTMLDivElement>(search, resetKey);
  const { ref: highlightRef } = useTextHighlight<HTMLDivElement>(search);
  return (
    <HookDemo>
      <Txt as="label" htmlFor="scroll-query">
        Search for “target” or a line number
      </Txt>
      <Input id="scroll-query" value={search} onChange={event => setSearch(event.target.value)} />
      <Button disabled={search.trim().length < 2} onClick={() => setResetKey(value => value + 1)}>
        Return to first match
      </Button>
      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Search results"
        className="border-border1 h-60 overflow-y-auto rounded-lg border p-4"
      >
        <div ref={highlightRef} className="space-y-4">
          {Array.from({ length: 30 }, (_, index) => (
            <Txt key={index} data-highlight>
              Line {index + 1}: {index === 20 ? 'target span found' : 'workflow activity'}
            </Txt>
          ))}
        </div>
      </div>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useScrollToFirstHighlight',
  component: ScrollToFirstHighlightDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Scrolls the first eligible search match into view. A reset key repeats the scroll for the same query. Pair with useTextHighlight to paint matches. Import from `@mastra/playground-ui/hooks/use-scroll-to-first-highlight`.',
      },
    },
  },
} satisfies Meta<typeof ScrollToFirstHighlightDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
