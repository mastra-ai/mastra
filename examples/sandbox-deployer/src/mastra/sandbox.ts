import { E2BSandbox } from '@mastra/e2b';
import { VercelSandbox } from '@mastra/vercel';

// One place to define the sandbox identity. The Mastra entry uses it to
// deploy, and the lifecycle scripts use it to resolve the same deployment
// later. Switch providers with SANDBOX_PROVIDER=e2b (default: vercel).
export function createSandbox() {
  if (process.env.SANDBOX_PROVIDER === 'e2b') {
    return new E2BSandbox({
      id: 'mastra-sandbox-deployer-example',
      template: 'base',
      timeout: 30 * 60 * 1000, // pauses (resumable) on timeout
    });
  }
  return new VercelSandbox({
    sandboxName: 'mastra-sandbox-deployer-example',
    ports: [4111],
    timeout: 30 * 60 * 1000, // 30 minutes
  });
}
