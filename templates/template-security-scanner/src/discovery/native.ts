import type Docker from 'dockerode';
import { sandboxOptions } from '../runtime/sandbox.js';
import { DockerSandbox } from '@mastra/docker';
import { inspectAppliedPolicy } from '../runtime/seccomp.js';

// Reconnect is a supported provider API. Precreation adds a missing logging
// control without changing the reviewed runtime's requested isolation options.
/** Create native sandbox access restricted to the validated owned runtime boundary. */
export async function privateNativeSandbox(
  client: Docker,
  options: Omit<ReturnType<typeof sandboxOptions>, 'labels'> & { labels: Record<string, string> },
) {
  const image = await client.getImage(options.image).inspect();
  const container = await client.createContainer({
    name: options.name,
    Image: options.image,
    Cmd: options.command,
    WorkingDir: options.workingDirectory,
    Labels: {
      ...options.labels,
      'mastra.sandbox': 'true',
      'mastra.sandbox.id': options.id,
    },
    OpenStdin: true,
    Tty: false,
    HostConfig: {
      NetworkMode: options.network,
      Privileged: options.privileged,
      Memory: options.memory,
      MemorySwap: options.memorySwap,
      CpuQuota: options.cpuQuota,
      CpuPeriod: options.cpuPeriod,
      PidsLimit: options.pidsLimit,
      Init: options.init,
      ReadonlyRootfs: options.readonlyRootfs,
      CapDrop: options.capDrop,
      SecurityOpt: options.securityOpt,
      Ulimits: options.ulimits?.map(limit => ({
        Name: limit.name,
        Soft: limit.soft,
        Hard: limit.hard,
      })),
      Tmpfs: options.tmpfs,
      LogConfig: { Type: 'none', Config: {} },
    },
  });
  try {
    /** Normalize observed arrays and objects for deterministic sandbox-boundary comparisons. */
    const canonical = (value: unknown): string => {
      if (Array.isArray(value)) return JSON.stringify(value.map(canonical).sort());
      if (value && typeof value === 'object') {
        return JSON.stringify(Object.fromEntries(Object.entries(value).sort()));
      }
      return JSON.stringify(value);
    };
    /** Validate actual container identity and security settings against the owned sandbox boundary. */
    const assertBoundary = async (running: boolean) => {
      const matches = await client.listContainers({
        all: true,
        filters: { label: [`mastra.sandbox.id=${options.id}`] },
      });
      const inspection = await container.inspect();
      const host = inspection.HostConfig;
      const expectedLabels = {
        ...image.Config.Labels,
        ...options.labels,
        'mastra.sandbox': 'true',
        'mastra.sandbox.id': options.id,
      };
      const seccompSha256 = inspectAppliedPolicy(host.SecurityOpt);
      const expectedUlimits = options.ulimits.map(limit => ({
        Name: limit.name,
        Soft: limit.soft,
        Hard: limit.hard,
      }));
      const noNewPrivileges =
        host.SecurityOpt.filter((entry: string) => /^no-new-privileges[:=]true$/.test(entry)).length === 1;
      if (
        matches.length !== 1 ||
        matches[0]?.Id !== container.id ||
        inspection.Id !== container.id ||
        inspection.Image !== image.Id ||
        inspection.State.Running !== running ||
        inspection.Config.User !== '10001:10001' ||
        canonical(inspection.Config.Labels) !== canonical(expectedLabels) ||
        canonical(inspection.Config.Env) !== canonical(image.Config.Env) ||
        canonical(inspection.Config.Cmd) !== canonical(options.command) ||
        canonical(inspection.Config.Entrypoint ?? []) !== canonical(image.Config.Entrypoint ?? []) ||
        inspection.Config.WorkingDir !== options.workingDirectory ||
        host.LogConfig?.Type !== 'none' ||
        host.Privileged ||
        canonical(host.CapDrop) !== canonical(['ALL']) ||
        (host.CapAdd ?? []).length !== 0 ||
        !noNewPrivileges ||
        host.SecurityOpt.length !== 2 ||
        host.NetworkMode !== options.network ||
        host.Memory !== options.memory ||
        host.MemorySwap !== options.memorySwap ||
        host.CpuQuota !== options.cpuQuota ||
        host.CpuPeriod !== options.cpuPeriod ||
        host.PidsLimit !== options.pidsLimit ||
        host.Init !== options.init ||
        host.ReadonlyRootfs !== options.readonlyRootfs ||
        canonical(host.Ulimits) !== canonical(expectedUlimits) ||
        canonical(host.Tmpfs) !== canonical(options.tmpfs) ||
        (host.Binds ?? []).length !== 0 ||
        (host.Mounts ?? []).length !== 0 ||
        inspection.Mounts.some(mount => mount.Type !== 'tmpfs' || !(mount.Destination in options.tmpfs))
      )
        throw new Error('PRIVATE_NATIVE_BOUNDARY_MISMATCH');
      return {
        containerId: inspection.Id,
        imageId: inspection.Image,
        user: inspection.Config.User,
        network: host.NetworkMode,
        labels: inspection.Config.Labels,
        logDriver: host.LogConfig?.Type,
        capDrop: host.CapDrop,
        capAdd: host.CapAdd,
        privileged: host.Privileged,
        noNewPrivileges,
        seccompSha256,
        memory: host.Memory,
        memorySwap: host.MemorySwap,
        cpuPeriod: host.CpuPeriod,
        cpuQuota: host.CpuQuota,
        pids: host.PidsLimit,
        init: host.Init,
        readonlyRootfs: host.ReadonlyRootfs,
        ulimits: host.Ulimits,
        tmpfs: host.Tmpfs,
        mounts: inspection.Mounts,
        environmentNames: inspection.Config.Env.map(entry => entry.split('=')[0]),
      };
    };
    await assertBoundary(false);
    const sandbox = new DockerSandbox(options);
    await sandbox.start({ abortSignal: AbortSignal.timeout(30000) });
    const inspection = await sandbox.container.inspect();
    if (inspection.Id !== container.id) throw new Error('PRIVATE_NATIVE_ID_MISMATCH');
    if (!sandbox.executeCommand) throw new Error('NATIVE_EXECUTION_UNAVAILABLE');
    return Object.assign(sandbox, {
      executeCommand: sandbox.executeCommand.bind(sandbox),
      boundaryEvidence: await assertBoundary(true),
    });
  } catch (error) {
    await container.remove({ force: true, v: true });
    throw error;
  }
}

/** Trusted native sandbox whose raw retained output buffers are disabled. */
export type PrivateSandbox = Awaited<ReturnType<typeof privateNativeSandbox>>;
