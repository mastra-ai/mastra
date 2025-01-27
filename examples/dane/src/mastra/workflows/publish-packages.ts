import { Step, Workflow } from '@mastra/core';
import chalk from 'chalk';
import { existsSync } from 'fs';
import path from 'path';
import { z } from 'zod';

import { BUILD_PACKAGES_PROMPT, PACKAGES_LIST_PROMPT, PUBLISH_PACKAGES_PROMPT } from '../agents/package-publisher.js';

export const packagePublisher = new Workflow({
  name: 'pnpm-changset-publisher',
});

const getPacakgesToPublish = new Step({
  id: 'getPacakgesToPublish',
  outputSchema: z.object({
    packages: z.array(z.string()),
    integrations: z.array(z.string()),
    deployers: z.array(z.string()),
    vector_stores: z.array(z.string()),
  }),
  execute: async ({ mastra }) => {
    const agent = mastra?.agents?.['danePackagePublisher'];

    if (!agent) {
      throw new Error('Agent not found');
    }

    const result = await agent.generate(PACKAGES_LIST_PROMPT);

    console.log(chalk.green(`\n${result.text}`));

    const resultObj = await agent.generate(
      `
      Please convert this into a structured object:

      Input Text: ${result.text}

      1. Order Requirements:
         - @mastra/core MUST be first within packages
         - @mastra/deployer MUST be second within packages
         - Group parallel builds by directory type

      2. Output Format:
         - Group into: packages[], integrations[], deployers[], vector_stores[]
         - Place create-mastra in packages[] array
         - Maintain correct order within each group

      3. Critical Rules:
         - Never publish without building first
         - Only include packages that need updates
         - Follow dependency order strictly
    `,
      {
        output: z.object({
          packages: z.array(z.string()),
          integrations: z.array(z.string()),
          deployers: z.array(z.string()),
          vector_stores: z.array(z.string()),
        }),
      },
    );

    return {
      packages: resultObj?.object?.packages!,
      integrations: resultObj?.object?.integrations!,
      deployers: resultObj?.object?.deployers!,
      vector_stores: resultObj?.object?.vector_stores!,
    };
  },
});

