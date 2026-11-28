import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { VersionTimeline } from './index';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';

const meta = {
  title: 'Composite/VersionTimeline',
  component: VersionTimeline,
  parameters: {
    docs: {
      description: {
        component:
          'The versions of a document, newest first, on one line of dots: hollow for unsaved edits, blue for the draft, green for the live version and grey for the rest. `actions` replace a row’s `meta` on hover and keyboard focus, and stay visible on touch screens.',
      },
    },
  },
  decorators: [
    Story => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  args: { 'aria-label': 'Version history', children: null },
} satisfies Meta<typeof VersionTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

const restore = (
  <>
    <Button variant="ghost" size="sm">
      Compare
    </Button>
    <Button variant="ghost" size="sm" icon={<IconArrowRotateCounterClockwise />}>
      Restore
    </Button>
  </>
);

export const Default: Story = {
  render: args => (
    <VersionTimeline {...args}>
      <VersionTimeline.Item state="unsaved" title="Unsaved edits" meta="Now" />
      <VersionTimeline.Item state="draft" title="v4" label="Draft" meta="5 min ago">
        <VersionTimeline.Detail>Justin</VersionTimeline.Detail>
      </VersionTimeline.Item>
      <VersionTimeline.Item state="live" title="v3" label="Live" meta="2 days ago">
        <VersionTimeline.Detail>Charlie</VersionTimeline.Detail>
        <VersionTimeline.Detail>Used by Kit, Triage, Support</VersionTimeline.Detail>
      </VersionTimeline.Item>
      <VersionTimeline.Item state="past" title="v2" meta="Nov 12" actions={restore}>
        <VersionTimeline.Detail>Abhi</VersionTimeline.Detail>
        <VersionTimeline.Detail>Used by Release notes</VersionTimeline.Detail>
      </VersionTimeline.Item>
      <VersionTimeline.Item state="past" title="v1" meta="Nov 3" actions={restore}>
        <VersionTimeline.Detail>Justin</VersionTimeline.Detail>
      </VersionTimeline.Item>
    </VersionTimeline>
  ),
};

export const Comparing: Story = {
  render: args => (
    <VersionTimeline {...args}>
      <VersionTimeline.Item state="draft" title="v4" label="Draft" meta="5 min ago" />
      <VersionTimeline.Item state="live" title="v3" label="Live" meta="2 days ago" />
      <VersionTimeline.Item state="past" title="v2" meta="Comparing" selected>
        <VersionTimeline.Detail>Abhi, Nov 12</VersionTimeline.Detail>
      </VersionTimeline.Item>
    </VersionTimeline>
  ),
};
