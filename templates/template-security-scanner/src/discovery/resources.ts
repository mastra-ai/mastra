import type Docker from 'dockerode';
import { randomUUID } from 'node:crypto';
import type { Settings } from '../config/settings.js';
import { dockerClient, ownerIdentity, OWNER_LABEL, INPUT_LABEL } from '../runtime/docker.js';
import { DiscoveryStore, type OwnedResource } from './store.js';

export const SCAN_LABEL = 'dev.mastra.security-scanner.scan';
export const RESOURCE_LABEL = 'dev.mastra.security-scanner.resource';
export class ScanResources {
  readonly client: Docker;
  constructor(
    private readonly settings: Settings,
    private readonly store: DiscoveryStore,
    readonly scanId: string,
  ) {
    this.client = dockerClient(settings);
  }
  async intent(kind: Exclude<OwnedResource['kind'], 'image'>, imageId?: string) {
    const token = randomUUID(),
      name = `scanner-${kind}-${token}`;
    const resource: OwnedResource = { id: name, scanId: this.scanId, token, kind, ...(imageId ? { imageId } : {}) };
    await this.store.remember(resource);
    return {
      resource,
      name,
      labels: { [OWNER_LABEL]: ownerIdentity(this.settings), [SCAN_LABEL]: this.scanId, [RESOURCE_LABEL]: token },
    };
  }
  async container(options: Docker.ContainerCreateOptions, imageId: string) {
    const intent = await this.intent('container', imageId);
    const container = await this.client.createContainer({
      ...options,
      Image: imageId,
      name: intent.name,
      Labels: { ...options.Labels, ...intent.labels },
    });
    return { container, resource: intent.resource };
  }
  async network(internal: boolean) {
    const intent = await this.intent('network');
    const network = await this.client.createNetwork({
      Name: intent.name,
      Internal: internal,
      Driver: 'bridge',
      Labels: intent.labels,
    });
    const observed = await network.inspect();
    const subnet = observed.IPAM?.Config?.[0]?.Subnet;
    if (!subnet || !/^\d+\.\d+\.\d+\.0\/\d+$/.test(subnet)) throw new Error('NETWORK_ADDRESS_UNSUPPORTED');
    const prefix = subnet.slice(0, subnet.indexOf('/')).split('.').slice(0, 3).join('.');
    return { network, name: intent.name, address: (host: number) => `${prefix}.${host}`, resource: intent.resource };
  }
  async verify(resource: OwnedResource) {
    if (resource.kind === 'image') {
      const image = await this.client.getImage(resource.imageId ?? resource.id).inspect();
      if (
        image.Id !== (resource.imageId ?? resource.id) ||
        image.Config.Labels?.[OWNER_LABEL] !== ownerIdentity(this.settings) ||
        image.Config.Labels?.[INPUT_LABEL] !== resource.token
      )
        throw new Error('RESOURCE_OWNERSHIP_CHANGED');
      return image;
    }
    const observed =
      resource.kind === 'container'
        ? await this.client.getContainer(resource.id).inspect()
        : await this.client.getNetwork(resource.id).inspect();
    const labels = 'Config' in observed ? observed.Config.Labels : observed.Labels;
    if (
      labels?.[OWNER_LABEL] !== ownerIdentity(this.settings) ||
      labels?.[SCAN_LABEL] !== resource.scanId ||
      labels?.[RESOURCE_LABEL] !== resource.token ||
      ('Config' in observed && observed.Image !== resource.imageId)
    )
      throw new Error('RESOURCE_OWNERSHIP_CHANGED');
    return observed;
  }
  async stop(resource: OwnedResource) {
    const observed = await this.verify(resource);
    if ('State' in observed && observed.State.Running) {
      await this.client.getContainer(resource.id).kill({ signal: 'SIGKILL' });
      await this.client.getContainer(resource.id).wait();
    }
  }
  async cleanup(retainImageRecords = false) {
    let complete = true;
    for (const resource of (await this.store.resources(this.scanId)).reverse()) {
      try {
        await this.verify(resource);
        if (resource.kind === 'image' && retainImageRecords) continue;
        if (resource.kind === 'container') await this.client.getContainer(resource.id).remove({ force: true, v: true });
        else if (resource.kind === 'network') await this.client.getNetwork(resource.id).remove();
        else if (
          !(await this.client.listContainers({ all: true, filters: { ancestor: [resource.imageId ?? resource.id] } }))
            .length
        )
          await this.client.getImage(resource.imageId ?? resource.id).remove({ force: false, noprune: true });
        await this.store.forget(resource.id);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 404) await this.store.forget(resource.id);
        else complete = false;
      }
    }
    return complete;
  }
}
export async function reconcileScans(settings: Settings, store: DiscoveryStore) {
  // Instance ownership must already be held before this function is called.
  for (const scan of await store.interrupted()) {
    const complete = await new ScanResources(settings, store, scan.id).cleanup();
    await store.update(scan.id, scan.owner, current => ({
      ...current,
      state:
        current.cleanup === 'DEBT' && ['FAILED', 'AUTH_REQUIRED'].includes(current.state) ? current.state : 'FAILED',
      reason: complete ? 'PROCESS_INTERRUPTED' : 'CLEANUP_FAILED',
      partial: true,
      cleanup: complete ? 'COMPLETE' : 'DEBT',
      budget: { remainingRequests: null, remainingBytes: null, exhausted: true, reason: 'unknown' },
    }));
  }
}
