import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { HookDemo } from '../../../.storybook/fixtures/hooks/hook-demo';
import { useItemPanelKeyboardNav } from './use-item-panel-keyboard-nav';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

const items = ['Item 1', 'Item 2', 'Item 3'];

function ItemPanelKeyboardNavDemo() {
  const [index, setIndex] = useState<number | null>(0);
  useItemPanelKeyboardNav({
    active: index !== null,
    onPrevious: () => setIndex(current => (current === null ? null : Math.max(0, current - 1))),
    onNext: () => setIndex(current => (current === null ? null : Math.min(items.length - 1, current + 1))),
    onClose: () => setIndex(null),
  });
  return (
    <HookDemo>
      <Txt>Focus the canvas, then press PageUp or PageDown to move and Escape to close.</Txt>
      <Txt role="status">{index === null ? 'Panel closed' : `Open: ${items[index]}`}</Txt>
      {index === null ? <Button onClick={() => setIndex(0)}>Open panel</Button> : null}
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useItemPanelKeyboardNav',
  component: ItemPanelKeyboardNavDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Window-level item panel navigation: PageUp/PageDown move between items and Escape closes, ignoring keys typed into fields or other dialogs. Import from `@mastra/playground-ui/keyboard/use-item-panel-keyboard-nav`.',
      },
    },
  },
} satisfies Meta<typeof ItemPanelKeyboardNavDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
