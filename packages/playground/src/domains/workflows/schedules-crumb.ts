import { IconCalendarClock4 } from '@mastra/playground-ui/icons/central/IconCalendarClock4';
import type { CrumbDef } from '@/domains/navigation/crumbs';

export const schedulesCrumb = {
  id: 'workflow-schedules',
  label: 'Schedules',
  icon: IconCalendarClock4,
  to: '/workflows/schedules',
} satisfies CrumbDef;
