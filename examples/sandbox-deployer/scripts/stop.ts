// Snapshot-stop the deployed sandbox. The filesystem persists and the next
// `mastra build` (or a wake) resumes it. Works from any codebase — the
// sandbox name is the identity, so all you need is the provider + name.
import { getDeployment } from '@mastra/deployer-sandbox/client';
import { createSandbox } from '../src/mastra/sandbox';

const dep = await getDeployment({ sandbox: createSandbox(), port: 4111 });
console.log('status:', dep.status, 'url:', dep.url);
await dep.stop();
console.log('stopped');