const assemblePackages = new Step({
  id: 'assemblePackages',
  outputSchema: z.object({
    packages: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    if (context.machineContext?.stepResults.getPacakgesToPublish?.status !== 'success') {
      return {
        packages: [],
      };
    }

    const payload = context.machineContext.stepResults.getPacakgesToPublish.payload;
    const packagesToBuild: Set<string> = new Set();

    if (payload?.packages) {
      payload.packages.forEach((pkg: string) => {
        let pkgName = pkg.replace('@mastra/', '');

        if (pkgName === 'mastra') {
          pkgName = 'cli';
        }

        const pkgPath = path.join(process.cwd(), 'packages', pkgName);
        packagesToBuild.add(pkgPath);
      });
    }

    if (payload?.deployers) {
      payload.deployers.forEach((pkg: string) => {
        let pkgName = pkg.replace('@mastra/deployer-', '');

        if (pkgName === 'mastra') {
          pkgName = 'cli';
        }

        const pkgPath = path.join(process.cwd(), 'deployers', pkgName);
        packagesToBuild.add(pkgPath);
      });
    }

    if (payload?.vector_stores) {
      payload.vector_stores.forEach((pkg: string) => {
        let pkgName = pkg.replace('@mastra/vector-', '');

        if (pkgName === 'astra') {
          pkgName = 'astra-db';
        }

        const pkgPath = path.join(process.cwd(), 'vector-stores', pkgName);
        packagesToBuild.add(pkgPath);
      });
    }

    if (payload?.integrations) {
      const integrations = payload.integrations;
      integrations.forEach((integration: string) => {
        let pkgName = integration.replace('@mastra/', '');
        const integrationPath = path.join(process.cwd(), 'integrations', pkgName);

        packagesToBuild.add(integrationPath);
      });
    }

    const pkgSet = Array.from(packagesToBuild.keys());

    if (!packagesToBuild.size) {
      console.error(chalk.red('No packages to build.'));
      return {
        packages: [],
      };
    }

    console.log(chalk.green(`\nBuilding packages:\n`));
    pkgSet.forEach((pkg: string) => {
      console.log(chalk.green(pkg));
    });

    return { packages: pkgSet };
  },
});

const buildPackages = new Step({
  id: 'buildPackages',
  outputSchema: z.object({
    packages: z.array(z.string()),
  }),
  execute: async ({ context, mastra }) => {
    if (context.machineContext?.stepResults.assemblePackages?.status !== 'success') {
      return {
        packages: [],
      };
    }

    const pkgSet = context.machineContext.stepResults.assemblePackages.payload.packages;

    const agent = mastra?.agents?.['danePackagePublisher'];

    if (!agent) {
      throw new Error('Agent not found');
    }

    let res = await agent.generate(BUILD_PACKAGES_PROMPT(pkgSet));

    console.log(chalk.green(res.text));

    return { packages: pkgSet };
  },
});

const verifyBuild = new Step({
  id: 'verifyBuild',
  outputSchema: z.object({
    packages: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    if (context.machineContext?.stepResults.buildPackages?.status !== 'success') {
      return {
        packages: [],
      };
    }

    console.log('Verifying the output for:', context.machineContext.stepResults.buildPackages.payload.packages);

    const pkgSet = context.machineContext.stepResults.buildPackages.payload.packages;

    for (const pkg of pkgSet) {
      if (!existsSync(`${pkg}/dist`)) {
        console.error(chalk.red(`Failed to build ${pkg}.`));
        throw new Error(`Failed to build ${pkg}.`);
      }
    }

    return {
      packages: pkgSet,
    };
  },
});

const publishChangeset = new Step({
  id: 'publishChangeset',
  outputSchema: z.object({
    packages: z.array(z.string()),
  }),
  execute: async ({ context, mastra }) => {
    if (context.machineContext?.stepResults.buildPackages?.status !== 'success') {
      return {
        packages: [],
      };
    }

    const pkgSet = context.machineContext.stepResults.buildPackages.payload.packages;

    const agent = mastra?.agents?.['danePackagePublisher'];

    if (!agent) {
      throw new Error('Agent not found');
    }

    const res = await agent.generate(PUBLISH_PACKAGES_PROMPT);

    console.log(chalk.green(res.text));

    return { packages: pkgSet };
  },
});

const setLatestDistTag = new Step({
  id: 'setLatestDistTag',
  outputSchema: z.object({
    packages: z.array(z.string()),
  }),
  execute: async ({ context, mastra }) => {
    if (context.machineContext?.stepResults.publishChangeset?.status !== 'success') {
      return {
        packages: [],
      };
    }

    const pkgSet = context.machineContext.stepResults.publishChangeset.payload.packages;

    const agent = mastra?.agents?.['danePackagePublisher'];

    if (!agent) {
      throw new Error('Agent not found');
    }

    let res = await agent.generate(`
            Set the active tag for these packages ${pkgSet.join(',')}.
        `);

    console.log(chalk.green(res.text));

    return { packages: pkgSet };
  },
});

packagePublisher
  .step(getPacakgesToPublish)
  .then(assemblePackages)
  .then(buildPackages, {
    when: async ({ context }) => {
      return (
        context.stepResults.assemblePackages?.status === 'success' &&
        context.stepResults.assemblePackages?.payload?.packages.length > 0
      );
    },
  })
  .then(verifyBuild, {
    when: async ({ context }) => {
      return (
        context.stepResults.buildPackages?.status === 'success' &&
        context.stepResults.buildPackages?.payload?.packages.length > 0
      );
    },
  })
  .after(verifyBuild)
  .step(publishChangeset, {
    when: async ({ context }) => {
      return (
        context.stepResults.buildPackages?.status === 'success' &&
        context.stepResults.buildPackages?.payload?.packages.length > 0
      );
    },
  })
  .then(setLatestDistTag, {
    when: async ({ context }) => {
      return (
        context.stepResults.publishChangeset?.status === 'success' &&
        context.stepResults.publishChangeset?.payload?.packages.length > 0
      );
    },
  })
  .commit();
