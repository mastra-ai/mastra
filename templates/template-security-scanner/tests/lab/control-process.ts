import { z } from 'zod';
import { loadSettings } from '../../src/config/settings.js';
import { dockerClient } from '../../src/runtime/docker.js';
import { ownedLabBoundary } from '../../src/discovery/lab.js';
import { startControlPlane } from '../../src/http/server.js';

const inputSchema = z
  .object({
    root: z.string(),
    environment: z.record(z.string(), z.string()),
    fixtureId: z.string(),
    networkId: z.string(),
    token: z.uuid(),
    ca: z.string(),
  })
  .strict();
let running: Awaited<ReturnType<typeof startControlPlane>> | undefined;
process.on('message', async input => {
  try {
    if (input === 'close') {
      await running?.close();
      process.disconnect();
      process.exit(0);
    }
    if (running) throw new Error('PROCESS_ALREADY_RUNNING');
    const config = inputSchema.parse(input),
      settings = loadSettings(config.environment, config.root);
    const boundary = await ownedLabBoundary(
      dockerClient(settings),
      config.fixtureId,
      config.networkId,
      config.token,
      Buffer.from(config.ca, 'base64'),
    );
    running = await startControlPlane(settings, 0, undefined, boundary);
    process.send?.({ url: running.url });
  } catch {
    process.send?.({ error: 'CONTROL_PROCESS_UNAVAILABLE' });
    process.exitCode = 1;
    process.disconnect();
  }
});
