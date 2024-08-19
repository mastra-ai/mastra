import { redirectPath } from '../../../example.future.config';

export const getIntegrationConfig = (integrationName: string) => {
  let integrationConfigString = '';
  const PORT = '3000'; // TODO: get port from cli or something - user might not be on port 3000
  const baseUrl = `http://127.0.0.1:${PORT}`;
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
            REDIRECT_URI,
            TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
          }
        }`;
      break;
  }

  return integrationConfigString;
};
