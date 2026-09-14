import type { Meta, StoryObj } from '@storybook/react-vite';
import { FocusCommands } from '../../../../.storybook/fixtures/focus/menus';
import { FocusStoryFrame } from '../../../../.storybook/fixtures/focus/story-frame';

const meta = {
  title: 'Composite/Command',
  parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;

export const KeyboardFocus: StoryObj = {
  render: () => (
    <FocusStoryFrame>
      <FocusCommands />
    </FocusStoryFrame>
  ),
};
