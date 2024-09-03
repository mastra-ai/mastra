import React from 'react';

import { framework } from '../../lib/framework-utils';

import AdminLayout from './layouts/admin-layout';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const integrations = framework?.availableIntegrations() || [];
  return <AdminLayout integrations={integrations}>{children}</AdminLayout>;
};

export default DashboardLayout;
