import { Step, Workflow } from '@mastra/core/workflows';
import chalk from 'chalk';
import { execa } from 'execa';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import path from 'path';

// import { z } from 'zod';

// import { PACKAGES_LIST_PROMPT, /*PUBLISH_PACKAGES_PROMPT*/ } from '../agents/package-publisher.js';
// import { pnpmBuild } from '../tools/pnpm.js';

export const packagePublisher = new Workflow({
  name: 'pnpm-changset-publisher',
});

// const outputSchema = z.object({
//   packages: z.array(z.string()),
//   integrations: z.array(z.string()),
//   deployers: z.array(z.string()),
//   speech: z.array(z.string()),
//   // combined deprecated stores
//   combined_stores: z.array(z.string()),
// });

// const defaultSet = {
//   packages: [],
//   deployers: [],
//   integrations: [],
//   speech: [],
//   combined_stores: [],
// };

// const getPacakgesToPublish = new Step({
//   id: 'getPacakgesToPublish',
//   outputSchema,
//   execute: async ({ mastra }) => {
//     const agent = mastra?.agents?.['danePackagePublisher'];

//     if (!agent) {
//       throw new Error('Agent not found');
//     }

//     const result = await agent.generate(PACKAGES_LIST_PROMPT);

//     console.log(chalk.green(`\n${result.text}`));

//     const resultObj = await agent.generate(
//       `
//       Please convert this into a structured object:

//       Input Text: ${result.text}

//       1. Order Requirements:
//          - @mastra/core MUST be first within packages
//          - @mastra/deployer MUST be second within packages
//          - Group parallel builds by directory type

//       2. Output Format:
//          - Group into: packages[], integrations[], deployers[], combined_stores[]
//          - Place create-mastra in packages[] array
//          - Maintain correct order within each group

//       3. Critical Rules:
//          - Never publish without building first
//          - Only include packages that need updates
//          - Follow dependency order strictly
//     `,
//       {
//         output: z.object({
//           packages: z.array(z.string()),
//           integrations: z.array(z.string()),
//           deployers: z.array(z.string()),
//           combined_stores: z.array(z.string()),
//           speech: z.array(z.string()),
//         }),
//       },
//     );

//     return {
//       packages: resultObj?.object?.packages!,
//       integrations: resultObj?.object?.integrations!,
//       deployers: resultObj?.object?.deployers!,
//       combined_stores: resultObj?.object?.stores!,
//       speech: resultObj?.object?.speech!,
//     };
//   },
// });

// const assemblePackages = new Step({
//   id: 'assemblePackages',
//   outputSchema,
//   execute: async ({ context }) => {
//     if (context?.steps.getPacakgesToPublish?.status !== 'success') {
//       return {
//         packages: [],
//         integrations: [],
//         deployers: [],
//         combined_stores: [],
//         speech: [],
//       };
//     }

//     const payload = context.steps.getPacakgesToPublish.output;
//     const packagesToBuild: Set<string> = new Set();
//     const deployersToBuild: Set<string> = new Set();
//     const integrationsToBuild: Set<string> = new Set();
//     const combined_storesToBuild: Set<string> = new Set();
//     const speechToBuild: Set<string> = new Set();

//     if (payload?.packages) {
//       payload.packages.forEach((pkg: string) => {
//         let pkgName = pkg.replace('@mastra/', '');

//         if (pkgName === 'mastra') {
//           pkgName = 'cli';
//         }

//         const pkgPath = path.join(process.cwd(), 'packages', pkgName);
//         packagesToBuild.add(pkgPath);
//       });
//     }

//     if (payload?.deployers) {
//       payload.deployers.forEach((pkg: string) => {
//         let pkgName = pkg.replace('@mastra/deployer-', '');

//         if (pkgName === 'mastra') {
//           pkgName = 'cli';
//         }

//         const pkgPath = path.join(process.cwd(), 'deployers', pkgName);
//         deployersToBuild.add(pkgPath);
//       });
//     }

//     if (payload?.combined_stores) {
//       payload.combined_stores.forEach((pkg: string) => {
//         let pkgName = pkg.replace('@mastra/', '');

//         const pkgPath = path.join(process.cwd(), 'stores', pkgName);
//         combined_storesToBuild.add(pkgPath);
//       });
//     }

//     if (payload?.integrations) {
//       const integrations = payload.integrations;
//       integrations.forEach((integration: string) => {
//         let pkgName = integration.replace('@mastra/', '');
//         const integrationPath = path.join(process.cwd(), 'integrations', pkgName);

