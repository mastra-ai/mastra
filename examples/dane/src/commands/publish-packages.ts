import chalk from 'chalk';
import { readFileSync } from 'fs';
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
        ONLY RETURN DATA IF WE HAVE PACKAGES TO PUBLISH. If we do not, return empty arrays.
        Can you format this for me ${result.text}? 
        @mastra/core must be first. @mastra/dane should be listed after packages and integrations.
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

  const packagesToBuild: Set<string> = new Set();

  if (resultObj?.object?.packages) {
    const packages = resultObj.object.packages;
    packages.forEach((pkg: string) => {
      let pkgName = pkg.replace('@mastra/', '');

      if (pkgName === 'mastra') {
        pkgName = 'cli';
      }

      const pkgPath = path.join(process.cwd(), 'packages', pkgName);
      packagesToBuild.add(pkgPath);
    });
  }

  if (resultObj?.object?.integrations) {
    const integrations = resultObj.object.integrations;
    integrations.forEach((integration: string) => {
      let pkgName = integration.replace('@mastra/', '');
      const integrationPath = path.join(process.cwd(), 'integrations', pkgName);

      packagesToBuild.add(integrationPath);
    });
  }

  if (resultObj?.object?.danePackage) {
    const danePackage = resultObj.object.danePackage;
    let pkgName = danePackage.replace('@mastra/', '');
    const danePackageMapped = path.join(process.cwd(), 'examples', pkgName);
    const pkgJsonPath = readFileSync(path.join(danePackageMapped, 'package.json'), 'utf-8');
    const pkgJson = JSON.parse(pkgJsonPath);
    const dependencies = Object.keys(pkgJson.dependencies || {}).filter((dep: string) => dep.startsWith('@mastra/'));
    dependencies.forEach((dep: string) => {
      const pkgName = dep.replace('@mastra/', '');
      const pkgPath = path.join(process.cwd(), 'packages', pkgName);
      packagesToBuild.add(pkgPath);
    });

    packagesToBuild.add(danePackage);
  }

  const pkgSet = Array.from(packagesToBuild.keys());

  if (!packagesToBuild.size) {
    console.error(chalk.red('No packages to build.'));
    process.exit(0);
  }

  let res = await agent.generate(`
        Here are the packages that need to be built: ${pkgSet.join(',')}.
        We need to build core first. And dane last. The rest can be done in parallel.
    `);

  console.log(chalk.green(res.text));

  res = await agent.generate(`
        Publish the changeset and then set the dist-tag of latest to the new version.
    `);

  console.log(chalk.green(result.text));
}
