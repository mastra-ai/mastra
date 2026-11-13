import { IconCalendarClock } from '@mastra/playground-ui/icons/central/IconCalendarClock';
import type { CrumbDef } from '@/domains/navigation/crumbs';

export const schedulesCrumb = {
  id: 'workflow-schedules',
  label: 'Schedules',
  icon: IconCalendarClock,
  to: '/workflows/schedules',
} satisfies CrumbDef;
