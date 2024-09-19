import React from 'react';

import { redirect } from 'next/navigation';

import { framework } from '../../lib/framework-utils';

import AdminLayout from './layouts/admin-layout';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const integrations =
    framework?.availableIntegrations()?.map(({ name, integration }) => ({ name, logoUrl: integration.logoUrl })) || [];

  if (integrations.length === 0) {
    return redirect('/welcome');
  }

  return <AdminLayout availableIntegrations={integrations}>{children}</AdminLayout>;
};

export default DashboardLayout;
