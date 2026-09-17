import type { Meta, StoryObj } from '@storybook/react-vite';

import { HookDemo } from '../../../.storybook/fixtures/hooks/hook-demo';
import { KeyboardScope, useKeyboardScopeDepth } from './keyboard-shortcuts-context';
import { Txt } from '@/ds/components/Txt';

function ScopeDepth({ label }: { label: string }) {
  const depth = useKeyboardScopeDepth();
  return (
    <Txt>
      {label}: depth {depth}
    </Txt>
  );
}

function KeyboardScopeDepthDemo() {
  return (
    <HookDemo>
      <ScopeDepth label="App" />
      <KeyboardScope>
        <ScopeDepth label="Page" />
        <KeyboardScope>
          <ScopeDepth label="Panel" />
        </KeyboardScope>
      </KeyboardScope>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useKeyboardScopeDepth',
  component: KeyboardScopeDepthDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Reads the nearest KeyboardScope depth, starting at zero. Deeper scopes win when useKeydown bindings overlap. Import from `@mastra/playground-ui/keyboard/keyboard-shortcuts-context`.',
      },
    },
  },
} satisfies Meta<typeof KeyboardScopeDepthDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
