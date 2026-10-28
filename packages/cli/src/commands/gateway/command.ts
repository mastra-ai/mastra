import * as p from '@clack/prompts';
import color from 'picocolors';
import { getToken } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';
import { getGatewayCredits } from './api.js';
import { formatCredits, offerGatewayCredits } from './credits.js';

/** `mastra gateway credits`: show the Gateway balance and buy credits in the browser. */
export async function gatewayCreditsAction() {
  const token = await getToken(undefined, { source: 'mastra-cli' });
  const org = await resolveCurrentOrg(token);
  const credits = await getGatewayCredits(token, org.orgId);

  p.intro(`Mastra Gateway credits for ${color.cyan(org.orgName)}`);
  if (credits.unlimited) {
    p.outro('This organization has unlimited Gateway credits.');
    return;
  }

  const outcome = await offerGatewayCredits({ token, orgId: org.orgId, credits, always: true });
  p.outro(`Balance: ${formatCredits(outcome.remaining)}`);
}
