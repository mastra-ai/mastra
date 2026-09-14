import type { Meta, StoryObj } from '@storybook/react-vite';
import { FocusTable } from '../../../../.storybook/fixtures/focus/collections';
import { FocusStoryFrame } from '../../../../.storybook/fixtures/focus/story-frame';

const meta = {
  title: 'DataDisplay/Table',
  parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;

export const KeyboardFocus: StoryObj = {
  render: () => (
    <FocusStoryFrame>
      <FocusTable />
    </FocusStoryFrame>
  ),
};
