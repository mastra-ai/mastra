import { redirectPath } from '../../../example.future.config';

export const getPluginConfig = (pluginName: string) => {
  let pluginConfigString = '';
  const PORT = '3000'; // TODO: get port from cli or something - user might not be on port 3000
  const baseUrl = `http://127.0.0.1:${PORT}`;
  const loweredCasedPluginName = pluginName.toLowerCase();

  switch (loweredCasedPluginName) {
    case 'mailchimp':
      pluginConfigString = `{
          config: {
            CLIENT_ID: process.env.MAILCHIMP_CLIENT_ID!,
            CLIENT_SECRET: process.env.MAILCHIMP_CLIENT_SECRET!,
            REDIRECT_URI: new URL(${JSON.stringify(redirectPath)}, ${JSON.stringify(baseUrl)}).toString(),
          },
        }`;
      break;

    case 'slack':
      pluginConfigString = `
        {
          config: {
            CLIENT_ID: process.env.SLACK_CLIENT_ID!,
            CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
            REDIRECT_URI: new URL(${JSON.stringify(redirectPath)}, ${JSON.stringify(baseUrl)}).toString(),
          },
        }`;
      break;

    case 'google':
      pluginConfigString = `
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

  return pluginConfigString;
};
