import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatRelativeTime } from '@/utils/relative-time';

const now = Date.UTC(2026, 8, 24, 12);
const opts = { now, locale: 'en-US', timeZone: 'UTC' };

const examples: HelperExample[] = [
  ['formatRelativeTime(now - 2_000, opts)', formatRelativeTime(now - 2_000, opts)],
  ['formatRelativeTime(now - 45_000, opts)', formatRelativeTime(now - 45_000, opts)],
  ['formatRelativeTime(now - 3 * 60_000, opts)', formatRelativeTime(now - 3 * 60_000, opts)],
  ['formatRelativeTime(now - 5 * 3_600_000, opts)', formatRelativeTime(now - 5 * 3_600_000, opts)],
  ['formatRelativeTime(now - 2 * 86_400_000, opts)', formatRelativeTime(now - 2 * 86_400_000, opts)],
  ['formatRelativeTime(now + 10 * 60_000, opts)', formatRelativeTime(now + 10 * 60_000, opts)],
  ['formatRelativeTime(now - 30 * 86_400_000, opts)', formatRelativeTime(now - 30 * 86_400_000, opts)],
];

const meta = {
  title: 'Helpers/formatRelativeTime',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Short relative label for a moment (`5m ago`, `in 5m`). Falls back to an absolute date beyond 7 days. To render a moment, prefer `RelativeTimestamp`, which adds the exact time on hover. Examples use `now` = Sep 24, 2026 12:00 UTC and `opts` = `{ now, locale: 'en-US', timeZone: 'UTC' }`. Import from `@mastra/playground-ui/utils/relative-time`.",
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
