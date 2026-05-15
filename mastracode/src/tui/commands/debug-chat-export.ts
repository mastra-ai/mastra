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

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, makeJsonReplacer(), 2) + '\n', 'utf8');
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

  const thread = (await harness.listThreads({ allResources: true })).find(t => t.id === threadId) ?? null;

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

  const slug = timestampSlug(exportedAt);
  const exportDir = path.join(getAppDataDir(), DEBUG_EXPORT_DIRNAME, `${slug}-${threadId.slice(0, 8)}`);
  fs.mkdirSync(exportDir, { recursive: true });

  writeJson(path.join(exportDir, 'thread.json'), thread);
  writeJson(path.join(exportDir, 'messages.json'), messages);
  writeJson(path.join(exportDir, 'om-current.json'), currentOm);
  writeJson(path.join(exportDir, 'om-history.json'), omHistory);
  writeJson(path.join(exportDir, 'meta.json'), {
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
  });

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
  writeJson(path.join(exportDir, 'manifest.json'), manifest);

  fs.writeFileSync(
    path.join(exportDir, 'README.md'),
    buildReadme({
      exportedAt,
      threadId,
      resourceId,
      mastracodeVersion,
      messageCount: messages.length,
      omHistoryCount: omHistory.length,
      hasCurrentOm: currentOm !== null,
    }),
    'utf8',
  );

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
