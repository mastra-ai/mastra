import { createTool } from '@mastra/core';
import chalk from 'chalk';
import { execa, ExecaError } from 'execa';
import { Transform } from 'stream';
import { z } from 'zod';

// Create transform stream that applies chalk
const colorTransform = new Transform({
  transform(chunk, _encoding, callback) {
    // Convert chunk to string and apply chalk
    const colored = chalk.blue(chunk.toString());
    this.push(colored);
    callback();
  },
});

export const execaTool = createTool({
  id: 'execaTool',
  name: 'Execa System Tool',
  description: 'Execa System Tool',
  inputSchema: z.object({
    command: z.string(),
    args: z.array(z.string()),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context: { command, args } }) => {
    try {
      console.log(chalk.green(`Running command: ${command} ${args.join(' ')}`));
      const p = execa(command, args);
      console.log(`\n`);
      p.stdout.pipe(colorTransform).pipe(process.stdout);
      p.stderr.pipe(colorTransform).pipe(process.stderr);
      const r = await p;

      return { message: r.stdout };
    } catch (e) {
      if (e instanceof ExecaError) {
        return { message: e.message };
      }
      return { message: 'Error' };
    }
  },
});

export const pnpmBuild = createTool({
  id: 'pnpmBuild',
  name: 'PNPM Build Tool',
  description: 'Used to build the pnpm module',
  inputSchema: z.object({
    name: z.string(),
    packagePath: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context: { name, packagePath } }) => {
    try {
      console.log(chalk.green(`Building: ${name} at ${packagePath}`));
      const p = execa(`pnpm`, ['build'], {
        stdio: 'inherit',
        cwd: packagePath,
        reject: false,
      });
      console.log(`\n`);
      await p;
      return { message: 'Done' };
    } catch (e) {
      console.error(e);
      if (e instanceof ExecaError) {
        return { message: e.message };
      }
      return { message: 'Error' };
    }
  },
});

export const pnpmChangesetPublish = createTool({
  id: 'pnpmChangesetPublish',
  name: 'PNPM Changeset Publish Tool',
  description: 'Used to publish the pnpm module',
  inputSchema: z.object({}),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async () => {
    try {
      console.log(chalk.green(`Publishing...`));
      const p = execa(`pnpm`, ['changeset', 'publish'], {
        stdio: 'inherit',
        reject: false,
      });
      console.log(`\n`);
      await p;
      return { message: 'Done' };
    } catch (e) {
      console.error(e);
      if (e instanceof ExecaError) {
        return { message: e.message };
      }
      return { message: 'Error' };
    }
  },
});
