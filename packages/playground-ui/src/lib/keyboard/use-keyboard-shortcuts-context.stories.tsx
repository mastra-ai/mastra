import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { KeyboardShortcutsProvider, useKeyboardShortcutsContext } from './keyboard-shortcuts-context';
import { useKeydown } from './use-keydown';
import { HookDemo } from '../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

function ShortcutStatus() {
  const context = useKeyboardShortcutsContext();
  const [escapeCount, setEscapeCount] = useState(0);
  useKeydown({ Escape: () => setEscapeCount(count => count + 1) });
  return (
    <>
      <Txt>Provider status: {context.status}</Txt>
      <Txt role="status">Escape presses: {escapeCount}</Txt>
    </>
  );
}

function KeyboardShortcutsContextDemo() {
  const [withProvider, setWithProvider] = useState(true);
  return (
    <HookDemo>
      <Txt>Focus the canvas and press Escape. Without a provider, useKeydown uses its own listener.</Txt>
      <Button onClick={() => setWithProvider(value => !value)}>
        {withProvider ? 'Remove provider' : 'Mount provider'}
      </Button>
      {withProvider ? (
        <KeyboardShortcutsProvider>
          <ShortcutStatus />
        </KeyboardShortcutsProvider>
      ) : (
        <ShortcutStatus />
      )}
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useKeyboardShortcutsContext',
  component: KeyboardShortcutsContextDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Reads the shared shortcut dispatcher or an explicit missing status. Prefer useKeydown for binding keys. Import from `@mastra/playground-ui/keyboard/keyboard-shortcuts-context`.',
      },
    },
  },
} satisfies Meta<typeof KeyboardShortcutsContextDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