//         integrationsToBuild.add(integrationPath);
//       });
//     }

//     if (payload?.speech) {
//       const speecs = payload.speech;
//       speecs.forEach((speech: string) => {
//         let pkgName = speech.replace('@mastra/speech-', '');
//         const speechPath = path.join(process.cwd(), 'speech', pkgName);
//         speechToBuild.add(speechPath);
//       });
//     }

//     const pkgSet = Array.from(packagesToBuild.keys());
//     const deploySet = Array.from(deployersToBuild.keys());
//     const integrationSet = Array.from(integrationsToBuild.keys());
//     const combinedStoreSet = Array.from(combined_storesToBuild.keys());
//     const speechSet = Array.from(speechToBuild.keys());

//     if (
//       !packagesToBuild.size &&
//       !deployersToBuild.size &&
//       !integrationsToBuild.size &&
//       !combined_storesToBuild.size
//     ) {
//       console.error(chalk.red('No packages to build.'));
//       return defaultSet;
//     }

//     console.log(chalk.green(`\nBuilding packages:\n`));
//     pkgSet.forEach((pkg: string) => {
//       console.log(chalk.green(pkg));
//     });

//     if (deploySet.length > 0) {
//       console.log(chalk.green(`\nBuilding deployers:\n`));
//       deploySet.forEach((pkg: string) => {
//         console.log(chalk.green(pkg));
//       });
//     }

//     if (integrationSet.length > 0) {
//       console.log(chalk.green(`\nBuilding integrations:\n`));
//       integrationSet.forEach((pkg: string) => {
//         console.log(chalk.green(pkg));
//       });
//     }

//     if (combinedStoreSet.length > 0) {
//       console.log(chalk.green(`\nBuilding store packages:\n`));
//       combinedStoreSet.forEach((pkg: string) => {
//         console.log(chalk.green(pkg));
//       });
//     }

//     if (speechSet.length > 0) {
//       console.log(chalk.green(`\nBuilding speech:\n`));
//       speechSet.forEach((pkg: string) => {
//         console.log(chalk.green(pkg));
//       });
//     }

//     return {
//       packages: pkgSet!,
//       deployers: deploySet!,
//       integrations: integrationSet!,
//       combined_stores: combinedStoreSet!,
//       speech: speechSet!,
//     };
//   },
// });

const buildAllPackages = new Step({
  id: 'buildPackages',
  execute: async () => {
    console.log(chalk.green('Building all packages'));
    await execa('pnpm', ['run', 'build'], {
      stdio: 'inherit',
      reject: false,
      cwd: process.cwd(),
    });
  },
});

const publishAllPackages = new Step({
  id: 'publishPackages',
  execute: async () => {
    console.log(chalk.green('Publishing all packages'));
    await execa('pnpm', ['changeset', 'publish'], {
      stdio: 'inherit',
      reject: false,
      cwd: process.cwd(),
    });
  },
});

const setAllDistTags = new Step({
  id: 'setAllDistTags',
  execute: async () => {
    console.log(chalk.green('Setting dist tags for all packages'));

    // Get all package.json files from relevant directories
    const packageDirs = ['packages', 'deployers', 'storage', 'vector-stores', 'stores', 'integrations', 'speech'];
    const packages = [];

    for (const dir of packageDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (!existsSync(dirPath)) continue;

      const { stdout } = await execa('find', [dirPath, '-name', 'package.json'], {
        reject: false,
      });

      const packagePaths = stdout.split('\n').filter(Boolean);
      for (const packagePath of packagePaths) {
        const pkgJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        if (pkgJson.name && pkgJson.version) {
          packages.push({
            name: pkgJson.name,
            version: pkgJson.version,
            path: path.dirname(packagePath),
          });
        }
      }
    }

    console.log(packages);

    // Set dist tags for each package
    for (const pkg of packages) {
      console.log(chalk.blue(`Setting dist tag for ${pkg.name}@${pkg.version}`));
      try {
        await execa('npm', ['dist-tag', 'add', `${pkg.name}@${pkg.version}`, 'latest'], {
          stdio: 'inherit',
          cwd: pkg.path,
          reject: false,
        });
      } catch (error: any) {
        console.error(chalk.red(`Failed to set dist tag for ${pkg.name}: ${error.message}`));
      }
    }
  },
});

packagePublisher.step(buildAllPackages).then(publishAllPackages).then(setAllDistTags).commit();
