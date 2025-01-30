import { Agent, Step, Workflow } from '@mastra/core';
import chalk from 'chalk';
import { existsSync } from 'fs';
import path from 'path';
import { z } from 'zod';

import { BUILD_PACKAGES_PROMPT, PACKAGES_LIST_PROMPT, PUBLISH_PACKAGES_PROMPT } from '../agents/package-publisher.js';

export const packagePublisher = new Workflow({
  name: 'pnpm-changset-publisher',
});

const outputSchema = z.object({
  packages: z.array(z.string()),
  integrations: z.array(z.string()),
  deployers: z.array(z.string()),
  vector_stores: z.array(z.string()),
  speech: z.array(z.string()),
});

const defaultSet = {
  packages: [],
  deployers: [],
  integrations: [],
  vector_stores: [],
  speech: [],
};

const getPacakgesToPublish = new Step({
  id: 'getPacakgesToPublish',
  outputSchema,
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
          speech: z.array(z.string()),
        }),
      },
    );

    return {
      packages: resultObj?.object?.packages!,
      integrations: resultObj?.object?.integrations!,
      deployers: resultObj?.object?.deployers!,
      vector_stores: resultObj?.object?.vector_stores!,
      speech: resultObj?.object?.speech!,
    };
  },
});

const assemblePackages = new Step({
  id: 'assemblePackages',
  outputSchema,
  execute: async ({ context }) => {
    if (context.machineContext?.stepResults.getPacakgesToPublish?.status !== 'success') {
      return {
        packages: [],
        integrations: [],
        deployers: [],
        vector_stores: [],
        speech: [],
      };
    }

    const payload = context.machineContext.stepResults.getPacakgesToPublish.payload;
    const packagesToBuild: Set<string> = new Set();
    const deployersToBuild: Set<string> = new Set();
    const integrationsToBuild: Set<string> = new Set();
    const vector_storesToBuild: Set<string> = new Set();
    const speechToBuild: Set<string> = new Set();

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
        deployersToBuild.add(pkgPath);
      });
    }

    if (payload?.vector_stores) {
      payload.vector_stores.forEach((pkg: string) => {
        let pkgName = pkg.replace('@mastra/vector-', '');

        const pkgPath = path.join(process.cwd(), 'vector-stores', pkgName);
        vector_storesToBuild.add(pkgPath);
      });
    }

    if (payload?.integrations) {
      const integrations = payload.integrations;
      integrations.forEach((integration: string) => {
        let pkgName = integration.replace('@mastra/', '');
        const integrationPath = path.join(process.cwd(), 'integrations', pkgName);

        integrationsToBuild.add(integrationPath);
      });
    }

    if (payload?.speech) {
      const speecs = payload.speech;
      speecs.forEach((speech: string) => {
        let pkgName = speech.replace('@mastra/speech-', '');
        const speechPath = path.join(process.cwd(), 'speech', pkgName);
        speechToBuild.add(speechPath);
      });
    }

    const pkgSet = Array.from(packagesToBuild.keys());
    const deploySet = Array.from(deployersToBuild.keys());
    const integrationSet = Array.from(integrationsToBuild.keys());
    const vectorStoreSet = Array.from(vector_storesToBuild.keys());
    const speechSet = Array.from(speechToBuild.keys());

    if (!packagesToBuild.size && !deployersToBuild.size && !integrationsToBuild.size && !vector_storesToBuild.size) {
      console.error(chalk.red('No packages to build.'));
      return defaultSet;
    }

    console.log(chalk.green(`\nBuilding packages:\n`));
    pkgSet.forEach((pkg: string) => {
      console.log(chalk.green(pkg));
    });

    if (deploySet.length > 0) {
      console.log(chalk.green(`\nBuilding deployers:\n`));
      deploySet.forEach((pkg: string) => {
        console.log(chalk.green(pkg));
      });
    }

    if (integrationSet.length > 0) {
      console.log(chalk.green(`\nBuilding integrations:\n`));
      integrationSet.forEach((pkg: string) => {
        console.log(chalk.green(pkg));
      });
    }

    if (vectorStoreSet.length > 0) {
      console.log(chalk.green(`\nBuilding vector stores:\n`));
      vectorStoreSet.forEach((pkg: string) => {
        console.log(chalk.green(pkg));
      });
    }

    if (speechSet.length > 0) {
      console.log(chalk.green(`\nBuilding speech:\n`));
      speechSet.forEach((pkg: string) => {
        console.log(chalk.green(pkg));
      });
    }

    return {
      packages: pkgSet!,
      deployers: deploySet!,
      integrations: integrationSet!,
      vector_stores: vectorStoreSet!,
      speech: speechSet!,
    };
  },
});

