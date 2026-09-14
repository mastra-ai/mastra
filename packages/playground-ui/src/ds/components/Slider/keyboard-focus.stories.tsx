import type { Meta, StoryObj } from '@storybook/react-vite';
import { FocusSliders } from '../../../../.storybook/fixtures/focus/controls';
import { FocusStoryFrame } from '../../../../.storybook/fixtures/focus/story-frame';

const meta = {
  title: 'Elements/Slider',
  parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;

export const KeyboardFocus: StoryObj = {
  render: () => (
    <FocusStoryFrame>
      <FocusSliders />
    </FocusStoryFrame>
  ),
};
