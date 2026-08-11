import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import { FakeSandbox, makeBuildDir } from './fake-sandbox.mock.js';
import { SandboxWorkerCapabilityError } from './types.js';
import { attachWorkerDeployment, deployWorkerToSandbox } from './worker.js';

async function deploy(sandbox: FakeSandbox, overrides: Record<string, unknown> = {}) {
  return deployWorkerToSandbox({
    sandbox,
    dir: await makeBuildDir(tmpdir()),
    executionId: 'attempt-1',
    command: 'node',
    args: ['index.mjs'],
    ...overrides,
  });
}

describe('deployWorkerToSandbox', () => {
  it('launches a namespaced execution without networking and preserves command arguments', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    const deployment = await deploy(sandbox, {
      args: ['index.mjs', '--request', 'value with spaces'],
      env: { SECRET: "doesn't leak" },
    });

    expect(deployment.executionId).toBe('attempt-1');
    expect(await deployment.status()).toEqual({ state: 'running', executionId: 'attempt-1' });
    expect(sandbox.spawned).toEqual([]);
    expect(sandbox.commands.some(command => command.includes('setsid nohup sh'))).toBe(true);

    const launchScript = sandbox.writtenFiles.flat().find(file => file.path.endsWith('/attempt-1/launch.sh'));
    expect(launchScript).toBeDefined();
    const content = Buffer.isBuffer(launchScript!.content)
      ? launchScript!.content.toString()
      : String(launchScript!.content);
    expect(content).toContain('value with spaces');
    expect(content).toContain('SECRET=');
    expect(content).toContain('doesn');
    expect(content).toContain('/attempt-1/stdout');
    expect(content).toContain('/attempt-1/stderr');
    expect(content).toContain("awk '{print $22}'");
    expect(content).not.toContain('ulimit ');
    expect(sandbox.commands.some(command => command.includes('MASTRA_WORKER_CAPABILITY:'))).toBe(false);
  });

  it('preflights requested hard limits before deployment and applies them immediately before exec', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    await deploy(sandbox, {
      resourceLimits: {
        cpuTimeSeconds: 3,
        addressSpaceBytes: 8_192,
        fileSizeBytes: 2_048,
        openFiles: 32,
      },
    });

    const preflight = sandbox.commands.find(command => command.includes('MASTRA_WORKER_CAPABILITY:'));
    expect(preflight).toContain('[ "$(uname -s 2>/dev/null)" = Linux ]');
    expect(preflight).toContain("setsid sh -c 'kill -0 -$$ 2>/dev/null'");
    expect(preflight).toContain('check_limit cpu_time -t 3');
    expect(preflight).toContain('check_limit address_space -v 8');
    expect(preflight).toContain('check_limit file_size -f 4');
    expect(preflight).toContain('check_limit open_files -n 32');
    expect(preflight).toContain('ulimit -H "$flag" "$((value + 1))"');

    const script = sandbox.writtenFiles.flat().find(file => file.path.endsWith('/attempt-1/launch.sh'));
    const content = String(script!.content);
    const softCpu = content.indexOf('ulimit -S -t 3');
    const hardCpu = content.indexOf('ulimit -H -t 3');
    const exec = content.indexOf('exec ', content.indexOf('ulimit -H -n 32'));
    expect(softCpu).toBeGreaterThan(-1);
    expect(hardCpu).toBeGreaterThan(softCpu);
    expect(content.indexOf('ulimit -S -v 8')).toBeGreaterThan(hardCpu);
    expect(content.indexOf('ulimit -H -v 8')).toBeGreaterThan(content.indexOf('ulimit -S -v 8'));
    expect(content.indexOf('ulimit -S -f 4')).toBeGreaterThan(content.indexOf('ulimit -H -v 8'));
    expect(content.indexOf('ulimit -H -f 4')).toBeGreaterThan(content.indexOf('ulimit -S -f 4'));
    expect(content.indexOf('ulimit -S -n 32')).toBeGreaterThan(content.indexOf('ulimit -H -f 4'));
    expect(content.indexOf('ulimit -H -n 32')).toBeGreaterThan(content.indexOf('ulimit -S -n 32'));
    expect(exec).toBeGreaterThan(content.indexOf('ulimit -H -n 32'));
  });

  it('preflights only the signal capability required by the requested limit', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    await deploy(sandbox, { resourceLimits: { cpuTimeSeconds: 3 } });

    const preflight = sandbox.commands.find(command => command.includes('MASTRA_WORKER_CAPABILITY:'))!;
    expect(preflight).toContain('kill -l XCPU');
    expect(preflight).not.toContain('kill -l XFSZ');
  });

  it('fails closed before upload when a requested capability is unavailable', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    vi.spyOn(sandbox, 'executeCommand').mockResolvedValueOnce({
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: 'MASTRA_WORKER_CAPABILITY:address_space\n',
      executionTimeMs: 1,
    });

    const error = await deploy(sandbox, { resourceLimits: { addressSpaceBytes: 1_048_576 } }).catch(error => error);
    expect(error).toBeInstanceOf(SandboxWorkerCapabilityError);
    expect(error).toMatchObject({
      code: 'SANDBOX_WORKER_CAPABILITY_UNAVAILABLE',
      capability: 'address_space',
    });
    expect(sandbox.writtenFiles).toEqual([]);
    expect(sandbox.commands).toHaveLength(0);
  });

  it.each([
    ['cpuTimeSeconds', 0],
    ['addressSpaceBytes', Number.NaN],
    ['fileSizeBytes', 1.5],
    ['openFiles', Number.POSITIVE_INFINITY],
  ])('rejects an invalid %s hard limit', async (name, value) => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    await expect(deploy(sandbox, { resourceLimits: { [name]: value } })).rejects.toThrow(
      `resourceLimits.${name} must be a positive safe integer`,
    );
    expect(sandbox.writtenFiles).toEqual([]);
  });

  it('allows explicitly undefined limits without changing the launch path', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    await deploy(sandbox, { resourceLimits: { cpuTimeSeconds: undefined } });

    expect(sandbox.commands.some(command => command.includes('MASTRA_WORKER_CAPABILITY:'))).toBe(false);
    const script = sandbox.writtenFiles.flat().find(file => file.path.endsWith('/attempt-1/launch.sh'))!;
    expect(String(script.content)).not.toContain('ulimit ');
  });

  it('rejects unknown resource-limit fields', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    await expect(deploy(sandbox, { resourceLimits: { unsupportedLimit: 1 } as never })).rejects.toThrow(
      'Unknown worker resource limit: unsupportedLimit',
    );
  });

  it('stages bounded stdin before launch', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    await deploy(sandbox, { input: { type: 'stdin', data: Buffer.from([0, 1, 2, 255]) } });

    const input = sandbox.writtenFiles.flat().find(file => file.path.endsWith('/attempt-1/stdin'));
    expect(Buffer.from(input!.content as Uint8Array)).toEqual(Buffer.from([0, 1, 2, 255]));
    const script = sandbox.writtenFiles.flat().find(file => file.path.endsWith('/attempt-1/launch.sh'));
    expect(String(script!.content)).toContain('/attempt-1/stdin');
    expect(String(script!.content)).toContain(' < ');
  });

  it('rejects input larger than the configured byte limit', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    await expect(deploy(sandbox, { input: { type: 'stdin', data: 'too large' }, inputLimitBytes: 3 })).rejects.toThrow(
      'inputLimitBytes',
    );
  });

  it('stages an artifact-relative input file without redirecting stdin', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    await deploy(sandbox, { input: { type: 'file', path: 'requests/request.bin', data: 'request' } });

    expect(sandbox.writtenFiles.flat().some(file => file.path.endsWith('/requests/request.bin'))).toBe(true);
    const script = sandbox.writtenFiles.flat().find(file => file.path.endsWith('/attempt-1/launch.sh'));
    expect(String(script!.content)).not.toContain("< '/home/fake");
  });

  it('reports typed exit code and signal', async () => {
    const sandbox = new FakeSandbox({
      withNetworking: false,
      workerStatus: 'exited|attempt-1|143|SIGTERM',
    });
    const deployment = await deploy(sandbox, { mode: 'job' });

    expect(await deployment.status()).toEqual({
      state: 'exited',
      executionId: 'attempt-1',
      exitCode: 143,
      signal: 'SIGTERM',
    });
  });

  it.each([
    ['cpu', 3, 'SIGXCPU'],
    ['file_size', 2_048, 'SIGXFSZ'],
  ] as const)('reports typed %s exhaustion only from its reliable signal', async (resource, limit, signal) => {
    const sandbox = new FakeSandbox({
      withNetworking: false,
      workerStatus: `resource_exhausted|attempt-1|${resource}|${limit}|${signal}`,
    });
    const deployment = await deploy(sandbox);

    expect(await deployment.status()).toEqual({
      state: 'resource_exhausted',
      executionId: 'attempt-1',
      resource,
      limit,
      signal,
    });
  });

  it('does not attribute ordinary memory or file-descriptor failures to resource exhaustion', async () => {
    const sandbox = new FakeSandbox({
      withNetworking: false,
      workerStatus: 'exited|attempt-1|1|',
    });
    const deployment = await deploy(sandbox, {
      resourceLimits: { addressSpaceBytes: 1_048_576, openFiles: 16 },
    });

    expect(await deployment.status()).toEqual({ state: 'exited', executionId: 'attempt-1', exitCode: 1 });
  });

  it('reads separate bounded output with byte offsets and truncation', async () => {
    const sandbox = new FakeSandbox({
      withNetworking: false,
      workerStatus: 'exited|attempt-1|0|',
      workerOutput: Buffer.from('worker-output').toString('base64'),
    });
    const deployment = await deploy(sandbox, { mode: 'job' });

    const output = await deployment.readOutput('stdout', { offset: 3, maxBytes: 6 });
    expect(Buffer.from(output.data).toString()).toBe('ker-ou');
    expect(output).toMatchObject({
      stream: 'stdout',
      offset: 3,
      nextOffset: 9,
      totalBytes: 13,
      eof: false,
      truncated: true,
      interrupted: false,
    });
    expect(sandbox.commands.at(-2)).toContain('/attempt-1/stdout');
  });

  it('marks output reads as interrupted when transport is lost', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    const deployment = await deploy(sandbox);
    vi.spyOn(sandbox, 'executeCommand').mockRejectedValueOnce(new Error('connection lost'));

    await expect(deployment.readOutput('stderr', { offset: 12 })).resolves.toMatchObject({
      stream: 'stderr',
      offset: 12,
      nextOffset: 12,
      interrupted: true,
      eof: false,
    });
  });

  it('terminates the process group and reports a startup timeout', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false, workerStatus: 'starting|attempt-1' });

    await expect(deploy(sandbox, { startupTimeoutMs: 1 })).rejects.toThrow('timed_out during startup');
    const signalCommand = sandbox.commands.find(command => command.includes('kill -TERM -"$pid"'));
    expect(signalCommand).toContain('kill -KILL -"$pid"');
    expect(signalCommand).toContain('timed_out|attempt-1|startup');
  });

  it('preserves an execution-timeout terminal outcome', async () => {
    const sandbox = new FakeSandbox({
      withNetworking: false,
      workerStatuses: ['running|attempt-1', 'timed_out|attempt-1|execution'],
    });
    const deployment = await deploy(sandbox, { executionTimeoutMs: 25 });

    expect(await deployment.status()).toEqual({ state: 'timed_out', executionId: 'attempt-1', phase: 'execution' });
    const script = sandbox.writtenFiles.flat().find(file => file.path.endsWith('/attempt-1/launch.sh'));
    const content = String(script!.content);
    expect(content).toContain('timed_out|attempt-1|execution');
    expect(content).toContain('case "$current" in timed_out*)');
  });

  it('uses process-group TERM then KILL and makes repeated cancellation terminal', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    const deployment = await deploy(sandbox);

    expect(await deployment.cancel()).toEqual({ state: 'cancelled', executionId: 'attempt-1', signal: 'TERM' });
    expect(sandbox.commands.at(-1)).toContain('kill -TERM -"$pid"');
    expect(sandbox.commands.at(-1)).toContain('kill -KILL -"$pid"');
    expect(sandbox.commands.at(-1)).toContain('expected="$');
    expect(sandbox.commands.at(-1)).toContain('expected" != "$actual');
  });

  it('rejects stale process identity without signaling another process', async () => {
    const sandbox = new FakeSandbox({
      withNetworking: false,
      workerStatuses: ['running|attempt-1', 'stale|attempt-1'],
    });
    const deployment = await deploy(sandbox);
    const commandCount = sandbox.commands.length;

    expect(await deployment.cancel()).toEqual({ state: 'unknown', executionId: 'attempt-1' });
    expect(sandbox.commands).toHaveLength(commandCount + 1);
    expect(sandbox.commands.at(-1)).not.toContain('kill -TERM -"$pid"');
  });

  it('does not inspect or wake a stopped provider unless requested', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    const deployment = await deploy(sandbox);
    sandbox.status = 'stopped';

    expect(await deployment.status()).toEqual({
      state: 'provider_unavailable',
      executionId: 'attempt-1',
      providerState: 'stopped',
    });
    expect(sandbox.started).toBe(0);
    expect(await deployment.status({ wake: true })).toEqual({ state: 'running', executionId: 'attempt-1' });
    expect(sandbox.started).toBe(1);
  });

  it('reports a destroyed provider without executing an inspection command', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    const deployment = await deploy(sandbox);
    sandbox.status = 'destroyed';
    const commandCount = sandbox.commands.length;

    expect(await deployment.status()).toEqual({
      state: 'provider_unavailable',
      executionId: 'attempt-1',
      providerState: 'destroyed',
    });
    expect(sandbox.commands).toHaveLength(commandCount);
  });

  it('retries destroy and reports success or exhaustion', async () => {
    const recovering = new FakeSandbox({ withNetworking: false, destroyFailures: 2 });
    const recoveredDeployment = await deploy(recovering);
    expect(await recoveredDeployment.destroy({ attempts: 3, delayMs: 0 })).toEqual({ state: 'destroyed', attempts: 3 });

    const failing = new FakeSandbox({ withNetworking: false, destroyFailures: 3 });
    const failingDeployment = await deploy(failing);
    expect(await failingDeployment.destroy({ attempts: 2, delayMs: 0 })).toMatchObject({
      state: 'exhausted',
      attempts: 2,
    });
  });

  it('serializes dependency installs with a lock and atomic completion marker', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    await deploy(sandbox);

    const lock = sandbox.commands.find(
      command => command.includes('.mastra-install-lock') && command.includes('while ! mkdir'),
    );
    const install = sandbox.commands.find(command => command.includes('current="$(cat'));
    expect(lock).toContain('sleep 1');
    expect(install).toContain('.mastra-install-hash.tmp');
    expect(install).toContain('mv');
  });

  it('keeps concurrent deployments isolated while sharing the dependency-install lock', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    const dir = await makeBuildDir(tmpdir());

    const deployments = await Promise.all(
      ['attempt-a', 'attempt-b'].map(executionId =>
        deployWorkerToSandbox({ sandbox, dir, executionId, command: 'node', args: ['index.mjs'] }),
      ),
    );

    expect(deployments.map(deployment => deployment.executionId)).toEqual(['attempt-a', 'attempt-b']);
    expect(
      sandbox.commands.filter(
        command => command.includes('.mastra-artifact-lock') && command.includes('while ! mkdir'),
      ),
    ).toHaveLength(2);
    expect(
      sandbox.commands.filter(command => command.includes('.mastra-install-lock') && command.includes('while ! mkdir')),
    ).toHaveLength(2);
    expect(sandbox.writtenFiles.flat().some(file => file.path.endsWith('/attempt-a/launch.sh'))).toBe(true);
    expect(sandbox.writtenFiles.flat().some(file => file.path.endsWith('/attempt-b/launch.sh'))).toBe(true);
  });

  it('tracks scripted worker statuses independently per execution', async () => {
    const sandbox = new FakeSandbox({
      withNetworking: false,
      workerStatuses: ['starting', 'running'],
    });
    const status = (executionId: string) =>
      sandbox.executeCommand('sh', ['-c', `read worker status .mastra/executions/${executionId}/status`]);

    await expect(status('attempt-a')).resolves.toMatchObject({ stdout: 'starting' });
    await expect(status('attempt-b')).resolves.toMatchObject({ stdout: 'starting' });
    await expect(status('attempt-a')).resolves.toMatchObject({ stdout: 'running' });
    await expect(status('attempt-b')).resolves.toMatchObject({ stdout: 'running' });
  });

  it('relaunches under a new execution ID, preserving limits and rejecting identity reuse', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    const deployment = await deploy(sandbox, { resourceLimits: { cpuTimeSeconds: 2 } });

    await expect(deployment.relaunch({ executionId: 'attempt-1' })).rejects.toThrow('new executionId');
    await expect(
      deployment.relaunch({
        executionId: 'attempt-2',
        input: { type: 'file', path: '../escape', data: 'unsafe' },
      }),
    ).rejects.toThrow('must stay within the deployed artifact root');
    const relaunched = await deployment.relaunch({ executionId: 'attempt-2' });
    expect(relaunched.executionId).toBe('attempt-2');
    const script = sandbox.writtenFiles.flat().find(file => file.path.endsWith('/attempt-2/launch.sh'));
    expect(String(script!.content)).toContain('ulimit -H -t 2');
  });
});

