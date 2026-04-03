import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const runsRoot = path.resolve(repoRoot, '.mastracode', 'tmp-smoke', 'runs');
const rootEnvPath = path.resolve(repoRoot, '.env');

const config = JSON.parse(process.env.SMOKE_AUTOMATION_CONFIG ?? '{}');
const runId = config.runId ?? new Date().toISOString().replace(/[:.]/g, '-');
const packageManager = config.packageManager ?? 'npm';
const provider = config.provider ?? 'openai';
const tag = config.tag ?? 'latest';
const domains = Array.isArray(config.domains) && config.domains.length ? config.domains : ['agents', 'networks'];
const port = Number(config.port ?? 4111);
const appName = config.appName ?? 'app';
const keepArtifactsOnFailure = config.keepArtifactsOnFailure ?? true;
const openScreenshots = config.openScreenshots ?? true;
const runRoot = path.join(runsRoot, runId);
const appRoot = path.join(runRoot, appName);
const screenshotDir = path.join(runRoot, 'screenshots');
const baseUrl = `http://localhost:${port}`;

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.stdio ?? 'inherit',
      shell: options.shell ?? false,
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function startBackground(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.stdio ?? 'pipe',
    shell: options.shell ?? false,
  });

  let output = '';
  child.stdout?.on('data', chunk => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });
  child.stderr?.on('data', chunk => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(text);
  });

  return { child, getOutput: () => output };
}

async function waitForServer(url, background, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    if (background.child.exitCode !== null) {
      throw new Error(`Dev server exited before becoming ready.\n${background.getOutput()}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for dev server at ${url}.\n${background.getOutput()}`);
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function copyRootEnv() {
  if (!existsSync(rootEnvPath)) return;
  await fs.copyFile(rootEnvPath, path.join(appRoot, '.env'));
}

async function scaffoldApp() {
  await ensureDir(runRoot);
  const args = ['create-mastra@' + tag, appName, '-c', 'agents,tools,workflows,scorers', '-l', provider, '-e'];
  await runCommand('npx', args, { cwd: runRoot });
  await copyRootEnv();
}

async function writeNetworkFiles() {
  const agentsDir = path.join(appRoot, 'src', 'mastra', 'agents');
  const indexPath = path.join(appRoot, 'src', 'mastra', 'index.ts');
  const weatherAgentPath = path.join(agentsDir, 'weather-agent.ts');
  const activityAgentPath = path.join(agentsDir, 'activity-agent.ts');
  const plannerNetworkPath = path.join(agentsDir, 'planner-network.ts');

  const observationalMemory = `new Memory({\n    options: {\n      lastMessages: 20,\n      semanticRecall: false,\n      generateTitle: false,\n      observationalMemory: {\n        model: 'openai/gpt-4o',\n      },\n    },\n  })`;

  const weatherAgentSource = await fs.readFile(weatherAgentPath, 'utf8');
  const updatedWeatherAgent = weatherAgentSource.replace('memory: new Memory(),', `memory: ${observationalMemory},`);
  if (updatedWeatherAgent === weatherAgentSource) {
    throw new Error('Failed to update weather-agent memory configuration');
  }
  await fs.writeFile(weatherAgentPath, updatedWeatherAgent);

  await fs.writeFile(
    activityAgentPath,
    `import { Agent } from '@mastra/core/agent';\nimport { Memory } from '@mastra/memory';\n\nexport const activityAgent = new Agent({\n  id: 'activity-agent',\n  name: 'Activity Agent',\n  instructions:\n    'You suggest practical activities based on weather conditions, energy level, and city context. Keep suggestions concise and useful.',\n  model: 'openai/gpt-4o',\n  memory: ${observationalMemory},\n});\n`
  );

  await fs.writeFile(
    plannerNetworkPath,
    `import { Agent } from '@mastra/core/agent';\nimport { Memory } from '@mastra/memory';\nimport { weatherAgent } from './weather-agent';\nimport { activityAgent } from './activity-agent';\n\nexport const plannerNetwork = new Agent({\n  id: 'planner-network',\n  name: 'Planner Network',\n  instructions:\n    'Coordinate the weather agent and activity agent to recommend activities that fit the forecast. Respond with a final user-friendly answer.',\n  model: 'openai/gpt-4o',\n  agents: { weatherAgent, activityAgent },\n  memory: ${observationalMemory},\n});\n`
  );

  const indexSource = await fs.readFile(indexPath, 'utf8');
  let updatedIndex = indexSource;
  if (!updatedIndex.includes("./agents/activity-agent")) {
    updatedIndex = updatedIndex.replace(
      "import { weatherAgent } from './agents/weather-agent';",
      "import { weatherAgent } from './agents/weather-agent';\nimport { activityAgent } from './agents/activity-agent';\nimport { plannerNetwork } from './agents/planner-network';"
    );
  }
  updatedIndex = updatedIndex.replace('agents: { weatherAgent },', 'agents: { weatherAgent, activityAgent, plannerNetwork },');
  if (updatedIndex === indexSource) {
    throw new Error('Failed to register network agents in src/mastra/index.ts');
  }
  await fs.writeFile(indexPath, updatedIndex);
}

async function runHarness() {
  await ensureDir(screenshotDir);
  const jsonChunks = [];
  await new Promise((resolve, reject) => {
    const child = spawn('node', ['smoke-test.mjs'], {
      cwd: __dirname,
      env: {
        ...process.env,
        SMOKE_RUN_CONFIG: JSON.stringify({ baseUrl, domains, screenshotDir }),
      },
      stdio: ['inherit', 'pipe', 'inherit'],
    });

    child.stdout.on('data', chunk => {
      const text = chunk.toString();
      jsonChunks.push(text);
      process.stdout.write(text);
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Smoke harness exited with code ${code}`));
    });
  });

  const parsed = JSON.parse(jsonChunks.join('').trim());
  return parsed;
}

async function openInFinder(target) {
  await runCommand('open', [target], { cwd: repoRoot });
}

async function cleanupSucceededRun() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rm(appRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

async function stopServer(server) {
  if (!server?.child || server.child.exitCode !== null) return;
  server.child.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 1500));
  if (server.child.exitCode === null) {
    server.child.kill('SIGKILL');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function main() {
  let server;
  let results;
  try {
    console.log(`==> Smoke run ${runId}`);
    console.log(`==> Creating app in ${path.relative(repoRoot, appRoot)}`);
    await scaffoldApp();
    await writeNetworkFiles();

    console.log(`==> Starting dev server on ${baseUrl}`);
    server = startBackground(packageManager, ['run', 'dev'], { cwd: appRoot, env: { PORT: String(port) } });
    await waitForServer(baseUrl, server);

    console.log(`==> Running reusable smoke harness for domains: ${domains.join(', ')}`);
    results = await runHarness();

    const failed = results.results.filter(result => result.status !== 'passed');
    console.log(`==> Screenshots: ${screenshotDir}`);
    if (openScreenshots) {
      await openInFinder(screenshotDir);
    }

    if (failed.length === 0) {
      console.log('==> All smoke tests passed. Stopping dev server and cleaning up generated app only.');
      await stopServer(server);
      server = undefined;
      await cleanupSucceededRun();
    } else {
      console.log('==> Smoke tests failed. Leaving generated app and artifacts in place for debugging.');
    }

    console.log(JSON.stringify({ runId, appRoot, screenshotDir, baseUrl, domains, failed: failed.length }, null, 2));
  } finally {
    await stopServer(server);

    if (!results && !keepArtifactsOnFailure && existsSync(runRoot)) {
      await fs.rm(runRoot, { recursive: true, force: true });
    }
  }
}

await main();
