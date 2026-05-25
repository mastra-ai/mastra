/**
 * /debug-chat-export — dumps the current thread + observational memory records
 * to disk so users can share them when reporting bugs (e.g. unexpected
 * reflections, broken token counts, missing observations).
 *
 * The export is written to a fresh timestamped directory under the mastracode
 * application data dir so we never overwrite a previous export. Each piece of
 * state lives in its own JSON file and a `README.md` explains the layout.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { HarnessMessage } from '@mastra/core/harness';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import { getAppDataDir } from '../../utils/project.js';
import { getCurrentVersion } from '../../utils/update-check.js';
import type { SlashCommandContext } from './types.js';

const DEBUG_EXPORT_DIRNAME = 'debug-exports';

/**
 * JSON.stringify replacer that preserves Date instances and handles
 * `bigint`/`undefined`/circular references safely.
 */
function makeJsonReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return (_key, value) => {
    if (value === undefined) return null;
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  };
}

function writeJson(filePath: string, data: unknown, mode?: number): void {
  const content = JSON.stringify(data, makeJsonReplacer(), 2) + '\n';
  if (mode !== undefined) {
    fs.writeFileSync(filePath, content, { encoding: 'utf8', mode });
  } else {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function timestampSlug(date: Date): string {
  // 2026-05-13T18-22-04.123Z → safe for filenames on all platforms.
  return date.toISOString().replace(/:/g, '-');
}

function buildReadme(opts: {
  exportedAt: Date;
  threadId: string | null;
  resourceId: string;
  mastracodeVersion: string;
  messageCount: number;
  omHistoryCount: number;
  hasCurrentOm: boolean;
}): string {
  return [
    '# mastracode debug chat export',
    '',
    `Exported at: ${opts.exportedAt.toISOString()}`,
    `mastracode version: ${opts.mastracodeVersion}`,
    `Thread ID: ${opts.threadId ?? '(no active thread)'}`,
    `Resource ID: ${opts.resourceId}`,
    '',
    '## Files',
    '',
    '- `manifest.json` — top-level summary of this export.',
    '- `thread.json` — thread metadata (title, timestamps, resource, clone info).',
    `- \`messages.json\` — every message persisted in the thread (${opts.messageCount} message(s)).`,
    `- \`om-current.json\` — active observational memory record${opts.hasCurrentOm ? '' : ' (absent — no OM record for this thread yet)'}.`,
    `- \`om-history.json\` — previous OM generations, newest first (${opts.omHistoryCount} record(s)).`,
    '- `meta.json` — mastracode version, observer/reflector models, thresholds, and the current harness state snapshot.',
    '',
    '## Sharing',
    '',
    'These files may include the full text of every message in the thread.',
    'Review them for sensitive content before sharing externally.',
    'Attach the whole directory (or a zip of it) when reporting bugs against',
    'mastracode so we can reproduce the observational memory state.',
    '',
  ].join('\n');
}

export async function handleDebugChatExportCommand(ctx: SlashCommandContext): Promise<void> {
  const { harness } = ctx;

  const exportedAt = new Date();
  const threadId = harness.getCurrentThreadId();
  const resourceId = harness.getResourceId();

  if (!threadId) {
    ctx.showError('No active thread to export. Send a message first or use /threads to switch.');
    return;
  }

  let messages: HarnessMessage[];
  let currentOm: ObservationalMemoryRecord | null;
  let omHistory: ObservationalMemoryRecord[];
  try {
    messages = await harness.listMessages();
  } catch (err) {
    ctx.showError(`Failed to read messages: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  try {
    currentOm = await harness.getObservationalMemoryRecord();
  } catch {
    currentOm = null;
  }
  try {
    omHistory = await harness.getObservationalMemoryHistory();
  } catch {
    omHistory = [];
  }

  let thread: Record<string, unknown> | null;
  try {
    thread = ((await harness.listThreads({ allResources: true })).find(t => t.id === threadId) ?? null) as
      | Record<string, unknown>
      | null;
  } catch (err) {
    ctx.showError(`Failed to list threads: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const mastracodeVersion = (() => {
    try {
      return ctx.state.options.version || getCurrentVersion();
    } catch {
      return 'unknown';
    }
  })();

  const observerModelId = harness.getObserverModelId() ?? null;
  const reflectorModelId = harness.getReflectorModelId() ?? null;
  const observationThreshold = harness.getObservationThreshold() ?? null;
  const reflectionThreshold = harness.getReflectionThreshold() ?? null;
  const currentModelId = harness.getCurrentModelId();
  const currentModeId = harness.getCurrentModeId();
  const state = harness.getState();

  const metaPayload = {
    mastracodeVersion,
    platform: {
      node: process.version,
      os: process.platform,
      arch: process.arch,
    },
    currentModelId,
    currentModeId,
    om: {
      observerModelId,
      reflectorModelId,
      observationThreshold,
      reflectionThreshold,
    },
    state,
  };

  const manifest = {
    exportedAt: exportedAt.toISOString(),
    mastracodeVersion,
    threadId,
    resourceId,
    messageCount: messages.length,
    omHistoryCount: omHistory.length,
    hasCurrentOm: currentOm !== null,
    files: ['thread.json', 'messages.json', 'om-current.json', 'om-history.json', 'meta.json', 'README.md'],
  };

  const readmeContent = buildReadme({
    exportedAt,
    threadId,
    resourceId,
    mastracodeVersion,
    messageCount: messages.length,
    omHistoryCount: omHistory.length,
    hasCurrentOm: currentOm !== null,
  });

  const FILE_MODE = 0o600;
  const DIR_MODE = 0o700;

  const debugRoot = path.join(getAppDataDir(), DEBUG_EXPORT_DIRNAME);
  const slug = timestampSlug(exportedAt);
  const exportDir = path.join(debugRoot, `${slug}-${threadId.slice(0, 8)}`);
  const tmpSuffix = `.tmp-${exportedAt.getTime()}`;
  const tmpDir = exportDir + tmpSuffix;

  try {
    fs.mkdirSync(debugRoot, { recursive: true, mode: DIR_MODE });
    fs.mkdirSync(tmpDir, { mode: DIR_MODE });

    writeJson(path.join(tmpDir, 'thread.json'), thread, FILE_MODE);
    writeJson(path.join(tmpDir, 'messages.json'), messages, FILE_MODE);
    writeJson(path.join(tmpDir, 'om-current.json'), currentOm, FILE_MODE);
    writeJson(path.join(tmpDir, 'om-history.json'), omHistory, FILE_MODE);
    writeJson(path.join(tmpDir, 'meta.json'), metaPayload, FILE_MODE);
    writeJson(path.join(tmpDir, 'manifest.json'), manifest, FILE_MODE);

    fs.writeFileSync(path.join(tmpDir, 'README.md'), readmeContent, { encoding: 'utf8', mode: FILE_MODE });

    fs.renameSync(tmpDir, exportDir);
  } catch (err) {
    try {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
    ctx.showError(`Failed to write export: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  ctx.showInfo(
    [
      'Exported debug chat data to:',
      `  ${exportDir}`,
      '',
      `Messages: ${messages.length}`,
      `OM history records: ${omHistory.length}`,
      `Current OM record: ${currentOm ? 'present' : 'none'}`,
      '',
      'Review the files for sensitive content before sharing.',
    ].join('\n'),
  );
}