describe('attachWorkerDeployment', () => {
  it('reattaches from persisted identity and operates without launch configuration', async () => {
    const sandbox = new FakeSandbox({
      withNetworking: false,
      workerOutput: Buffer.from('persisted output').toString('base64'),
    });
    await deploy(sandbox);

    const attached = await attachWorkerDeployment({ sandbox, executionId: 'attempt-1' });

    expect(attached).toMatchObject({ sandboxId: 'fake-info-id', executionId: 'attempt-1' });
    expect('relaunch' in attached).toBe(false);
    expect(await attached.status()).toEqual({ state: 'running', executionId: 'attempt-1' });
    expect(Buffer.from((await attached.readOutput('stdout', { offset: 10 })).data).toString()).toBe('output');
    expect(await attached.destroy()).toEqual({ state: 'destroyed', attempts: 1 });
  });

  it('returns distinct typed outcomes for completed, missing or corrupt, and destroyed executions', async () => {
    const completed = new FakeSandbox({ withNetworking: false, workerStatus: 'exited|attempt-1|0' });
    const missing = new FakeSandbox({ withNetworking: false, workerStatus: 'unknown|attempt-1' });
    const corrupt = new FakeSandbox({ withNetworking: false, workerStatus: 'invalid-record' });
    const destroyed = new FakeSandbox({ withNetworking: false });
    destroyed.status = 'destroyed';

    await expect(
      (await attachWorkerDeployment({ sandbox: completed, executionId: 'attempt-1' })).status(),
    ).resolves.toEqual({ state: 'exited', executionId: 'attempt-1', exitCode: 0 });
    await expect(
      (await attachWorkerDeployment({ sandbox: missing, executionId: 'attempt-1' })).status(),
    ).resolves.toEqual({ state: 'unknown', executionId: 'attempt-1' });
    await expect(
      (await attachWorkerDeployment({ sandbox: corrupt, executionId: 'attempt-1' })).status(),
    ).resolves.toEqual({ state: 'unknown', executionId: 'attempt-1' });
    await expect(
      (await attachWorkerDeployment({ sandbox: destroyed, executionId: 'attempt-1' })).status(),
    ).resolves.toEqual({ state: 'provider_unavailable', executionId: 'attempt-1', providerState: 'destroyed' });
    expect(destroyed.commands).toEqual([]);
  });

  it('preserves stale PID protection after reattachment', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false, workerStatus: 'stale|attempt-1' });
    const attached = await attachWorkerDeployment({ sandbox, executionId: 'attempt-1', remoteDir: '/home/fake/app' });

    expect(await attached.cancel()).toEqual({ state: 'unknown', executionId: 'attempt-1' });
    expect(sandbox.commands.at(-1)).not.toContain('kill -TERM -"$pid"');
  });
});
