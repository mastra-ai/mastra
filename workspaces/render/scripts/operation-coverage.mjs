import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript-classic';

const cases = {};
for (const name of ['production-live', 'production-focused-live', 'operation-audit']) {
  const record = JSON.parse(await readFile(`validation/${name}.json`, 'utf8'));
  assert.equal(record.result, 'PASS');
  cases[name] = record.cases;
}
const references = {
  lifecycle: ['operation-audit', 'owned terminate, attached terminate and direct SDK lifecycle'],
  metadata: ['production-live', 'metadata, listing and groups'],
  command: ['production-live', 'command argv, cwd, env, stdout, stderr and nonzero status'],
  native: ['operation-audit', 'native exec stdout, stderr, exit status and early iterator close'],
  files: ['production-live', 'local file, tar directory and gzip archive uploads'],
  transfers: ['production-live', 'streamed upload and download above 16 MiB'],
  checkpoint: ['production-live', 'Mastra checkpoint hook'],
  snapshot: ['production-live', 'filesystem capture, lookup, pagination and restore'],
  snapshotDirect: ['operation-audit', 'snapshot create, wait, expiry, checkpoint priority and clone overrides'],
  clone: ['operation-audit', 'clone fresh base fallback and attached clone'],
  factory: ['operation-audit', 'factory, cached info, instructions, client options and creation env'],
};
const sandbox = {
  sdk: 'lifecycle',
  start: 'lifecycle',
  executeCommand: 'command',
  exec: 'native',
  writeFiles: 'command',
  readFile: 'files',
  upload: 'transfers',
  uploadFile: 'files',
  uploadDirectory: 'files',
  download: 'transfers',
  downloadToFile: 'transfers',
  stop: 'clone',
  destroy: 'lifecycle',
  snapshot: 'checkpoint',
  captureSnapshot: 'snapshot',
  restore: 'snapshot',
  clone: 'clone',
  refresh: 'metadata',
  listSandboxes: 'metadata',
  listGroups: 'metadata',
  terminate: 'lifecycle',
  getInfo: 'factory',
  getInstructions: 'factory',
};
const snapshots = {
  create: 'snapshotDirect',
  get: 'snapshot',
  list: 'snapshot',
  delete: 'snapshotDirect',
  waitForAvailable: 'snapshotDirect',
  capture: 'snapshot',
};
const sdk = {
  get: 'metadata',
  create: 'lifecycle',
  list: 'metadata',
  listGroups: 'metadata',
  terminate: 'lifecycle',
  upload: 'transfers',
  download: 'transfers',
  exec: 'native',
};
async function inventory(path, className, mapping) {
  const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === className);
  assert(declaration, className);
  const members = declaration.members
    .filter(
      member =>
        (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member)) &&
        !member.modifiers?.some(modifier =>
          [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword].includes(modifier.kind),
        ),
    )
    .map(member => member.name.getText(source));
  assert.deepEqual([...members].sort(), Object.keys(mapping).sort(), `Unmapped public operations in ${className}`);
  return members.map(operation => {
    const [file, name] = references[mapping[operation]];
    const test = cases[file].find(item => item.name === name);
    assert.equal(test?.result, 'PASS', name);
    return {
      operation: `${className}.${operation}`,
      evidence: `${file}.json`,
      case: name,
      result: 'LIVE_PASS',
    };
  });
}
const sdkFile = 'node_modules/@renderinc/sdk/dist/experimental/sandboxes/index.d.ts';
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    'All public high-level Sandbox SDK 1.2.0 methods; adapter methods, sdk getter and editor factory. Cumulative live evidence, not every parameter combination or service failure.',
  sdk: [
    ...(await inventory(sdkFile, 'SandboxesClient', sdk)),
    ...(await inventory(
      sdkFile,
      'SandboxSnapshotsClient',
      Object.fromEntries(
        Object.entries(snapshots).filter(([key]) => ['create', 'get', 'list', 'delete'].includes(key)),
      ),
    )),
  ],
  adapter: [
    ...(await inventory('src/sandbox.ts', 'RenderSandbox', sandbox)),
    ...(await inventory('src/snapshots.ts', 'RenderSnapshots', snapshots)),
  ],
  factory: {
    operation: 'renderSandboxProvider.createSandbox',
    evidence: 'operation-audit.json',
    case: references.factory[1],
    result: 'LIVE_PASS',
  },
  limits: [
    'Fault injection covers authentication failures, interrupted streams, races, delayed creates and failed cleanup; no real provider outage was induced.',
    'Snapshot expiry timestamp was accepted and read back; automatic expiry was not waited out.',
    'Region and plan options are passed through; current early access fixes actual placement and compute size.',
    'Command cancellation verifies the command process group; deliberately detached descendants are outside that guarantee.',
    'Mastra native agent tool calls use executeCommand. Lifecycle, transfer and snapshot operations were exercised directly from the host.',
    'Generated REST-only endpoints absent from the high-level SDK are outside this inventory.',
  ],
};
assert.equal(report.sdk.length, 12);
assert.equal(report.adapter.length, 29);
await writeFile('validation/operation-coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  `${report.sdk.length} SDK operations, ${report.adapter.length} adapter methods/getter and editor factory mapped to passing live evidence.`,
);
