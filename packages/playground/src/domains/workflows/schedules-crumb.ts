import { CalendarClockIcon } from 'lucide-react';
import type { CrumbDef } from '@/domains/navigation/crumbs';

export const schedulesCrumb = {
  id: 'workflow-schedules',
  label: 'Schedules',
  icon: CalendarClockIcon,
  to: '/workflows/schedules',
} satisfies CrumbDef;
