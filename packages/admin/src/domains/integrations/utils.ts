import fs from 'fs';
import path from 'path';

import { FileEnvService } from '@/service/service.fileEnv';

import { CredentialInfo, IntegrationPackage } from './types';

export const getIntegrationConfigAndWriteCredentialToEnv = async ({
  integrationName,
  credential,
}: {
  integrationName: string;
  credential: CredentialInfo;
}) => {
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
  console.log({ integrationConfigString, credential, scopes: credential.scopes });

  return integrationConfigString;
};

export const getIntegrations = async (): Promise<IntegrationPackage[]> => {
  const jsonFilePath = path.join(process.cwd(), '/src/domains/integrations/generated/integrations.json');
  try {
    const integrations = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    return integrations;
  } catch (err) {
    console.error(`Error reading or parsing file: ${jsonFilePath}`);
    console.error(err);
    return [];
  }
};
