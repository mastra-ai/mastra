import React from 'react';

import { framework } from '../../lib/framework-utils';

import AdminLayout from './layouts/admin-layout';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const integrations =
    framework?.availableIntegrations()?.map(({ name, integration }) => {
      return {
        name,
        logoUrl: integration.logoUrl,
        entityTypes: Object.keys(integration.entityTypes),
      };
    }) || [];

  return <AdminLayout availableIntegrations={integrations}>{children}</AdminLayout>;
};

export default DashboardLayout;
