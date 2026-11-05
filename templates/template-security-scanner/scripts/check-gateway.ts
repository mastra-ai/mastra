import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { loadSettings } from '../src/config/settings.js';
import { dockerClient, INPUT_LABEL, OWNER_LABEL, ownerIdentity, preflight } from '../src/runtime/docker.js';
import { control, stageFiles } from '../src/discovery/io.js';
import { digest } from '../src/discovery/images.js';
import { sourceDigest } from './source-digest.js';

const inputSchema = z
  .object({
    platform: z.literal('linux/arm64'),
    pythonVersion: z.literal('3.15'),
    baseImage: z.string().regex(/^mitmproxy\/mitmproxy@sha256:[a-f0-9]{64}$/),
    packages: z
      .array(
        z
          .object({
            name: z.string(),
            version: z.string(),
            filename: z.string().regex(/^[A-Za-z0-9_.-]+\.whl$/),
            url: z.url().startsWith('https://files.pythonhosted.org/packages/'),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            size: z.number().int().positive().max(20000000),
            license: z.string(),
          })
          .strict(),
      )
      .length(5),
  })
  .strict();
const settings = loadSettings({}),
  client = dockerClient(settings),
  owner = ownerIdentity(settings),
  token = randomUUID();
const selector = process.argv[2] ?? 'all';
const sourceBefore = await sourceDigest(settings.root);
if (process.argv.length > 3 || !['all', 'format', 'style', 'unit', 'format-write'].includes(selector))
  throw new Error('UNKNOWN_VALIDATION_SELECTOR');
const inputs = inputSchema.parse(
  JSON.parse(await readFile(join(settings.root, 'docker/validation/inputs.json'), 'utf8')),
);
await preflight(settings);
if (inputs.platform !== settings.DOCKER_PLATFORM) throw new Error('VALIDATION_PLATFORM_UNSUPPORTED');
/** Create a private test directory and reject unsafe existing filesystem entries. */
async function directory(path: string) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.())
    throw new Error('UNSAFE_VALIDATION_CACHE');
}
const root = join(settings.dataDirectory, 'validation-build'),
  wheels = join(root, 'wheels');
await directory(root);
await directory(wheels);
for (const input of inputs.packages) {
  const path = join(wheels, input.filename);
  let bytes: Buffer | undefined;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== input.size)
      throw new Error('INVALID_VALIDATION_INPUT');
    bytes = await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!bytes) {
    const response = await fetch(input.url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.body) throw new Error('VALIDATION_DOWNLOAD_FAILED');
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > input.size) {
          await reader.cancel();
          throw new Error('VALIDATION_INPUT_BOUND');
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    bytes = Buffer.concat(chunks);
    if (bytes.length !== input.size || digest(bytes) !== input.sha256) throw new Error('VALIDATION_INPUT_INTEGRITY');
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
  }
  if (bytes.length !== input.size || digest(bytes) !== input.sha256) throw new Error('VALIDATION_INPUT_INTEGRITY');
}
const dockerfile = `FROM ${inputs.baseImage}\nCOPY wheels/ /wheels/\nRUN python -m pip install --no-index --no-deps /wheels/*.whl && rm -rf /wheels && mkdir /workspace && chown 10001:10001 /workspace\nENV HOME=/workspace\nUSER 10001:10001\nWORKDIR /workspace\nENTRYPOINT []\nCMD ["sleep", "infinity"]\n`;
await writeFile(join(root, 'Dockerfile'), dockerfile, { mode: 0o600 });
const hash = digest(dockerfile + JSON.stringify(inputs)),
  tag = `security-scanner/validation:${owner.slice(-16)}-${hash.slice(0, 16)}`;
