import { DaytonaSandbox } from '@mastra/daytona';
import { E2BSandbox } from '@mastra/e2b';
import { VercelSandbox } from '@mastra/vercel';

// One place to define the sandbox identity. The Mastra entry uses it to
// deploy, and the lifecycle scripts use it to resolve the same deployment
// later. Switch providers with SANDBOX_PROVIDER=e2b|daytona (default: vercel).
export function createSandbox() {
  const provider = process.env.SANDBOX_PROVIDER ?? 'vercel';
  if (!['vercel', 'e2b', 'daytona'].includes(provider)) {
    throw new Error(`Unknown SANDBOX_PROVIDER "${provider}" — expected vercel, e2b, or daytona.`);
  }
  if (provider === 'e2b') {
    return new E2BSandbox({
      id: 'mastra-sandbox-deployer-example',
      template: 'base',
      timeout: 30 * 60 * 1000, // pauses (resumable) on timeout
    });
  }
  if (provider === 'daytona') {
    return new DaytonaSandbox({
      id: 'mastra-sandbox-deployer-example',
      public: true, // tokenless preview URLs
      autoStopInterval: 30, // minutes
    });
  }
  return new VercelSandbox({
    sandboxName: 'mastra-sandbox-deployer-example',
    ports: [4111],
    timeout: 30 * 60 * 1000, // 30 minutes
  });
}
