import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sdk = fileURLToPath(new URL('..', import.meta.url));
const cache = resolve(sdk, 'node_modules/.acp-conformance');
const tools = resolve(cache, 'validator');
const schemaPath = resolve(cache, 'schema.json');
const revision = '367c56fb6115f391bc7550288363f87416cd0af8';
const schemaSha256 = 'caf62ff962ada396878372ced11efb2c6764e59d90919a38583c319948931a42';
const schemaUrl = `https://raw.githubusercontent.com/agentclientprotocol/agent-client-protocol/${revision}/schema/v1/schema.json`;
async function run(command, args, cwd = sdk) {
  const child = spawn(command, args, { cwd, stdio: 'inherit' });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code ?? signal}`)),
    );
  });
}
await mkdir(tools, { recursive: true });
let bytes;
try {
  bytes = await readFile(schemaPath);
} catch {}
if (!bytes || createHash('sha256').update(bytes).digest('hex') !== schemaSha256) {
  const response = await fetch(schemaUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Schema download failed: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== schemaSha256)
    throw new Error('Upstream schema checksum mismatch');
  await writeFile(schemaPath, bytes);
}
for (const name of ['package.json', 'package-lock.json'])
  await copyFile(new URL(`acp-validator/${name}`, import.meta.url), resolve(tools, name));
await run(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', resolve(cache, 'npm-cache')],
  tools,
);
let server = process.argv[2] && resolve(process.argv[2]);
if (!server) {
  const entry = resolve(sdk, 'dist/acp/index.js');
  await readFile(entry); // The default gate requires the actual built SDK artifact.
  server = resolve(cache, 'release-server.mjs');
  await writeFile(server, `import { acpMain } from ${JSON.stringify(pathToFileURL(entry).href)}; await acpMain();\n`);
}
const report = resolve(cache, 'report');
await writeFile(resolve(cache, 'schema-source.json'), JSON.stringify({ revision, schemaUrl, schemaSha256 }, null, 2));
// Run one server at a time so the lifecycle matrix also fits development machines.
for (const shutdownMode of ['eof', 'SIGINT', 'SIGTERM']) {
  const destination = shutdownMode === 'eof' ? report : resolve(report, shutdownMode.toLowerCase());
  await run(process.execPath, [
    fileURLToPath(new URL('check-acp-conformance.mjs', import.meta.url)),
    server,
    schemaPath,
    tools,
    destination,
    shutdownMode,
  ]);
  console.log(`ACP conformance report (${shutdownMode}): ${resolve(destination, 'report.json')}`);
}
