// Permanently delete the deployed sandbox and its snapshots. Works from any
// codebase — tearing down a stopped sandbox never wakes (or bills) it first.
import { getDeployment } from '@mastra/deployer-sandbox/client';
import { createSandbox } from '../src/mastra/sandbox';

const dep = await getDeployment({ sandbox: createSandbox(), port: 4111 });
console.log('status:', dep.status, 'url:', dep.url);
await dep.destroy();
console.log('destroyed');
