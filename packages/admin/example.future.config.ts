import { Config, createFramework } from 'core';
import { GoogleIntegration } from 'future-google';
import { MailchimpIntegration } from 'future-mailchimp';
import { SlackIntegration } from 'future-slack';

// // We have an admin db
// // Enter secrets and shit it saves it to admin db for that integration
// // ADMIN DISPLAYS A CATALOG of plugins
// // You fill the form in and magically
// //

// export async function getFramework() {
//   // GO to host project and grab the config
//   // For each plugin they have in their plugins attempt to resolve the config from the DB
//   const configFromDB = {}
//   return createFramework(configFromDB);
// }

export const dbUrl = process.env.DB_URL;
export const redirectHost = process.env.KEPLER_URL;

if (!dbUrl || !redirectHost) {
  throw new Error('Missing required environment variables');
}

export const redirectPath = '/api/integrations/connect/callback';

export const REDIRECT_URI = new URL(redirectPath, redirectHost).toString();

// THIS IS YOUR PROJECTS CONFIG
export const config: Config = {
  name: 'kepler',
  //logConfig: {}, // TODO: Add this
  systemActions: [],
  systemEvents: [],
  plugins: [
    new MailchimpIntegration({
      config: {
        CLIENT_ID: process.env.MAILCHIMP_CLIENT_ID!,
        CLIENT_SECRET: process.env.MAILCHIMP_CLIENT_SECRET!,
        REDIRECT_URI: new URL(redirectPath, 'http://127.0.0.1:3000').toString(),
      },
    }),
    new SlackIntegration({
      config: {
        CLIENT_ID: process.env.SLACK_CLIENT_ID!,
        CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
        REDIRECT_URI: new URL(redirectPath, 'http://127.0.0.1:3000').toString(),
      },
    }),
    new GoogleIntegration({
      config: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
        REDIRECT_URI,
        TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
      },
    }),
  ],
  db: {
    provider: 'postgres',
    uri: dbUrl,
  },
  systemHostURL: process.env.KEPLER_URL!,
  routeRegistrationPath: '/api/integrations',
};

export const future = createFramework(config);
