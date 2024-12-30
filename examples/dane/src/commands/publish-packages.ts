import chalk from 'chalk';
import path from 'path';
import { z } from 'zod';

import { mastra } from '../mastra/index.js';

export async function publishPackages() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me publish your packages..\n'));

  const agent = mastra.getAgent('danePackagePublisher');
  const result = await agent.generate(`
        Can you tell me which packages within the packages and integrations directory need to be published to npm?
        `);

  const resultObj = await agent.generate(
    `
        Can you format this for me ${result.text}? 
        @mastra/core must be first. 
        @mastra/dane should be listed after packages and integrations.
        `,
    {
      schema: z.object({
        packages: z.array(z.string()),
        integrations: z.array(z.string()),
        danePackage: z.string(),
      }),
    },
  );

  console.log(resultObj.object);

  let packagesToBuild: string[] = [];

  if (resultObj?.object?.packages) {
    const packages = resultObj.object.packages;
    const packagesMapped = packages.map((pkg: string) => {
      let pkgName = pkg.replace('@mastra/', '');

      if (pkgName === 'mastra') {
        pkgName = 'cli';
      }

      const pkgPath = path.join(process.cwd(), 'packages', pkgName);
      return pkgPath;
    });
    packagesToBuild = [...packagesMapped];
  }

  if (resultObj?.object?.integrations) {
    const integrations = resultObj.object.integrations;
    const integrationsMapped = integrations.map((integration: string) => {
      let pkgName = integration.replace('@mastra/', '');
      const integrationPath = path.join(process.cwd(), 'integrations', pkgName);
      return integrationPath;
    });
    packagesToBuild = [...packagesToBuild, ...integrationsMapped];
  }

  if (resultObj?.object?.danePackage) {
    const danePackage = resultObj.object.danePackage;
    let pkgName = danePackage.replace('@mastra/', '');
    const danePackageMapped = path.join(process.cwd(), 'examples', pkgName);
    packagesToBuild = [...packagesToBuild, danePackageMapped];
  }

  console.log(packagesToBuild);

  let res = await agent.generate(`
        Here are the packages that need to be built: ${packagesToBuild.join(',')}.
        We need to build core first. And dane last. The rest can be done in parallel.
    `);

  console.log(chalk.green(res.text));

  res = await agent.generate(`
        Publish the changeset with 'pnpm changest publish' and then set the dist-tag of latest to the new version.
    `);

  console.log(chalk.green(result.text));
}
