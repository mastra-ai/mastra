import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { execa } from 'execa';

const APP_BUNDLE = process.env.MASTRACODE_DESKTOP_ALPHA_APP ?? '/Applications/MastraCode Desktop Alpha.app';
const APP_EXECUTABLE =
  process.env.MASTRACODE_DESKTOP_ALPHA_EXECUTABLE ??
  join(APP_BUNDLE, 'Contents', 'MacOS', basename(APP_BUNDLE, '.app'));
const LIVE_WEB_ENABLED = process.env.MASTRACODE_DESKTOP_E2E_LIVE_WEB === '1';
const LIVE_CHAT_ENABLED = process.env.MASTRACODE_DESKTOP_E2E_LIVE_CHAT === '1' || LIVE_WEB_ENABLED;
const LIVE_CHAT_MARKER = 'MASTRACODE_DESKTOP_E2E.txt';
const TIMEOUT_MS = Number(process.env.MASTRACODE_DESKTOP_E2E_TIMEOUT_MS ?? (LIVE_CHAT_ENABLED ? 180_000 : 60_000));

async function readJsonFile(path) {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

function isPendingResultRead(error) {
  return error?.code === 'ENOENT' || error instanceof SyntaxError;
}

async function readTextFileOr(path, fallback) {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return fallback;
  }
}

const tmpRoot = await mkdtemp(join(tmpdir(), 'mastracode-installed-e2e-'));
const projectDir = await mkdtemp(join(tmpRoot, 'project-'));
const resolvedProjectDir = await realpath(projectDir);
const userDataDir = join(tmpRoot, 'user-data');
const resultFile = join(tmpRoot, 'result.json');
const progressFile = join(tmpRoot, 'progress.json');

await mkdir(userDataDir, { recursive: true });
await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: basename(projectDir) }, null, 2), 'utf-8');

const child = execa(APP_EXECUTABLE, [], {
  env: {
    ...process.env,
    MASTRACODE_DESKTOP_E2E_RESULT_FILE: resultFile,
    MASTRACODE_DESKTOP_E2E_PROGRESS_FILE: progressFile,
    MASTRACODE_DESKTOP_TEST_PROJECT_DIR: resolvedProjectDir,
    MASTRACODE_DESKTOP_USER_DATA_DIR: userDataDir,
    MASTRACODE_TELEMETRY_DISABLED: 'true',
    MASTRA_TELEMETRY_DISABLED: 'true',
  },
  reject: false,
});
let processOutput = '';
for (const stream of [child.stdout, child.stderr]) {
  stream?.on('data', chunk => {
    processOutput += chunk.toString();
  });
}
let childResult;
const childDone = child.then(result => {
  childResult = result;
  return result;
});

try {
  const started = Date.now();
  let result;
  while (Date.now() - started < TIMEOUT_MS) {
    try {
      result = await readJsonFile(resultFile);
      break;
    } catch (error) {
      if (!isPendingResultRead(error)) throw error;
      await delay(250);
    }
    if (childResult) {
      try {
        result = await readJsonFile(resultFile);
        break;
      } catch (error) {
        if (!isPendingResultRead(error)) throw error;
      }
      const progress = await readTextFileOr(progressFile, 'no progress file');
      throw new Error(
        `Installed desktop app exited before writing E2E result with ${childResult.exitCode}\nLast progress:\n${progress}\nProcess output:\n${processOutput}\nstdout:\n${childResult.stdout}\nstderr:\n${childResult.stderr}`,
      );
    }
  }

  if (!result) {
    child.kill('SIGTERM');
    const progress = await readTextFileOr(progressFile, 'no progress file');
    throw new Error(
      `Installed desktop E2E timed out after ${TIMEOUT_MS}ms\nLast progress:\n${progress}\nProcess output:\n${processOutput}`,
    );
  }

  const { exitCode, stdout, stderr } = await childDone;
  if (exitCode !== 0) {
    throw new Error(`Installed desktop app exited with ${exitCode}\n${stdout}\n${stderr}`);
  }
  if (!result.ok) {
    throw new Error(`Installed desktop E2E failed: ${JSON.stringify(result.error, null, 2)}`);
  }
  if (LIVE_CHAT_ENABLED && !LIVE_WEB_ENABLED) {
    let marker;
    try {
      marker = await readFile(join(projectDir, LIVE_CHAT_MARKER), 'utf-8');
    } catch (error) {
      throw new Error(
        `Live desktop code action did not create ${LIVE_CHAT_MARKER}: ${JSON.stringify(result.details?.liveChat, null, 2)}`,
        { cause: error },
      );
    }
    if (marker.trim() !== 'DESKTOP_E2E_OK') {
      throw new Error(`Live desktop code action wrote unexpected marker content: ${JSON.stringify(marker)}`);
    }
  }
  if (LIVE_WEB_ENABLED) {
    const liveChat = result.details?.liveChat;
    if (!Array.isArray(liveChat?.toolNames) || !liveChat.toolNames.includes('web_fetch')) {
      throw new Error(`Live desktop web action did not call web_fetch: ${JSON.stringify(liveChat, null, 2)}`);
    }

    const reportedStars = Number(/LIVE_FETCH_OK\s+(\d+)/i.exec(liveChat.assistantText ?? '')?.[1]);
    if (!Number.isSafeInteger(reportedStars)) {
      throw new Error(`Live desktop web action returned an invalid star count: ${JSON.stringify(liveChat, null, 2)}`);
    }

    const githubResponse = await fetch('https://api.github.com/repos/mastra-ai/mastra', {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'MastraCode-Desktop-E2E',
      },
    });
    if (!githubResponse.ok) {
      throw new Error(`GitHub verification failed with ${githubResponse.status} ${githubResponse.statusText}`);
    }
    const githubRepo = await githubResponse.json();
    const currentStars = githubRepo?.stargazers_count;
    if (!Number.isSafeInteger(currentStars)) {
      throw new Error(`GitHub verification returned an invalid response: ${JSON.stringify(githubRepo).slice(0, 1000)}`);
    }
    if (Math.abs(currentStars - reportedStars) > 5) {
      throw new Error(`Live desktop web result is stale: model=${reportedStars}, GitHub=${currentStars}`);
    }
  }

  console.log(JSON.stringify(result.details, null, 2));
} finally {
  child.kill('SIGTERM');
  await rm(tmpRoot, { recursive: true, force: true });
}
