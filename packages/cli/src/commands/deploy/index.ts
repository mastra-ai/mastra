import * as prompts from '@clack/prompts';
import color from 'picocolors';

import { logger } from '../../utils/logger.js';

import { CloudflareDeployer } from './cloudflare/index.js';
import { NetlifyDeployer } from './netlify/index.js';
import { getCreds, writeCreds } from './utils.js';
import { VercelDeployer } from './vercel/index.js';

async function fetchVercelTeams(authToken: string) {
  if (!authToken) {
    throw new Error('Authentication token is required');
  }

  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch('https://api.vercel.com/v2/teams', {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.statusText}`);
    }

    const data = await response.json();
    return data.teams
      ?.filter(({ membership }: { membership: { role: string } }) => membership.role === 'OWNER')
      ?.map(({ slug }: { slug: string }) => slug);
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
}

export async function vercelDeploy({ dir, projectName }: { dir?: string; projectName?: string }) {
  prompts.intro(color.inverse(' Deploying to Vercel '));

  const creds = getCreds('VERCEL');

  let token;
  let scope;

  if (!creds) {
    const v = await prompts.text({
      message: 'Provide a Vercel authorization token',
    });

    if (prompts.isCancel(v)) {
      prompts.cancel('Deployment cancelled.');
      process.exit(0);
    }

    if (!v) {
      logger.log('No token provided, exiting...');
      return;
    }

    const teams = await fetchVercelTeams(v as string);

    scope = (await prompts.select({
      message: 'Choose a team',
      options: teams.map((slug: string) => {
        return {
          value: slug,
          label: slug,
        };
      }),
    })) as string;

    token = v as string;

    logger.log(`Saving Team and Token to .mastra/creds.json: ${scope}`);
    writeCreds({ scope, token, name: `VERCEL` });
  } else {
    logger.log('Using existing Vercel credentials from .mastra/creds.json');
    token = creds.token;
    scope = creds.scope as string;
  }

  const deployer = new VercelDeployer({ token });

  await deployer.deploy({ scope, dir, projectName });

  logger.log('Deployment complete!');
  process.exit(0);
}

async function getCloudflareAccountId(authToken: string) {
  const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get account ID: ${data.errors?.[0]?.message || 'Unknown error'}`);
  }

  // Returns the first account ID found
  return data.result;
}

export async function cloudflareDeploy({ dir }: { dir?: string }) {
  prompts.intro(color.inverse(' Deploying to Cloudflare '));

  const creds = getCreds('CLOUDFLARE');

  let token;
  let scope;

  if (!creds) {
    const v = await prompts.text({
      message: 'Provide a Cloudflare authorization token',
    });

    if (prompts.isCancel(v)) {
      prompts.cancel('Deployment cancelled.');
      process.exit(0);
    }

    if (!v) {
      logger.log('No token provided, exiting...');
      return;
    }

    const teams = await getCloudflareAccountId(v as string);

    scope = (await prompts.select({
      message: 'Choose a team',
      options: teams.map(({ name, id }: { name: string; id: string }) => {
        return {
          value: id,
          label: name,
        };
      }),
    })) as string;

    token = v as string;

    logger.log(`Saving Team and Token to .mastra/creds.json: ${scope}`);
    writeCreds({ scope, token, name: `CLOUDFLARE` });
  } else {
    logger.log('Using existing Cloudflare credentials from .mastra/creds.json');
    token = creds.token;
    scope = creds.scope as string;
  }

  const deployer = new CloudflareDeployer({ token });

  await deployer.deploy({ scope, dir });

  logger.log('Deployment complete!');
  process.exit(0);
}

async function getNetlifyTeams(authToken: string) {
  const response = await fetch('https://api.netlify.com/api/v1/accounts', {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get teams: ${data.message || 'Unknown error'}`);
  }

  // Returns array of teams/accounts with their slugs
  return data.map((account: any) => ({
    name: account.name,
    slug: account.slug,
    // The slug is what you'll need for the deploy command
  }));
}

async function createNetlifySite(authToken: string, name: string, accountId?: string) {
  const response = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name,
      account_slug: accountId, // Optional - if not provided, creates in user's default account
      force_ssl: true, // Enable HTTPS
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to create site: ${data.message || 'Unknown error'}`);
  }

  return {
    id: data.id,
    name: data.name,
    url: data.ssl_url || data.url,
    adminUrl: data.admin_url,
  };
}

async function findNetlifySite(authToken: string, name: string) {
  const response = await fetch(`https://api.netlify.com/api/v1/sites?filter=all&name=${name}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to search sites: ${data.message || 'Unknown error'}`);
  }

  // Find exact match (filter can return partial matches)
  return data.find((site: any) => site.name === name);
}

async function getOrCreateSite(authToken: string, name: string, scope: string) {
  const existingSite = await findNetlifySite(authToken, name);

  if (existingSite) {
    return existingSite;
  }

  return createNetlifySite(authToken, name, scope);
}

export async function netlifyDeploy({ dir }: { dir?: string }) {
  prompts.intro(color.inverse(' Deploying to Netlify '));

  const creds = getCreds('NETLIFY');

  let token;
  let scope;
  let siteId;

  if (!creds) {
    const v = await prompts.text({
      message: 'Provide a Netlify authorization token',
    });

    if (!v) {
      logger.log('No token provided, exiting...');
      return;
    }

    if (prompts.isCancel(v)) {
      prompts.cancel('Deployment cancelled.');
      process.exit(0);
    }

    const teams = await getNetlifyTeams(v as string);

    scope = (await prompts.select({
      message: 'Choose a team',
      options: teams.map(({ name, slug }: { name: string; slug: string }) => {
        return {
          value: slug,
          label: name,
        };
      }),
    })) as string;

    token = v as string;

    const s = await getOrCreateSite(token, 'mastra', scope);
    logger.log(`Saving Team and Token to .mastra/creds.json: ${scope}`);
    writeCreds({ scope, token, name: `NETLIFY`, siteId: s.id });
    siteId = s.id;
  } else {
    logger.log('Using existing Netlify credentials from .mastra/creds.json');
    token = creds.token;
    scope = creds.scope as string;
    siteId = creds.siteId as string;
  }

  const deployer = new NetlifyDeployer({ token });

  await deployer.deploy({ scope, siteId, dir });

  logger.log('Deployment complete!');
  process.exit(0);
}
