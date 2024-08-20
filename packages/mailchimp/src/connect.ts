import { AuthToken } from '@arkw/core';

import { MAILCHIMP_HOST } from './constants';

// Mailchimp requires a call to the /metadata endpoint to get the user's server prefix.
// This prefix is necessary to correctly target API requests per user
export const resolveMailchimpServerPrefix = async ({ token }: { token: AuthToken }) => {
  const url = new URL('/oauth2/metadata', MAILCHIMP_HOST);
  const headers = { Authorization: `OAuth ${token.accessToken}` };
  const response = await fetch(url, { headers });
  const payload = await response.json();

  return payload.dc;
};
