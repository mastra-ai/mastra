import React from 'react';

import { CreateIntegrationClientLayout } from '@/domains/integrations/components/create-integration-client-layout';
import { getIntegrations } from '@/domains/integrations/utils';

const CreateIntegrationPage = async () => {
  const integrations = await getIntegrations();
  return <CreateIntegrationClientLayout integrations={integrations} />;
};

export default CreateIntegrationPage;
