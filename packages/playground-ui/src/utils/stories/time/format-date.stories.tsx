import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatDate } from '@/utils/date-format';

const now = Date.UTC(2026, 8, 24, 12);
const opts = { now, locale: 'en-US', timeZone: 'UTC' };

const examples: HelperExample[] = [
  ["formatDate(now, 'date', opts)", formatDate(now, 'date', opts)],
  ["formatDate(Date.UTC(2025, 2, 4), 'date', opts)", formatDate(Date.UTC(2025, 2, 4), 'date', opts)],
  ["formatDate(now, 'date-time', opts)", formatDate(now, 'date-time', opts)],
  ["formatDate(now, 'date-time-seconds', opts)", formatDate(now, 'date-time-seconds', opts)],
  ["formatDate(now, 'time', opts)", formatDate(now, 'time', opts)],
  ["formatDate(now, 'time-seconds', opts)", formatDate(now, 'time-seconds', opts)],
  ["formatDate(now - 90_000, 'relative-time', opts)", formatDate(now - 90_000, 'relative-time', opts)],
  ["formatDate('not a date', 'date', opts)", formatDate('not a date', 'date', opts)],
];

const meta = {
  title: 'Helpers/formatDate',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Formats a moment with a named preset: `date`, `date-time`, `date-time-seconds`, `time`, `time-seconds`, or `relative-time`. Uses the browser locale unless `locale` is given. Examples use `now` = Sep 24, 2026 12:00 UTC and `opts` = `{ now, locale: 'en-US', timeZone: 'UTC' }`. Import from `@mastra/playground-ui/utils/date-format`.",
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
