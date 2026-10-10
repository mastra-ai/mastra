import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { DockerSandbox } from '@mastra/docker';

const image = 'sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94';
const id = `mastra-cancel-check-${Date.now()}`;
const destination = resolve(process.env.EVIDENCE_DIR ?? '.');
await mkdir(destination, { recursive: true });
const record = {
  core: '1.75.0',
  dockerProvider: '0.10.0-alpha.1',
  providerSource: '918704fd4608aa4d9d90d4d92c0a3429de2b880a',
  startedAt: new Date().toISOString(),
  evidence: 'Live Docker container; no SDK or provider mocks',
  image,
  id,
  cases: [],
};
const save = () => writeFile(resolve(destination, 'docker-cancellation.json'), JSON.stringify(record, null, 2) + '\n');
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const sandbox = new DockerSandbox({
  id,
  image,
  network: 'none',
  workingDirectory: '/workspace',
  init: true,
  dockerOptions: { socketPath: `${homedir()}/.docker/run/docker.sock` },
});
const workspace = new Workspace({ sandbox });
let container;
try {
  await workspace.init();
  container = sandbox.container;
  record.containerId = container.id;
  await save();
  const tools = await createWorkspaceTools(workspace);
  for (const mode of ['normal', 'abort', 'timeout']) {
    const prefix = `/workspace/${mode}`;
    const childCode = `setTimeout(()=>require('node:fs').writeFileSync('${prefix}-child','survived'),2000)`;
    const parentCode = `const cp=require('node:child_process'); const c=cp.spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{stdio:'ignore'}); process.stdout.write('started:'+process.pid+' child:'+c.pid+'\\n'); setTimeout(()=>require('node:fs').writeFileSync('${prefix}-parent','survived'),2000);`;
    const abort = new AbortController();
    const item = { mode };
    record.cases.push(item);
    const watchdog = setTimeout(() => abort.abort(), 10_000);
    try {
      item.toolOutput = await tools.mastra_workspace_execute_command.execute(
        {
          command: `node -e ${quote(parentCode)}`,
          timeout: mode === 'timeout' ? 0.3 : 6,
        },
        {
          abortSignal: abort.signal,
          writer: {
            custom: async event => {
              if (event.type === 'data-sandbox-stdout' && event.data.output.includes('started:')) {
                const match = event.data.output.match(/started:(\d+) child:(\d+)/);
                if (match) item.pids = [Number(match[1]), Number(match[2])];
                if (mode === 'abort') abort.abort();
              }
              if (event.type === 'data-sandbox-exit') item.exitEvent = event.data;
            },
          },
        },
      );
    } finally {
      clearTimeout(watchdog);
    }
    assert.equal(item.pids?.length, 2, 'Both test processes must have started');
    if (mode === 'normal') {
      assert.equal(item.exitEvent.exitCode, 0);
      const result = await sandbox.executeCommand(`cat ${prefix}-parent ${prefix}-child`);
      assert.equal(result.stdout, 'survivedsurvived');
      item.markersWritten = true;
    } else {
      assert.equal(item.exitEvent.killed, true);
      assert.equal(item.exitEvent.timedOut, mode === 'timeout');
      const check = `sleep 3; test ! -e ${prefix}-parent && test ! -e ${prefix}-child && ! kill -0 ${item.pids[0]} 2>/dev/null && ! kill -0 ${item.pids[1]} 2>/dev/null`;
      const result = await sandbox.executeCommand(check);
      assert.equal(result.exitCode, 0, `Processes or marker survived: ${result.stderr}`);
      item.processesGone = true;
      item.markersWritten = false;
    }
    item.containerStillRunning = (await container.inspect()).State.Running;
    assert.equal(item.containerStillRunning, true);
    item.result = 'PASS';
    await save();
  }
  record.result = 'PASS';
} catch (error) {
  record.result = 'FAIL';
  record.error = `${error.name}: ${error.message}`;
  throw error;
} finally {
  try {
    await workspace.destroy();
    if (container) {
      try {
        await container.inspect();
        throw new Error('Test container still exists after destroy');
      } catch (error) {
        if (error.statusCode !== 404) throw error;
      }
      record.cleanup = {
        containerId: container.id,
        removed: true,
        verification: 'Docker inspect returned 404',
      };
    }
  } finally {
    await save();
  }
}
console.log(JSON.stringify(record, null, 2));
