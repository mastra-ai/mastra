import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatDateRange } from '@/utils/date-format';

const now = Date.UTC(2026, 8, 24, 12);
const opts = { now, locale: 'en-US', timeZone: 'UTC' };

const examples: HelperExample[] = [
  [
    'formatDateRange(Date.UTC(2026, 8, 2), Date.UTC(2026, 8, 5), opts)',
    formatDateRange(Date.UTC(2026, 8, 2), Date.UTC(2026, 8, 5), opts),
  ],
  [
    'formatDateRange(Date.UTC(2026, 8, 28), Date.UTC(2026, 9, 3), opts)',
    formatDateRange(Date.UTC(2026, 8, 28), Date.UTC(2026, 9, 3), opts),
  ],
  [
    'formatDateRange(Date.UTC(2025, 11, 30), Date.UTC(2026, 0, 2), opts)',
    formatDateRange(Date.UTC(2025, 11, 30), Date.UTC(2026, 0, 2), opts),
  ],
];

const meta = {
  title: 'Helpers/formatDateRange',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Compact, locale-aware date range that collapses shared month and year. Examples use `now` = Sep 24, 2026 12:00 UTC and `opts` = `{ now, locale: 'en-US', timeZone: 'UTC' }`. Import from `@mastra/playground-ui/utils/date-format`.",
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
