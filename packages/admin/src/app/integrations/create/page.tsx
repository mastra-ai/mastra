import React from 'react';

import { framework } from '@/lib/framework-utils';

import { CreateIntegrationClientLayout } from '@/domains/integrations/components/create-integration-client-layout';
import { getIntegrations } from '@/domains/integrations/utils';

const CreateIntegrationPage = async () => {
  const integrations = await getIntegrations();
  const defaultRedirectURI = framework?.makeRedirectURI() || 'Not Availiable';

  return <CreateIntegrationClientLayout redirectURI={defaultRedirectURI} integrations={integrations} />;
};

export default CreateIntegrationPage;
