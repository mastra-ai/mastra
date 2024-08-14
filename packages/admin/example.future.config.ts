import { Config, createFramework } from 'core';
import { MailchimpIntegration } from 'future-mailchimp'


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
        REDIRECT_URI: ''
      }
    }),
  ],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=future',
  },
};

export const future = createFramework(config);