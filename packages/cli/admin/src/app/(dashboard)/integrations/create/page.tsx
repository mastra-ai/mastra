import { Metadata } from 'next';
import React from 'react';

import { framework } from '@/lib/framework-utils';

import { CreateIntegrationClientLayout } from '@/domains/integrations/components/create-integration-client-layout';
import { getIntegrations } from '@/domains/integrations/utils';

export const metadata: Metadata = {
  title: 'Add Integration',
  description: 'Add Integration ...',
};

const CreateIntegrationPage = async () => {
  const integrations = await getIntegrations();
  const router = framework?.createRouter();
  const defaultRedirectURI = router?.makeRedirectURI() || 'Not Availiable';

  return <CreateIntegrationClientLayout redirectURI={defaultRedirectURI} integrations={integrations} />;
};

export default CreateIntegrationPage;
