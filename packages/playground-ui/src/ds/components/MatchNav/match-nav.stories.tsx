import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { TooltipProvider } from '../Tooltip';
import { MatchNav } from './match-nav';
import { useMatchNavigation } from '@/hooks/use-match-navigation';

const meta: Meta<typeof MatchNav> = {
  title: 'Composite/MatchNav',
  component: MatchNav,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MatchNav>;

export const Default: Story = {
  args: {
    current: 2,
    total: 12,
  },
};

export const NoMatches: Story = {
  args: {
    current: 0,
    total: 0,
  },
};

// Displayed values cap at "999+" so the counter width stays bounded on huge match lists.
export const LargeTotals: Story = {
  args: {
    current: 2841,
    total: 2841,
  },
};

// The intended pairing: `useMatchNavigation` owns the active index and wraparound while MatchNav
// renders the counter and controls. Type in the input to change the match list, use the buttons
// or Enter / Shift+Enter to step through it.
const DEMO_ITEMS = ['alpha', 'beta', 'alpaca', 'gamma', 'albatross'];

function WithHookDemo() {
  const [query, setQuery] = useState('al');
  const matches = useMemo(() => DEMO_ITEMS.filter(item => query && item.includes(query)), [query]);
  const nav = useMatchNavigation({ matches });

  return (
    <div className="flex w-64 flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-md border border-border1 px-2 py-1 text-ui-sm"
          value={query}
          placeholder="Filter items..."
          onChange={e => setQuery(e.target.value)}
          onKeyDown={nav.onSearchKeyDown}
        />
        <MatchNav current={nav.current} total={nav.total} onNext={nav.goToNext} onPrevious={nav.goToPrevious} />
      </div>
      <ul className="text-ui-sm">
        {DEMO_ITEMS.map(item => {
          const matchIndex = matches.indexOf(item);
          const isActive = matchIndex !== -1 && matchIndex === nav.activeIndex;
          return (
            <li key={item} className={isActive ? 'rounded-sm bg-accent1/35 px-1' : 'px-1'}>
              {item}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const WithUseMatchNavigation: Story = {
  render: () => <WithHookDemo />,
};
