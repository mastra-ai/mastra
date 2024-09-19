import { ApiKeyConfigProps, IntegrationCredentialType } from '../types';
import { getConnectSnippet } from '../utils';

export const useConnectSnippet = ({
  integrationName,
  authType,
  apiKeyConfig,
}: {
  integrationName: string;
  authType: IntegrationCredentialType;
  apiKeyConfig?: ApiKeyConfigProps;
}) => {
  let snippet = '';

  if (authType === IntegrationCredentialType.API_KEY && apiKeyConfig) {
    snippet = getConnectSnippet({
      authType: IntegrationCredentialType.API_KEY,
      integrationName,
      apiKeyConfig,
    });
  } else if (authType === IntegrationCredentialType.OAUTH) {
    snippet = getConnectSnippet({
      authType,
      integrationName,
    });
  }

  console.log('ss===', { snippet });
  return {
    snippet,
  };
};
