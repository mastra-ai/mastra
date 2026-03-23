/**
 * Slack smoke-test reporter.
 *
 * Reads the Vitest JSON report (API tests) and Playwright JSON report (UI tests),
 * posts a combined summary DM, and uploads failure videos as threaded replies.
 *
 * Required env vars:
 *   SLACK_BOT_TOKEN  – Bot User OAuth Token (xoxb-…)
 *   SLACK_USER_ID    – Slack user ID to DM (e.g. U01ABCDEF)
 *
 * Optional env vars:
 *   REPORT_PATH      – path to Playwright JSON report (default: test-results/report.json)
 *   API_REPORT_PATH  – path to Vitest JSON report (default: test-results/api-results.json)
 *   VIDEO_DIR        – path to Playwright test-results dir (default: test-results)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

// Load .env if present (local dev); in CI, env vars come from secrets.
const envPath = join(import.meta.dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

// ── Types ──────────────────────────────────────────────────────────

// Playwright types
interface PlaywrightResult {
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  attachments?: Array<{ name: string; path?: string; contentType: string }>;
  error?: { message?: string };
}

interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tests: Array<{
    title: string;
    results: PlaywrightResult[];
  }>;
}

interface PlaywrightSuite {
  title: string;
  file?: string;
  specs: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  config: { rootDir: string };
  suites: PlaywrightSuite[];
  stats: {
    startTime: string;
    duration: number;
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
  };
}

// Vitest JSON types (Jest-compatible format)
interface VitestAssertionResult {
  ancestorTitles: string[];
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'todo';
  title: string;
  failureMessages?: string[];
}

interface VitestTestResult {
  name: string;
  status: 'passed' | 'failed';
  assertionResults: VitestAssertionResult[];
}

interface VitestReport {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  startTime: number;
  testResults: VitestTestResult[];
}

interface FailedTest {
  source: 'API' | 'UI';
  title: string;
  file: string;
  error: string;
  videoPath: string | null;
}

// ── Config ─────────────────────────────────────────────────────────

const SLACK_BOT_TOKEN = env('SLACK_BOT_TOKEN');
const SLACK_USER_ID = env('SLACK_USER_ID');
const REPORT_PATH = process.env.REPORT_PATH || 'test-results/report.json';
const API_REPORT_PATH = process.env.API_REPORT_PATH || 'test-results/api-results.json';
const VIDEO_DIR = process.env.VIDEO_DIR || 'test-results';

// ── Helpers ────────────────────────────────────────────────────────

function env(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

async function slackApi(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; error?: string; channel?: { id: string }; ts?: string };
  if (!data.ok) {
    throw new Error(`Slack ${method} failed: ${data.error}`);
  }
  return data;
}

async function uploadFile(channelId: string, threadTs: string, filePath: string, title: string) {
  const fileBuffer = readFileSync(filePath);
  const fileName = basename(filePath);
  const fileSize = statSync(filePath).size;

  // Step 1: Get upload URL
  const urlRes = await fetch('https://slack.com/api/files.getUploadURLExternal', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      filename: fileName,
      length: String(fileSize),
    }),
  });
  const urlData = (await urlRes.json()) as { ok: boolean; upload_url: string; file_id: string; error?: string };
  if (!urlData.ok) {
    throw new Error(`files.getUploadURLExternal failed: ${urlData.error}`);
  }

  // Step 2: Upload file content
  await fetch(urlData.upload_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: fileBuffer,
  });

  // Step 3: Complete upload and share to channel/thread
  const completeRes = await fetch('https://slack.com/api/files.completeUploadExternal', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: [{ id: urlData.file_id, title }],
      channel_id: channelId,
      thread_ts: threadTs,
    }),
  });
  const completeData = (await completeRes.json()) as { ok: boolean; error?: string };
  if (!completeData.ok) {
    throw new Error(`files.completeUploadExternal failed: ${completeData.error}`);
  }
}

// ── Parse Playwright report ─────────────────────────────────────────

function collectPlaywrightFailures(suites: PlaywrightSuite[], parentFile = ''): FailedTest[] {
  const failures: FailedTest[] = [];

  for (const suite of suites) {
    const file = suite.file || parentFile;

    for (const spec of suite.specs) {
      if (spec.ok) continue;

      const allResults = spec.tests.flatMap(t => t.results);
      const failedResult = allResults.find(
        r => r.status === 'failed' || r.status === 'timedOut',
      );
      if (!failedResult) continue;

      let videoPath: string | null = null;
      const videoAttachment = failedResult.attachments?.find(a => a.contentType === 'video/webm');
      if (videoAttachment?.path && existsSync(videoAttachment.path)) {
        videoPath = videoAttachment.path;
      }

      if (!videoPath) {
        videoPath = findVideo(spec.title, spec.title);
      }

      failures.push({
        source: 'UI',
        title: spec.title,
        file,
        error: (failedResult.error?.message?.split('\n')[0] || 'Unknown error').replace(/\x1b\[[0-9;]*m/g, ''),
        videoPath,
      });
    }

    if (suite.suites) {
      failures.push(...collectPlaywrightFailures(suite.suites, file));
    }
  }

  return failures;
}

function findVideo(_specTitle: string, testTitle: string): string | null {
  if (!existsSync(VIDEO_DIR)) return null;

  const dirs = readdirSync(VIDEO_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const dir of dirs) {
    const slug = dir.name.toLowerCase();
    const titleSlug = testTitle.toLowerCase().replace(/\s+/g, '-');
    if (slug.includes(titleSlug)) {
      const videoFile = join(VIDEO_DIR, dir.name, 'video.webm');
      if (existsSync(videoFile)) return videoFile;
    }
  }

  return null;
}

// ── Parse Vitest report ─────────────────────────────────────────────

function collectVitestFailures(report: VitestReport): FailedTest[] {
  const failures: FailedTest[] = [];

  for (const testResult of report.testResults) {
    for (const assertion of testResult.assertionResults) {
      if (assertion.status !== 'failed') continue;

      const errorMsg = assertion.failureMessages?.[0]?.split('\n')[0] || 'Unknown error';

      failures.push({
        source: 'API',
        title: assertion.fullName,
        file: testResult.name,
        error: errorMsg.replace(/\x1b\[[0-9;]*m/g, ''),
        videoPath: null,
      });
    }
  }

  return failures;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  // Read API report (Vitest)
  let apiStats = { passed: 0, failed: 0, skipped: 0, total: 0 };
  let apiFailures: FailedTest[] = [];
  let apiStartTime: number | null = null;

  if (existsSync(API_REPORT_PATH)) {
    const apiReport: VitestReport = JSON.parse(readFileSync(API_REPORT_PATH, 'utf-8'));
    apiStats = {
      passed: apiReport.numPassedTests,
      failed: apiReport.numFailedTests,
      skipped: apiReport.numPendingTests + apiReport.numTodoTests,
      total: apiReport.numTotalTests,
    };
    apiStartTime = apiReport.startTime;
    apiFailures = collectVitestFailures(apiReport);
    console.log(`API report: ${apiStats.passed}/${apiStats.total} passed, ${apiStats.failed} failed`);
  } else {
    console.warn(`API report not found: ${API_REPORT_PATH}`);
  }

  // Read UI report (Playwright)
  let uiStats = { passed: 0, failed: 0, skipped: 0, flaky: 0, total: 0 };
  let uiFailures: FailedTest[] = [];
  let uiStartTime: string | null = null;

  if (existsSync(REPORT_PATH)) {
    const uiReport: PlaywrightReport = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'));
    uiStats = {
      passed: uiReport.stats.expected,
      failed: uiReport.stats.unexpected,
      skipped: uiReport.stats.skipped,
      flaky: uiReport.stats.flaky,
      total: uiReport.stats.expected + uiReport.stats.unexpected + uiReport.stats.flaky + uiReport.stats.skipped,
    };
    uiStartTime = uiReport.stats.startTime;
    uiFailures = collectPlaywrightFailures(uiReport.suites);
    console.log(`UI report: ${uiStats.passed}/${uiStats.total} passed, ${uiStats.failed} failed`);
  } else {
    console.warn(`UI report not found: ${REPORT_PATH}`);
  }

  if (!existsSync(API_REPORT_PATH) && !existsSync(REPORT_PATH)) {
    console.error('No test reports found. Nothing to report.');
    process.exit(1);
  }

  // Open DM channel
  const dmRes = await slackApi('conversations.open', { users: SLACK_USER_ID });
  const channelId = dmRes.channel!.id;

  // Build summary
  const allFailures = [...apiFailures, ...uiFailures];
  const totalFailed = apiStats.failed + uiStats.failed;
  const isGreen = totalFailed === 0;
  const emoji = isGreen ? '✅' : '🔴';

  // Use the earliest available start time for the timestamp
  const startMs = apiStartTime ?? (uiStartTime ? new Date(uiStartTime).getTime() : Date.now());
  const runTs = Math.floor(startMs / 1000);
  const timeStr = `<!date^${runTs}^{date_short_pretty} at {time}|${new Date(startMs).toISOString()}>`;

  // Per-suite status lines
  const apiLine = apiStats.total > 0
    ? (apiStats.failed > 0
      ? `API: ${apiStats.failed} failed, ${apiStats.passed} passed`
      : `API: ${apiStats.passed}/${apiStats.total} passed`)
    : null;
  const uiLine = uiStats.total > 0
    ? (uiStats.failed > 0
      ? `UI: ${uiStats.failed} failed, ${uiStats.passed} passed`
      : `UI: ${uiStats.passed}/${uiStats.total} passed`)
    : null;

  const headline = isGreen
    ? `${emoji} *Smoke Tests* — all green`
    : `${emoji} *Smoke Tests* — ${totalFailed} failed`;

  const statusLines = [apiLine, uiLine].filter(Boolean).join('  ·  ');

  // Context line: timestamp, run link, skipped/flaky counts
  const contextParts = [timeStr];
  if (process.env.WORKFLOW_RUN_URL) contextParts.push(`<${process.env.WORKFLOW_RUN_URL}|View run>`);
  const totalSkipped = apiStats.skipped + uiStats.skipped;
  if (totalSkipped > 0) contextParts.push(`${totalSkipped} skipped`);
  if (uiStats.flaky > 0) contextParts.push(`⚠️ ${uiStats.flaky} flaky`);

  const blocks: Record<string, unknown>[] = [
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: contextParts.join('  ·  ') }],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `${headline}\n${statusLines}` },
    },
  ];

  if (!isGreen && allFailures.length > 0) {
    blocks.push({ type: 'divider' });

    // Slack section blocks have a 3000-char text limit.
    // Build the list incrementally and stop when we'd exceed the budget.
    const header = '*Failures:*\n\n';
    const maxLen = 2900; // leave room for header + truncation notice
    let failureList = '';
    let shown = 0;

    for (const f of allFailures) {
      const error = f.error.length > 120 ? f.error.slice(0, 120) + '…' : f.error;
      // Escape chars that break Slack mrkdwn inside the error string
      const safeError = error.replace(/[*_~`<>]/g, c => `\\${c}`);
      const entry = `• [${f.source}] \`${f.file}\`\n   ${f.title}\n   _${safeError}_`;
      const candidate = failureList ? failureList + '\n\n' + entry : entry;
      if (header.length + candidate.length > maxLen) break;
      failureList = candidate;
      shown++;
    }

    const remaining = allFailures.length - shown;
    if (remaining > 0) {
      failureList += `\n\n_…and ${remaining} more_`;
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${header}${failureList}`,
      },
    });

    if (allFailures.some(f => f.videoPath)) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '🎬 _Failure videos attached in thread_' },
        ],
      });
    }
  }

  // Post summary
  const msgRes = await slackApi('chat.postMessage', {
    channel: channelId,
    text: `${headline} — ${statusLines}`, // fallback for notifications
    blocks,
  });

  const threadTs = msgRes.ts!;
  console.log(`Posted summary to DM (ts: ${threadTs})`);

  // Upload failure videos as thread replies
  for (const failure of allFailures) {
    if (!failure.videoPath) continue;
    console.log(`Uploading video for: ${failure.title}`);
    try {
      await uploadFile(channelId, threadTs, failure.videoPath, failure.title);
    } catch (err) {
      console.error(`Failed to upload video for ${failure.title}:`, err);
    }
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('Slack report failed:', err);
  process.exit(1);
});
