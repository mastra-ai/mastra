import * as prompts from '@clack/prompts';
import { Deployer } from '@mastra/deployer';
import { join } from 'path';

import { logger } from '../../utils/logger.js';

// import { CloudflareDeployer } from './cloudflare/index.js';
// import { NetlifyDeployer } from './netlify/index.js';

// async function fetchVercelTeams(authToken: string) {
//   if (!authToken) {
//     throw new Error('Authentication token is required');
//   }

//   const headers = {
//     Authorization: `Bearer ${authToken}`,
//     'Content-Type': 'application/json',
//   };

//   try {
//     const response = await fetch('https://api.vercel.com/v2/teams', {
//       method: 'GET',
//       headers,
//     });

//     if (!response.ok) {
//       throw new Error(`Failed to fetch teams: ${response.statusText}`);
//     }

//     const data = await response.json();
//     return data.teams
//       ?.filter(({ membership }: { membership: { role: string } }) => membership.role === 'OWNER')
//       ?.map(({ slug }: { slug: string }) => slug);
//   } catch (error) {
//     console.error('Error fetching teams:', error);
//     throw error;
//   }
// }

// export async function vercelDeploy({ dir, projectName }: { dir?: string; projectName?: string }) {
//   prompts.intro(color.inverse(' Deploying to Vercel '));

//   const creds = getCreds('VERCEL');

//   let token;
//   let scope;

//   if (!creds) {
//     const v = await prompts.text({
//       message: 'Provide a Vercel authorization token',
//     });

//     if (prompts.isCancel(v)) {
//       prompts.cancel('Deployment cancelled.');
//       process.exit(0);
//     }

//     if (!v) {
//       logger.log('No token provided, exiting...');
//       return;
//     }

//     const teams = await fetchVercelTeams(v as string);

//     scope = (await prompts.select({
//       message: 'Choose a team',
//       options: teams.map((slug: string) => {
//         return {
//           value: slug,
//           label: slug,
//         };
//       }),
//     })) as string;

//     token = v as string;

//     logger.log(`Saving Team and Token to .mastra/creds.json: ${scope}`);
//     writeCreds({ scope, token, name: `VERCEL` });
//   } else {
//     logger.log('Using existing Vercel credentials from .mastra/creds.json');
//     token = creds.token;
//     scope = creds.scope as string;
//   }

//   const deployer = new VercelDeployer({ token });

//   await deployer.deploy({ scope, dir, projectName });

//   logger.log('Deployment complete!');
//   process.exit(0);
// }

// async function getCloudflareAccountId(authToken: string) {
//   const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
//     headers: {
//       Authorization: `Bearer ${authToken}`,
//       'Content-Type': 'application/json',
//     },
//   });

//   const data = await response.json();

//   if (!response.ok) {
//     throw new Error(`Failed to get account ID: ${data.errors?.[0]?.message || 'Unknown error'}`);
//   }

//   // Returns the first account ID found
//   return data.result;
// }

export async function cloudflareDeploy({ dir }: { dir?: string }) {
  console.log(dir);
  // prompts.intro(color.inverse(' Deploying to Cloudflare '));

  // const creds = getCreds('CLOUDFLARE');

  // let token;
  // let scope;

  // if (!creds) {
  //   const v = await prompts.text({
  //     message: 'Provide a Cloudflare authorization token',
  //   });

  //   if (prompts.isCancel(v)) {
  //     prompts.cancel('Deployment cancelled.');
  //     process.exit(0);
  //   }

  //   if (!v) {
  //     logger.log('No token provided, exiting...');
  //     return;
  //   }

  //   const teams = await getCloudflareAccountId(v as string);

  //   scope = (await prompts.select({
  //     message: 'Choose a team',
  //     options: teams.map(({ name, id }: { name: string; id: string }) => {
  //       return {
  //         value: id,
  //         label: name,
  //       };
  //     }),
  //   })) as string;

  //   token = v as string;

  //   logger.log(`Saving Team and Token to .mastra/creds.json: ${scope}`);
  //   writeCreds({ scope, token, name: `CLOUDFLARE` });
  // } else {
  //   logger.log('Using existing Cloudflare credentials from .mastra/creds.json');
  //   token = creds.token;
  //   scope = creds.scope as string;
  // }

  // // const deployer = new CloudflareDeployer({ token });

  // // await deployer.deploy({ scope, dir });

  // logger.log('Deployment complete!');
  // process.exit(0);
}

export async function deploy({ dir, token }: { dir?: string; token?: string }) {
  let tokenToUse;

  if (!token) {
    const v = await prompts.text({
      message: 'Provide an access token',
    });

    if (!v) {
      logger.log('No token provided, exiting...');
      return;
    }
    tokenToUse = v as string;
  } else {
    tokenToUse = token;
  }

  if (!tokenToUse || tokenToUse === 'clack:cancel') {
    logger.log('No token provided, exiting...');
    return;
  }

  let directoryToDeploy = dir || join(process.cwd(), 'src/mastra');

  const deployer = new Deployer({
    dir: process.cwd(),
  });

  await deployer.prepare({
    dir: directoryToDeploy,
  });

  const { mastra } = await deployer.getMastra();

  const projectDeployer = mastra.getDeployer();

  if (!projectDeployer) {
    // If no deployer, we are deploying to Mastra Cloud
  } else {
    projectDeployer.writeFiles({ dir: deployer.getMastraPath() });

    try {
      await projectDeployer.deploy({
        dir: deployer.getMastraPath(),
        token: tokenToUse,
      });
    } catch (error) {
      console.error('[Mastra Deploy] - Error deploying:', error);
    }
  }
}
