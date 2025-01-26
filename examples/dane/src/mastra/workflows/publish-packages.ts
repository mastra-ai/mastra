import { Step, Workflow } from '@mastra/core';
import chalk from 'chalk';
import { existsSync } from 'fs';
import path from 'path';
import { z } from 'zod';

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

    const result = await agent.generate(`
        Please analyze the following monorepo directories and identify packages that need npm publishing:

        1. Directory Structure:
           - packages/      : Contains core modules (format: @mastra/{name})
           - integrations/ : Contains integration packages (format: @mastra/{name})
           - deployers/    : Contains deployer packages (format: @mastra/deployer-{name})
           - vector-stores/: Contains vector store packages (format: @mastra/vector-{name})

        2. Requirements:
           - Identify packages that have changes requiring a new pnpm publis
           - Include create-mastra in the packages list if changes exist
           - EXCLUDE @mastra/dane from consideration

        Please list all packages that need publishing, grouped by their directory.
    `);

    const resultObj = await agent.generate(
      `
      Please format the following package list according to these strict requirements:

      Input Text: ${result.text}

      1. Output Structure:
         - Return empty arrays if no publishable packages are found
         - Group packages into these arrays: packages[], integrations[], deployers[], vector_stores[]
      
      2. Package Ordering Rules (Strict Priority):
         a. Core Packages (in packages[]):
            1. @mastra/core MUST be first
            2. @mastra/deployer MUST be second
            3. mastra MUST be third
            4. create-mastra (if changes exist)
            5. All other packages from 'packages' directory
         
         b. Special Package Types:
            - deployers[]: All @mastra/deployer-{name} packages
            - vector_stores[]: All @mastra/vector-{name} packages
            - integrations[]: Remaining integration packages

      3. Critical Requirements:
         - ONLY include packages that need building
         - EXCLUDE any package not explicitly mentioned in the input text
         - ENSURE create-mastra is in packages[] array, not integrations[]
         - MAINTAIN specified order within packages[]
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

    console.log(resultObj.object);

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

        if (pkgName === 'mastra') {
          pkgName = 'cli';
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

    console.log(chalk.green(`Building packages:`));

    pkgSet.forEach((pkg: string) => {
      console.log(chalk.green(pkg));
    });

    let res = await agent.generate(`
      Here are the packages that need to be built: ${pkgSet.join(',')}.

      Please organize the build order following these strict requirements:

      1. Core Dependencies (Must be built in this exact order):
         - @mastra/core MUST be built first
         - @mastra/deployer MUST be built second
         - mastra MUST be built third

      2. Parallel Builds (After core dependencies):
         - Build all remaining packages in 'packages' directory in parallel
         - Build all packages in 'integrations' directory in parallel
         - Build all packages in 'deployers' directory in parallel
         - Build all packages in 'vector-stores' directory in parallel

      Note: Do not proceed to the next group until the current group is fully built.
    `);

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

    const pkgSet = context.machineContext.stepResults.buildPackages.payload.packages;

    for (const pkg of pkgSet) {
      if (!existsSync(`${pkg}/dist`)) {
        console.error(chalk.red(`Failed to build ${pkg}.`));
        throw new Error(`Failed to build ${pkg}.`);
      }
    }

    console.log(pkgSet);

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
    let res = await agent.generate(`
            Publish the changeset.
        `);

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
  .then(publishChangeset, {
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
