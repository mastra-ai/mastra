import type { Meta, StoryObj } from '@storybook/react-vite';
import { FocusTabs } from '../../../../.storybook/fixtures/focus/collections';
import { FocusStoryFrame } from '../../../../.storybook/fixtures/focus/story-frame';

const meta = {
  title: 'Navigation/Tabs',
  parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;

export const KeyboardFocus: StoryObj = {
  render: () => (
    <FocusStoryFrame>
      <FocusTabs />
    </FocusStoryFrame>
  ),
};
