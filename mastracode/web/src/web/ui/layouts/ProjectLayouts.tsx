import type { ReactNode } from 'react';
import { Outlet } from 'react-router';

import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { DashboardSidebar, LocalSidebar } from '../Sidebar';
import { PageLayout } from '../ui';

function ProjectLayout({ sidebar }: { sidebar: ReactNode }) {
  return (
    <PageLayout sidebar={sidebar} header={<ChatHeader />}>
      <Outlet />
    </PageLayout>
  );
}

export function LocalLayout() {
  return <ProjectLayout sidebar={<LocalSidebar />} />;
}

export function DashboardLayout() {
  return <ProjectLayout sidebar={<DashboardSidebar />} />;
}
