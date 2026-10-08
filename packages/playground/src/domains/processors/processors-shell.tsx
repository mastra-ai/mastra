import { Outlet } from 'react-router';
import { ResourceDetailShell } from '@/components/resource-detail-shell';

export function ProcessorsShell() {
  return (
    <ResourceDetailShell
      navigationId="processors"
      label="Processors navigation"
      back={{ label: 'All processors', href: '/processors' }}
    >
      <Outlet />
    </ResourceDetailShell>
  );
}
