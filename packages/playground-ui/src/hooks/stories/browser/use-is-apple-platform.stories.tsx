import type { Meta, StoryObj } from '@storybook/react-vite';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Kbd } from '@/ds/components/Kbd';
import { Txt } from '@/ds/components/Txt';
import { useIsApplePlatform } from '@/hooks/use-keyboard-shortcut-label';

function IsApplePlatformDemo() {
  const isApplePlatform = useIsApplePlatform();
  return (
    <HookDemo>
      <Txt>Detected platform: {isApplePlatform ? 'Apple' : 'Non-Apple'}</Txt>
      <Txt>
        Primary modifier: <Kbd>{isApplePlatform ? '⌘' : 'Ctrl'}</Kbd>
      </Txt>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useIsApplePlatform',
  component: IsApplePlatformDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Detects the browser platform once on mount for platform-specific interface labels. Import from `@mastra/playground-ui/hooks/use-keyboard-shortcut-label`.',
      },
    },
  },
} satisfies Meta<typeof IsApplePlatformDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
