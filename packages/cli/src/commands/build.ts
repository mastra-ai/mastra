import { Deployer } from '@mastra/deployer';
import { join } from 'path';

export async function build({ dir }: { dir?: string }) {
  let directoryToDeploy = dir || join(process.cwd(), 'src/mastra');

  const deployer = new Deployer({
    dir: process.cwd(),
    type: 'Deploy',
  });

  await deployer.prepare({
    dir: directoryToDeploy,
  });

  const { mastra } = await deployer.getMastra();

  const resDeployer = mastra.getDeployer();

  if (!resDeployer) {
    // If no deployer, we are deploying to Mastra Cloud
  } else {
    resDeployer.writeFiles({ dir: deployer.getMastraPath() });
  }
}
