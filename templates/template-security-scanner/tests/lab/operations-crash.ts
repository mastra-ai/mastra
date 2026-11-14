import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { z } from 'zod';
import { discoveryCase, startDiscoveryLab } from './harness.js';

/** Kill an active owned scan process and verify restart reconciliation and cleanup. */
export async function activeScanCrash() {
  const lab = await startDiscoveryLab({ processMode: true });
  const token = randomUUID(),
    volumeName = `crash-sentinel-${token}`;
  const network = await lab.client.createNetwork({
    Name: volumeName,
    Internal: true,
    Labels: { 'scanner-test-sentinel': token },
  });
  await lab.client.createVolume({ Name: volumeName, Labels: { 'scanner-test-sentinel': token } });
  const volume = lab.client.getVolume(volumeName);
  const consumer = await lab.client.createContainer({
    name: `crash-consumer-${token}`,
    Image: lab.images.firewall,
    Entrypoint: [],
    Cmd: ['sleep', 'infinity'],
    User: '10001:10001',
    Labels: { 'scanner-test-sentinel': token, 'dev.mastra.security-scanner.owner': 'unrelated-sentinel-owner' },
    HostConfig: {
      NetworkMode: network.id,
      LogConfig: { Type: 'none', Config: {} },
      Mounts: [{ Type: 'volume', Source: volumeName, Target: '/sentinel' }],
    },
  });
  try {
    await consumer.start();
    const beforeVolume = await volume.inspect();
    const selected = await discoveryCase(lab, { path: '/stream' });
    const before = await lab.stats();
    const admitted = await selected.admit();
    expect(admitted.status).toBe(202);
    const scanId = String(admitted.data.id);
    let active = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const stats = await lab.stats();
      if ((stats['stream-contacts'] ?? 0) > (before['stream-contacts'] ?? 0)) {
        active = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    expect(active).toBe(true);
    expect(
      (await lab.client.listContainers({ filters: { label: [`dev.mastra.security-scanner.scan=${scanId}`] } })).length,
    ).toBeGreaterThan(0);
    await lab.crashRestart();
    expect((await lab.request(`/api/scans/${scanId}`)).data).toMatchObject({
      state: 'FAILED',
      reason: 'PROCESS_INTERRUPTED',
      cleanup: 'COMPLETE',
      partial: true,
      budget: { exhausted: true, reason: 'unknown', remainingRequests: null, remainingBytes: null },
    });
    const stopped = await lab.stats();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(await lab.stats()).toEqual(stopped);
    const repeated = await lab.request(`/api/targets/${selected.target.id}/scans`, 'POST', admitted.request);
    expect(repeated.status).toBe(202);
    expect(repeated.data.id).toBe(scanId);
    expect(repeated.data.state).toBe('FAILED');
    expect(
      await lab.client.listContainers({
        all: true,
        filters: { label: [`dev.mastra.security-scanner.scan=${scanId}`] },
      }),
    ).toEqual([]);
    expect(
      await lab.client.listNetworks({ filters: { label: [`dev.mastra.security-scanner.scan=${scanId}`] } }),
    ).toEqual([]);
    expect((await consumer.inspect()).State.Running).toBe(true);
    expect((await consumer.inspect()).Config.Labels?.['dev.mastra.security-scanner.owner']).toBe(
      'unrelated-sentinel-owner',
    );
    expect((await network.inspect()).Id).toBe(network.id);
    const volumeIdentity = z.object({
      Name: z.string(),
      CreatedAt: z.string(),
      Labels: z.record(z.string(), z.string()),
    });
    expect(volumeIdentity.parse(await volume.inspect())).toEqual(volumeIdentity.parse(beforeVolume));
    expect((await lab.client.getImage(lab.images.firewall).inspect()).Id).toBe(lab.images.firewall);
  } finally {
    await consumer.remove({ force: true, v: false });
    await network.remove();
    await volume.remove();
  }
}
