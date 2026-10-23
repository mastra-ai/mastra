import { DockerSandbox } from './index';

const closeStdin = process.argv[2] === 'closed';
const sandbox = new DockerSandbox({
  id: `kill-helper-exit-${closeStdin ? 'closed' : 'open'}-${Date.now()}`,
  image: 'node:22-slim',
  timeout: 60000,
});

try {
  await sandbox.start();
  const handle = await sandbox.processes!.spawn(`node -e "setInterval(() => {}, 60000)"`);

  if (closeStdin) {
    await handle.closeStdin();
  }

  if (!(await handle.kill())) {
    throw new Error('Failed to kill spawned process');
  }

  await handle.wait();
} finally {
  await sandbox.destroy();
}
