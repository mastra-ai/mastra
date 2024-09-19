// import { IntegrationCredentialType } from '@kpl/core';
import { useIntegrationDetails } from '../hooks/use-integration';
import { useConnectSnippet } from '../hooks/useConnectSnippet';
import { ApiKeyConfigProps, IntegrationCredentialType } from '../types';

import { CodeBlock } from './code-block';

export const IntegrationButtonCodeSnippet = ({
  name,
  className,
  innerClassName,
}: {
  name: string;
  className?: HTMLDivElement['className'];
  innerClassName?: HTMLDivElement['className'];
}) => {
  const { integration } = useIntegrationDetails({ name });

  let apiKeyConfig: ApiKeyConfigProps = {
    type: 'object',
    properties: {
      apiKey: { type: 'string' },
    },
    required: ['apiKey'],
    $schema: '',
    additionalProperties: false,
  };

  if (integration?.authType === IntegrationCredentialType.API_KEY && integration?.config?.apiKey) {
    apiKeyConfig = integration?.config.apiKey!;
  }

  const { snippet } = useConnectSnippet({
    integrationName: name,
    authType: IntegrationCredentialType.API_KEY,
    apiKeyConfig,
  });

  // const snippet = `
  //   import { config } from '@kpl/config';
  //   import { Framework } from '@kpl/core';

  //   export const ${name && capitalizeFirstLetter(name)}ConnectButton = () => {
  //     const framework = Framework.init(config);
  //     const OAuthConnectionRoute = framework?.makeConnectURI({
  //       clientRedirectPath: 'YOUR_REDIRECT_PATH',
  //       name: '${name}',
  //       referenceId: 'YOUR_REFERENCE_ID',
  //     });

  //     return (
  //       <a href={OAuthConnectionRoute}
  //         className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
  //       >
  //         Connect with ${name && capitalizeFirstLetter(name)}
  //       </a>
  //     );
  //   };
  //   `;

  return <CodeBlock snippet={snippet} className={className} innerClassName={innerClassName} />;
};