let container: ReturnType<typeof client.getContainer> | undefined;
let pythonVersion = '';
try {
  await new Promise<void>((resolve, reject) => {
    const build = spawn(
      'docker',
      [
        'build',
        '--network=none',
        '--pull=false',
        '--platform',
        inputs.platform,
        '--label',
        `${OWNER_LABEL}=${owner}`,
        '--label',
        `${INPUT_LABEL}=${hash}`,
        '--tag',
        tag,
        root,
      ],
      {
        env: { HOME: process.env.HOME, PATH: process.env.PATH, DOCKER_HOST: `unix://${settings.DOCKER_SOCKET}` },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let bytes = 0;
    const timer = setTimeout(() => build.kill('SIGKILL'), 60000);
    /** Stop the gateway test build when its output exceeds the configured byte ceiling. */
    const count = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 8388608) build.kill('SIGKILL');
    };
    build.stdout.on('data', count);
    build.stderr.on('data', count);
    build.once('error', () => {
      clearTimeout(timer);
      reject(new Error('VALIDATION_BUILD_UNAVAILABLE'));
    });
    build.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error('VALIDATION_BUILD_FAILED'));
    });
  });
  const image = await client.getImage(tag).inspect();
  if (
    image.Config.Labels?.[OWNER_LABEL] !== owner ||
    image.Config.Labels?.[INPUT_LABEL] !== hash ||
    `${image.Os}/${image.Architecture}` !== inputs.platform
  )
    throw new Error('VALIDATION_IMAGE_MISMATCH');
  container = await client.createContainer({
    name: `scanner-validation-${token}`,
    Image: image.Id,
    Entrypoint: [],
    Cmd: ['sleep', 'infinity'],
    User: '10001:10001',
    WorkingDir: '/workspace',
    Labels: { [OWNER_LABEL]: owner, [INPUT_LABEL]: hash, 'dev.mastra.security-scanner.validation': token },
    HostConfig: {
      NetworkMode: 'none',
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges:true'],
      Memory: 536870912,
      MemorySwap: 536870912,
      PidsLimit: 128,
      LogConfig: { Type: 'none', Config: {} },
    },
  });
  const sources = [
    ['policy.py', 'docker/gateway/policy.py'],
    ['gateway_policy_test.py', 'tests/gateway_policy_test.py'],
    ['server.py', 'tests/lab/server.py'],
    ['wire.py', 'tests/lab/wire.py'],
  ] as const;
  await stageFiles(
    container,
    Object.fromEntries(
      await Promise.all(
        sources.map(async ([name, path]) => [name, { bytes: await readFile(join(settings.root, path)) }]),
      ),
    ),
    true,
  );
  await container.start();
  const interpreter = await control(container, ['python', '-c', 'import sys;print(sys.version.split()[0])']);
  if (!interpreter.success || !/^3\.15\.\d+(?:(?:a|b|rc)\d+)?$/.test(interpreter.stdout.trim()))
    throw new Error('VALIDATION_PYTHON_VERSION_MISMATCH');
  pythonVersion = interpreter.stdout.trim();
  for (const [tool, version] of [
    ['ruff', '0.16.9'],
    ['mypy', '1.20.2'],
  ] as const) {
    const found = await control(container, ['python', '-m', tool, '--version']);
    if (!found.success || !found.stdout.startsWith(`${tool} ${version}`))
      throw new Error('VALIDATION_TOOL_VERSION_MISMATCH');
  }
  const names = sources.map(([name]) => name);
  const checks: [string, string[]][] = [
    ['format', ['-m', 'ruff', 'format', '--check', ...names]],
    ['style', ['-m', 'ruff', 'check', ...names]],
    [
      'style',
      ['-m', 'mypy', '--strict', '--python-version', inputs.pythonVersion, 'policy.py', 'gateway_policy_test.py'],
    ],
    ['unit', ['-m', 'unittest', 'gateway_policy_test']],
  ];
  if (selector === 'format-write') {
    const formatted = await control(container, ['python', '-m', 'ruff', 'format', ...names]);
    if (!formatted.success) throw new Error('GATEWAY_FORMAT_FAILED');
    for (const [name, path] of sources) {
      const result = await control(container, ['cat', `/workspace/${name}`]);
      if (!result.success) throw new Error('GATEWAY_FORMAT_READ_FAILED');
      await writeFile(join(settings.root, path), result.stdout);
    }
    console.log(JSON.stringify({ check: 'format-write', success: true }));
  }
  for (const [kind, args] of checks.filter(([kind]) => selector === 'all' || selector === kind)) {
    const result = await control(container, ['python', ...args], 30000);
    const success = result.success && (kind !== 'unit' || /^Ran [1-9][0-9]* tests? in /m.test(result.stderr));
    console.log(
      JSON.stringify({
        check: args[1] + (args[1] === 'ruff' ? ` ${args[2]}` : ''),
        success,
        stdout: result.stdout,
        stderr: result.stderr,
      }),
    );
    if (!success) process.exitCode = 1;
  }
  const sourceStable = sourceBefore === (await sourceDigest(settings.root));
  if (selector !== 'format-write' && !sourceStable) process.exitCode = 1;
} finally {
  const failures = [];
  try {
    if (container) {
      const observed = await container.inspect();
      if (
        observed.Config.Labels?.[OWNER_LABEL] !== owner ||
        observed.Config.Labels?.['dev.mastra.security-scanner.validation'] !== token
      )
        throw new Error('VALIDATION_OWNERSHIP_CHANGED');
      await container.remove({ force: true, v: true });
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 404) failures.push(true);
  }
  try {
    const image = await client.getImage(tag).inspect();
    if (image.Config.Labels?.[OWNER_LABEL] !== owner || image.Config.Labels?.[INPUT_LABEL] !== hash)
      throw new Error('VALIDATION_OWNERSHIP_CHANGED');
    if (!(await client.listContainers({ all: true, filters: { ancestor: [image.Id] } })).length)
      await client.getImage(image.Id).remove({ force: false, noprune: true });
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 404) failures.push(true);
  }
  if (failures.length) throw new Error('VALIDATION_CLEANUP_FAILED');
}
console.log(
  JSON.stringify({
    selector,
    sourceDigest: sourceBefore,
    sourceStable: sourceBefore === (await sourceDigest(settings.root)),
    status: process.exitCode ? 'failed' : 'passed',
    versions: { ruff: '0.16.9', mypy: '1.20.2', python: pythonVersion },
  }),
);
