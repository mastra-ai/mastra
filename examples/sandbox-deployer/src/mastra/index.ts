import { Mastra } from '@mastra/core/mastra';
import { SandboxDeployer } from '@mastra/deployer-sandbox';
import { diceAgent } from './agents/dice-agent';
import { createSandbox } from './sandbox';

// Deploy the built server into an ephemeral sandbox microVM. The sandbox
// name/id gives it a stable identity: redeploys reuse it and skip dependency
// installs when package.json is unchanged. Any other process (scripts, a
// Next.js route, CI) can retrieve the deployment with the same identity via
// `getDeployment()` from `@mastra/deployer-sandbox/client`.
// Pick the provider with SANDBOX_PROVIDER=vercel (default) or e2b.
export const mastra = new Mastra({
  agents: { diceAgent },
  deployer: new SandboxDeployer({
    sandbox: createSandbox(),
    env: process.env.OPENAI_API_KEY ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY } : {},
  }),
});
