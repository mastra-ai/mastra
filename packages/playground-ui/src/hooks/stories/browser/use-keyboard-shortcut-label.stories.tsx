import type { Meta, StoryObj } from '@storybook/react-vite';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Kbd } from '@/ds/components/Kbd';
import { Txt } from '@/ds/components/Txt';
import { useKeyboardShortcutLabel } from '@/hooks/use-keyboard-shortcut-label';

function KeyboardShortcutLabelDemo({ shortcutKey }: { shortcutKey: string }) {
  const label = useKeyboardShortcutLabel(shortcutKey);
  return (
    <HookDemo>
      <Txt>Change the key in Controls to update its label.</Txt>
      <Kbd>{label}</Kbd>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useKeyboardShortcutLabel',
  component: KeyboardShortcutLabelDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Formats a trimmed, upper-case key with the platform modifier. This hook labels shortcuts; it does not register them. Import from `@mastra/playground-ui/hooks/use-keyboard-shortcut-label`.',
      },
    },
  },
  args: { shortcutKey: 'k' },
} satisfies Meta<typeof KeyboardShortcutLabelDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
