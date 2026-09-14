import type { Meta, StoryObj } from '@storybook/react-vite';
import { FocusRadios } from '../../../../.storybook/fixtures/focus/controls';
import { FocusStoryFrame } from '../../../../.storybook/fixtures/focus/story-frame';

const meta = {
  title: 'Elements/RadioGroup',
  parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;

export const KeyboardFocus: StoryObj = {
  render: () => (
    <FocusStoryFrame>
      <FocusRadios />
    </FocusStoryFrame>
  ),
};
