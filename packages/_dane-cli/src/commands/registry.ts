import fs from 'node:fs';
import path from 'node:path';
import * as clack from '@clack/prompts';
import { defineCommand } from 'citty';
import { runServer } from 'verdaccio';

export const DEFAULT_REGISTRY_PORT = 4873;
export const DEFAULT_REGISTRY_URL = `http://localhost:${DEFAULT_REGISTRY_PORT}`;
const DEFAULT_STORAGE_PATH = './.verdaccio-storage';

function getVerdaccioConfig(storagePath: string) {
  return {
    storage: path.resolve(storagePath),
    uplinks: {
      npmjs: {
        url: 'https://registry.npmjs.org/',
        cache: true,
      },
    },
    packages: {
      '@mastra/*': {
        access: '$anonymous',
        publish: '$anonymous',
        unpublish: '$anonymous',
      },
      mastra: {
        access: '$anonymous',
        publish: '$anonymous',
        unpublish: '$anonymous',
      },
      '**': {
        access: '$anonymous',
        publish: '$anonymous',
        proxy: 'npmjs',
      },
    },
    auth: {
      htpasswd: {
        file: './htpasswd',
        max_users: -1,
      },
    },
    server: {
      keepAliveTimeout: 60,
    },
    middlewares: {
      audit: {
        enabled: false,
      },
    },
    log: {
      type: 'stdout',
      format: 'pretty',
      level: 'warn',
    },
    self_path: './',
    security: {
      api: {
        legacy: true,
      },
    },
    web: {
      enable: true,
    },
  };
}

export const registryCommand = defineCommand({
  meta: {
    name: 'registry',
    description: 'Start a local Verdaccio npm registry server',
  },
  args: {
    port: {
      type: 'string',
      description: 'Port to run the registry on',
      default: String(DEFAULT_REGISTRY_PORT),
    },
    storage: {
      type: 'string',
      description: 'Path to storage directory',
      default: process.env.VERDACCIO_STORAGE_PATH ?? DEFAULT_STORAGE_PATH,
    },
  },
  async run({ args }) {
    clack.intro('Local NPM Registry');

    const port = parseInt(args.port, 10);
    const storagePath = args.storage;

    // Ensure storage directory exists
    const absoluteStoragePath = path.resolve(storagePath);
    if (!fs.existsSync(absoluteStoragePath)) {
      fs.mkdirSync(absoluteStoragePath, { recursive: true });
      clack.log.info(`Created storage directory: ${absoluteStoragePath}`);
    }

    const config = getVerdaccioConfig(storagePath);

    clack.log.info(`Storage path: ${absoluteStoragePath}`);
    clack.log.info(`Starting registry on port ${port}...`);

    try {
      const app = await runServer(config as any);

      app.listen(port, () => {
        clack.log.success(`Registry running at http://localhost:${port}`);
        clack.log.info(`To use this registry:`);
        clack.log.step(`  npm set registry http://localhost:${port}`);
        clack.log.step(`  pnpm set registry http://localhost:${port}`);
        clack.log.info(`Or publish directly:`);
        clack.log.step(`  npm publish --registry http://localhost:${port}`);
        clack.log.info(`Press Ctrl+C to stop the server`);
      });
    } catch (err) {
      clack.log.error(err instanceof Error ? err.message : String(err));
      clack.outro('Failed to start registry');
      process.exit(1);
    }
  },
});
