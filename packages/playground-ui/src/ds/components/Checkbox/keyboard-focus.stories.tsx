import type { Meta, StoryObj } from '@storybook/react-vite';
import { FocusCheckboxes } from '../../../../.storybook/fixtures/focus/controls';
import { FocusStoryFrame } from '../../../../.storybook/fixtures/focus/story-frame';

const meta = {
  title: 'Elements/Checkbox',
  parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;

export const KeyboardFocus: StoryObj = {
  render: () => (
    <FocusStoryFrame>
      <FocusCheckboxes />
    </FocusStoryFrame>
  ),
};
