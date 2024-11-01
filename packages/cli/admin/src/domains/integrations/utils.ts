import fs from 'fs';
import { snakeCase } from 'lodash';
import path from 'path';

import { capitalizeFirstLetter } from '@/lib/string';

import { FileEnvService } from '@/service/service.fileEnv';

import { ApiKeyConfigProps, CredentialInfo, IntegrationCredentialType, IntegrationPackage } from './types';

export const getIntegrationConfigAndWriteCredentialToEnv = async ({
  integrationName,
  credential,
}: {
  integrationName: string;
  credential?: CredentialInfo;
}) => {
  if (!credential) {
    return '';
  }

  const envFilePath = path.join(process.cwd(), '.env');
  const fileEnvService = new FileEnvService(envFilePath);
  const upperCasedIntegrationName = integrationName.toUpperCase();
  await fileEnvService.setEnvValue(`${upperCasedIntegrationName}_CLIENT_ID`, credential.clientID);
  await fileEnvService.setEnvValue(`${upperCasedIntegrationName}_CLIENT_SECRET`, credential.clientSecret);
  let integrationConfigString = '';

  const loweredCasedIntName = integrationName.toLowerCase();

  switch (loweredCasedIntName) {
    case 'google':
      integrationConfigString = `
        {
          config: {
            CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
            CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
            TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
            SCOPES: ${JSON.stringify(credential?.scopes, null, 2)}
          }
        }`;
      break;

    default:
      integrationConfigString = `{
    config: {
      CLIENT_ID: process.env.${upperCasedIntegrationName}_CLIENT_ID!,
      CLIENT_SECRET: process.env.${upperCasedIntegrationName}_CLIENT_SECRET!,
      SCOPES: ${JSON.stringify(credential?.scopes, null, 2)}
    },
  }`;
  }

  return integrationConfigString;
};

const getIntegrationsByFilePath = async (jsonFilePath: string): Promise<IntegrationPackage[]> => {
  try {
    const integrations = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    return integrations;
  } catch (err) {
    console.error(`Error reading or parsing file: ${jsonFilePath}`);
    console.error(err);
    return [];
  }
};

export const getIntegrations = async (): Promise<IntegrationPackage[]> => {
  const userIntegrationJsonFilePath = '/integrations/integrations.json';
  const userIntegrationJsonFilePathResolved = path.join(
    process.env.MASTRA_APP_DIR || process.cwd(),
    userIntegrationJsonFilePath,
  );

  const coreIntegrationJsonFilePath = path.join(process.cwd(), '/src/domains/integrations/generated/integrations.json');
  const coreIntegrations = await getIntegrationsByFilePath(coreIntegrationJsonFilePath);

  let customIntegrations: IntegrationPackage[] = [];
  if (fs.existsSync(userIntegrationJsonFilePathResolved)) {
    customIntegrations = await getIntegrationsByFilePath(userIntegrationJsonFilePathResolved);
  }

  return [...customIntegrations, ...coreIntegrations];
};

type APIKeyConfig = {
  integrationName: string;
  authType: IntegrationCredentialType.API_KEY;
  apiKeyConfig: ApiKeyConfigProps;
};

type OAuthConfig = {
  integrationName: string;
  authType: IntegrationCredentialType.OAUTH;
};

export const getConnectSnippet = (props: APIKeyConfig | OAuthConfig): string => {
  const { authType, integrationName } = props;
  let snippet;
  switch (authType) {
    case IntegrationCredentialType.OAUTH:
      snippet = `
    import { config } from '@mastra/config';
    import { Mastra } from '@mastra/core';

    export const ${integrationName}ConnectButton = () => {
      const framework = Mastra.init(config);
      const router = framework?.createRouter()
      const OAuthConnectionRoute = router.makeConnectURI({
        clientRedirectPath: 'YOUR_REDIRECT_PATH',
        name: '${integrationName.toUpperCase()}',
        connectionId: 'YOUR_CONNECTION_ID',
      });

      return (
        <a href={OAuthConnectionRoute}>
          Connect with ${integrationName}
        </a>
      );
    };`;
      break;

    case IntegrationCredentialType.API_KEY:
      const credential: Record<string, string> = {};
      Object.entries(props.apiKeyConfig.properties).forEach(([property, { type }]) => {
        const snakeCaseProperty = snakeCase(property);
        if (type === 'string') {
          credential[property] = `${snakeCaseProperty}`.toUpperCase();
        } else if (type === 'array') {
          credential[property] = `[${snakeCaseProperty}]`;
        }
      });

      snippet = `
    //server file - action.ts
    'use server'

    import { config } from '@mastra/config';
    import { Credential, Mastra } from '@mastra/core';

    export async function connectIntegrationByAPIKey({
      name,
      credential,
      connectionId,
    }: {
      name: string;
      connectionId: string;
      credential: Credential;
    }) {
      const framework = Mastra.init(config);
      return await framework?.connectIntegrationByCredential({
        name,
        connectionId,
        credential: {
          type: IntegrationCredentialType.API_KEY,
          value: credential,
        },
      });
    }



    //client file
    'use client'

    import { connectIntegrationByAPIKey } from './action.ts';

    export const ${capitalizeFirstLetter(integrationName)}ConnectButton = () => {
      const connectButton = async () => {
        await connectIntegrationByAPIKey({
          name: '${integrationName.toUpperCase()}',
          credential: ${JSON.stringify(credential)},
          connectionId: 'YOUR_CONNECTION_ID'
        });
      }

      return (
        <button onClick={connectButton}>
          Connect with ${capitalizeFirstLetter(integrationName)}
        </button>
      );
    };
    `;
      break;
    default:
      snippet = '';
  }

  return snippet;
};
