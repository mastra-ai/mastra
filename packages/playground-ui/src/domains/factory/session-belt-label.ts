import type { ActivityStatus } from '@/ds/components/Activity';

export function sessionBeltLabel(status: ActivityStatus, name: string) {
  if (status === 'initializing') return `Initializing ${name}`;
  if (status === 'working') return `Agent working in ${name}`;
  return `${name} waiting on you`;
}
