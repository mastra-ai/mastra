import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatShortDate } from '@/utils/date-format';

const now = Date.UTC(2026, 8, 24, 12);
const opts = { now, locale: 'en-US', timeZone: 'UTC' };

const examples: HelperExample[] = [
  ['formatShortDate(now, opts)', formatShortDate(now, opts)],
  ['formatShortDate(Date.UTC(2025, 11, 31), opts)', formatShortDate(Date.UTC(2025, 11, 31), opts)],
  ['formatShortDate(null, opts)', formatShortDate(null, opts)],
];

const meta = {
  title: 'Helpers/formatShortDate',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Short absolute date without a time. Omits the year when it matches `now`. Examples use `now` = Sep 24, 2026 12:00 UTC and `opts` = `{ now, locale: 'en-US', timeZone: 'UTC' }`. Import from `@mastra/playground-ui/utils/date-format`.",
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
