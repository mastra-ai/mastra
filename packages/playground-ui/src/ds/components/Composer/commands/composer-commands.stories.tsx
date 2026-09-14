import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommandComposer } from '../../../../../.storybook/fixtures/command-composer';

const meta = {
  title: 'AI/Composer Commands',
  component: CommandComposer,
  parameters: {
    docs: {
      description: {
        component:
          'Compose ComposerSuggestions with useComposerCommands. Spread inputProps onto ComposerInput and suggestionsProps onto ComposerSuggestions. The caller owns the draft and onSubmit callback; the hook handles prefix matching, option selection, keyboard navigation, and focus. When composing an onKeyDown handler, call inputProps.onKeyDown first and handle submission only when the event has not been prevented. Enter on an exact command without options falls through to the caller. Command execution and availability belong to the application.',
      },
    },
  },
} satisfies Meta<typeof CommandComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Commands: Story = {};
export const CommandOptions: Story = { args: { initialValue: '/review ' } };
export const NoMatch: Story = { args: { initialValue: '/unknown' } };
export const Disabled: Story = { args: { enabled: false } };
export const LongList: Story = {
  args: {
    commands: Array.from({ length: 500 }, (_, index) => ({
      name: `command-${index + 1}`,
      description: 'A command with a long description that should stay within the composer on narrow screens',
    })),
  },
};
