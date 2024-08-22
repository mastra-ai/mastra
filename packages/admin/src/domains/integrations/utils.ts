import path from 'path';

import { FileEnvService } from '@/service/service.fileEnv';

import { CredentialInfo } from './types';

export const getIntegrationConfigAndWriteCredentialToEnv = async ({
  integrationName,
  credential,
}: {
  integrationName: string;
  credential: CredentialInfo;
}) => {
  // @todo: allow for redirectPath to be configurable?
  const redirectPath = '/api/integrations/connect/callback';
  const envFilePath = path.join(process.cwd(), '.env');
  const fileEnvService = new FileEnvService(envFilePath);
  const upperCasedIntegrationName = integrationName.toUpperCase();
  await fileEnvService.setEnvValue(`${upperCasedIntegrationName}_CLIENT_ID`, credential.clientID);
  await fileEnvService.setEnvValue(`${upperCasedIntegrationName}_CLIENT_SECRET`, credential.clientSecret);
  let integrationConfigString = '';

  const PORT = '3456'; // TODO: get port from cli or something - user might not be on port 3000
  const baseUrl = `http://localhost:${PORT}`;
  const loweredCasedIntName = integrationName.toLowerCase();

  switch (loweredCasedIntName) {
    case 'mailchimp':
      integrationConfigString = `{
          config: {
            CLIENT_ID: process.env.MAILCHIMP_CLIENT_ID!,
            CLIENT_SECRET: process.env.MAILCHIMP_CLIENT_SECRET!,
            REDIRECT_URI: new URL(${JSON.stringify(redirectPath)}, ${JSON.stringify(baseUrl)}).toString(),
          },
        }`;
      break;

    case 'slack':
      integrationConfigString = `
        {
          config: {
            CLIENT_ID: process.env.SLACK_CLIENT_ID!,
            CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
            REDIRECT_URI: new URL(${JSON.stringify(redirectPath)}, ${JSON.stringify(baseUrl)}).toString(),
          },
        }`;
      break;

    case 'google':
      integrationConfigString = `
        {
          config: {
            CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
            CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
            REDIRECT_URI: new URL(${JSON.stringify(redirectPath)}, ${JSON.stringify(baseUrl)}).toString(),
            TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
          }
        }`;
      break;
  }

  return integrationConfigString;
};
