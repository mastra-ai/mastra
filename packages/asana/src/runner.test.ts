import { AsanaIntegration } from '.';

export async function main() {
  const asana = new AsanaIntegration({
    config: {
      CLIENT_ID: process.env.CLIENT_ID!,
      CLIENT_SECRET: process.env.CLIENT_SECRET!,
    },
  });

  const client = await asana.getApiClient({ referenceId: '123' });

  const projectsRes = await client['/projects'].get();

  const projects = await projectsRes.json();

  console.log(projects);
}
