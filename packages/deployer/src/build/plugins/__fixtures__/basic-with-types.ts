import { Mastra } from '@mastra/core/mastra';
import type { Config } from '@mastra/core/mastra';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';
import { weatherAgent } from '@/agents';

interface ServerOptions {
  port: number;
  timeout?: number;
}

const server: ServerOptions = {
  port: 3000,
  timeout: 5000,
};

const deployer = new CloudflareDeployer({ projectName: 'my-app' }) as Config['deployer'];

export const mastra: Mastra = new Mastra({
  agents: { weatherAgent },
  server,
  deployer,
});