async function buildSet(agent: Agent, list: string[]) {
  let res = await agent.generate(BUILD_PACKAGES_PROMPT(list));

  console.log(chalk.green(res.text));
  return res.text;
}

const buildPackages = new Step({
  id: 'buildPackages',
  outputSchema,
  execute: async ({ context, mastra }) => {
    if (context.machineContext?.stepResults.assemblePackages?.status !== 'success') {
      return defaultSet;
    }

    const pkgSet = context.machineContext.stepResults.assemblePackages.payload.packages;
    const deploySet = context.machineContext.stepResults.assemblePackages.payload.deployers;
    const integrationSet = context.machineContext.stepResults.assemblePackages.payload.integrations;
    const vectorStoreSet = context.machineContext.stepResults.assemblePackages.payload.vector_stores;
    const speechSet = context.machineContext.stepResults.assemblePackages.payload.speech;

    const agent = mastra?.agents?.['danePackagePublisher'];

    if (!agent) {
      throw new Error('Agent not found');
    }

    let built = false;

    if (pkgSet.length > 0) {
      built = true;
      await buildSet(agent, pkgSet);
    }

    if (deploySet.length > 0) {
      await buildSet(agent, deploySet);
      built = true;
    }

    if (integrationSet.length > 0) {
      await buildSet(agent, integrationSet);
      built = true;
    }

    if (vectorStoreSet.length > 0) {
      await buildSet(agent, vectorStoreSet);
      built = true;
    }

    if (speechSet.length > 0) {
      await buildSet(agent, speechSet);
      built = true;
    }

    if (!built) {
      console.error(chalk.red('Failed to build one or more packages'));
      throw new Error('Failed to build one or more packages');
    }

    return {
      packages: pkgSet,
      deployers: deploySet,
      integrations: integrationSet,
      vector_stores: vectorStoreSet,
      speech: speechSet,
    };
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
    const deploySet = context.machineContext.stepResults.buildPackages.payload.deployers;
    const integrationSet = context.machineContext.stepResults.buildPackages.payload.integrations;
    const vectorStoreSet = context.machineContext.stepResults.buildPackages.payload.vector_stores;
    const speechSet = context.machineContext.stepResults.buildPackages.payload.speech;

    const allPackages = [...pkgSet, ...deploySet, ...integrationSet, ...vectorStoreSet, ...speechSet];

    function checkMissingPackages(pkgSet: string[]) {
      const missingPackages = [];

      for (const pkg of pkgSet) {
        if (!existsSync(`${pkg}/dist`)) {
          console.error(chalk.red(`We did not find the dist folder for ${pkg}.`));
          missingPackages.push(pkg);
        }
      }

      return missingPackages;
    }

    console.log('Verifying the output for:', context.machineContext.stepResults.buildPackages.payload.allPackages);

    const missingPackages = checkMissingPackages(allPackages);

    if (missingPackages.length > 0) {
      console.error(chalk.red(`Missing packages: ${missingPackages.join(', ')}`));
      throw new Error('Failed to build one or more packages');
    }

    return {
      packages: allPackages,
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
