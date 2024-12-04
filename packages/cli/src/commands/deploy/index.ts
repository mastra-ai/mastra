import * as prompts from '@clack/prompts';
import { VercelDeployer } from './vercel/index.js';
import { getCreds, writeCreds } from './utils.js';

async function fetchVercelTeams(authToken: string) {
    if (!authToken) {
        throw new Error('Authentication token is required');
    }

    const headers = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
    };

    try {
        const response = await fetch('https://api.vercel.com/v2/teams', {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch teams: ${response.statusText}`);
        }

        const data = await response.json();
        return data.teams?.filter(({ membership }: { membership: { role: string } }) => membership.role === 'OWNER')?.map(({ slug }: { slug: string }) => slug);
    } catch (error) {
        console.error('Error fetching teams:', error);
        throw error;
    }
}

export async function vercelDeploy() {
    console.log('Deploying to Vercel...');

    const creds = getCreds('VERCEL')

    let token
    let scope

    if (!creds) {
        const v = await prompts.text({
            message: 'Provide a Vercel authorization token',
        })

        if (!v) {
            console.log('No token provided, exiting...');
            return;
        }

        const teams = await fetchVercelTeams(v as string);

        scope = (await prompts.select({
            message: 'Choose a team',
            options: teams.map((slug: string) => {
                return {
                    value: slug,
                    label: slug
                }
            })
        })) as string

        token = v as string

        console.log('Saving Team and Token to .mastra/creds.json:', scope);
        writeCreds({ scope, token, name: `VERCEL` });
    } else {
        console.log('Using existing Vercel credentials from .mastra/creds.json');
        token = creds.token
        scope = creds.scope as string
    }

    const deployer = new VercelDeployer({ token });

    await deployer.deploy({ scope });

    console.log('Deployment complete!');
    process.exit(0);
}