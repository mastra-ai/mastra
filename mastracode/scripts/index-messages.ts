#!/usr/bin/env npx tsx
/**
 * One-time migration script to index MastraCode's existing observation groups
 * into the vector store for semantic search via recall mode="search".
 *
 * Rebuilds insertable observation records from persisted observation/buffering
 * start/end message parts, using the stored observation text, completion
 * timestamps, and reconstructed message ranges as the seed metadata.
 *
 * Usage:
 *   npx tsx scripts/index-messages.ts [resource-id]
 */

import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';
import { Memory } from '@mastra/memory';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

function buildLegacyGroupId(threadId: string | null, dateHeader: string, content: string): string {
  return crypto
    .createHash('sha1')
    .update(`${threadId ?? 'resource'}\n${dateHeader}\n${content}`)
    .digest('hex')
    .slice(0, 16);
}

type ParsedGroupProvenance = {
  markerType: 'observation' | 'buffering';
  matchType: 'matched' | 'fallback-end';
  cycleId?: string;
  recordId?: string;
  startMessageId?: string;
  endMessageId: string;
  startPartType?: 'data-om-observation-start' | 'data-om-buffering-start';
  endPartType: 'data-om-observation-end' | 'data-om-buffering-end';
};

type ParsedGroup = {
  id: string;
  range: string;
  content: string;
  threadId: string | null;
  provenance: ParsedGroupProvenance;
};

type CycleMarkerData = {
  cycleId?: string;
  startedAt?: string;
  completedAt?: string;
  observations?: string;
  operationType?: 'observation' | 'reflection';
  recordId?: string;
};

type OpenCycle = {
  cycleId: string;
  startMessageId: string;
  startedAt?: string;
  operationType: 'observation' | 'reflection';
  recordId?: string;
  startPartType: 'data-om-observation-start' | 'data-om-buffering-start';
};

type IndexLock = {
  path: string;
  release: () => void;
};

type DuplicateHashSample = {
  hash: string;
  count: number;
  sampleGroupIds: string[];
  sampleRanges: string[];
  sampleContents?: string[];
  sampleProvenance?: ParsedGroupProvenance[];
};

type DuplicateHashAccumulator = {
  count: number;
  sampleGroupIds: string[];
  sampleRanges: string[];
  sampleContents: string[];
  sampleProvenance: ParsedGroupProvenance[];
};

function createDuplicateHashAccumulator(): DuplicateHashAccumulator {
  return {
    count: 0,
    sampleGroupIds: [],
    sampleRanges: [],
    sampleContents: [],
    sampleProvenance: [],
  };
}

type HashOnlyReport = {
  resourceId: string;
  threadId?: string;
  generatedAt: string;
  scannedMessages: number;
  emittedGroups: number;
  uniqueTextHashes: number;
  duplicateTextHashes: number;
  duplicateTextGroups: number;
  uniqueHashRangeKeys: number;
  duplicateHashRangeKeys: number;
  duplicateHashRangeGroups: number;
  textHashCollisionGroups: number;
  textHashCollisionHashes: number;
  topDuplicateTextHashes: DuplicateHashSample[];
  topDuplicateHashRangeKeys: DuplicateHashSample[];
};

type ThreadRunStats = {
  indexed: number;
  errors: number;
  scannedMessages: number;
  emittedGroups: number;
  uniqueHashes?: number;
  duplicateHashes?: number;
  duplicateGroups?: number;
  uniqueHashRangeKeys?: number;
  duplicateHashRangeKeys?: number;
  duplicateHashRangeGroups?: number;
  textHashCollisionGroups?: number;
  textHashCollisionHashes?: number;
  topDuplicateHashes?: DuplicateHashSample[];
  topDuplicateHashRangeKeys?: DuplicateHashSample[];
  hashOnlyReportPath?: string;
};

function hashObservationText(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function truncateHash(hash: string) {
  return hash.slice(0, 12);
}

type ProgressThreadStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

type ProgressThreadState = {
  status: ProgressThreadStatus;
  title: string;
  attempts: number;
  indexed: number;
  errors: number;
  scannedMessages: number;
  emittedGroups: number;
  updatedAt: string;
  startedAt?: string;
  failure?: string;
};

type ProgressState = {
  resourceId: string;
  startedAt: string;
  updatedAt: string;
  completed: number;
  failed: number;
  inProgress: number;
  pending: number;
  threads: Record<string, ProgressThreadState>;
};

function getMessageParts(message: MastraDBMessage) {
  return Array.isArray(message.content?.parts) ? message.content.parts : [];
}

function isCycleStartPart(part: unknown): part is { type: 'data-om-buffering-start'; data?: CycleMarkerData } {
  return !!part && typeof part === 'object' && 'type' in part && part.type === 'data-om-buffering-start';
}

function isCycleEndPart(part: unknown): part is { type: 'data-om-buffering-end'; data?: CycleMarkerData } {
  return !!part && typeof part === 'object' && 'type' in part && part.type === 'data-om-buffering-end';
}

type CycleState = {
  openCycles: Map<string, OpenCycle>;
  completedCycleIds: Set<string>;
};

function createCycleState(): CycleState {
  return {
    openCycles: new Map<string, OpenCycle>(),
    completedCycleIds: new Set<string>(),
  };
}

function parseObservationGroupsFromBatch(messages: MastraDBMessage[], state: CycleState): ParsedGroup[] {
  const groups: ParsedGroup[] = [];

  for (const message of messages) {
    for (const part of getMessageParts(message)) {
      if (isCycleStartPart(part)) {
        const data = part.data ?? {};
        const cycleId = typeof data.cycleId === 'string' ? data.cycleId : undefined;
        if (!cycleId) continue;

        state.openCycles.set(cycleId, {
          cycleId,
          startMessageId: message.id,
          startedAt: typeof data.startedAt === 'string' ? data.startedAt : undefined,
          operationType: data.operationType === 'reflection' ? 'reflection' : 'observation',
          recordId: typeof data.recordId === 'string' ? data.recordId : undefined,
          startPartType: part.type,
        });
        continue;
      }

      if (!isCycleEndPart(part)) continue;

      const data = part.data ?? {};
      const cycleId = typeof data.cycleId === 'string' ? data.cycleId : undefined;
      const observations = typeof data.observations === 'string' ? data.observations.trim() : '';
      if (!cycleId || !observations) continue;

      const completedAt = typeof data.completedAt === 'string' ? data.completedAt : null;
      const dateHeader = completedAt ? `Date: ${completedAt}` : 'Date: legacy';
      const openCycle = state.openCycles.get(cycleId);

      if (!openCycle) {
        continue;
      }

      groups.push({
        id:
          (typeof data.recordId === 'string' && data.recordId) ||
          openCycle.recordId ||
          buildLegacyGroupId(message.threadId ?? null, dateHeader, observations),
        range: `${openCycle.startMessageId}:${message.id}`,
        content: `${dateHeader}\n${observations}`,
        threadId: message.threadId ?? null,
        provenance: {
          markerType: part.type === 'data-om-buffering-end' ? 'buffering' : 'observation',
          matchType: 'matched',
          cycleId,
          recordId: (typeof data.recordId === 'string' && data.recordId) || openCycle.recordId || undefined,
          startMessageId: openCycle.startMessageId,
          endMessageId: message.id,
          startPartType: openCycle.startPartType,
          endPartType: part.type,
        },
      });
      state.openCycles.delete(cycleId);
      state.completedCycleIds.add(cycleId);
    }
  }

  return groups;
}

async function indexObservationGroupsFromMessages(
  memory: Memory,
  resourceId: string,
  threadId: string | undefined,
  label: string,
): Promise<ThreadRunStats> {
  const state = createCycleState();
  const perPage = THREAD_PAGE_SIZE;
  let page = 0;
  let indexed = 0;
  let errors = 0;
  let scannedMessages = 0;
  let emittedGroups = 0;
  const textHashCounts = HASH_ONLY_MODE ? new Map<string, number>() : null;
  const textHashSamples = HASH_ONLY_MODE ? new Map<string, DuplicateHashAccumulator>() : null;
  const hashRangeCounts = HASH_ONLY_MODE ? new Map<string, number>() : null;
  const hashRangeSamples = HASH_ONLY_MODE ? new Map<string, DuplicateHashAccumulator>() : null;

  while (true) {
    const result = threadId
      ? await memory.recall({
          threadId,
          resourceId,
          perPage,
          page,
          orderBy: { field: 'createdAt', direction: 'ASC' },
        })
      : await memory.listMessagesByResourceId({
          resourceId,
          perPage,
          page,
          orderBy: { field: 'createdAt', direction: 'ASC' },
        });

    const messages = result.messages;
    scannedMessages += messages.length;
    const groups = parseObservationGroupsFromBatch(messages, state);
    emittedGroups += groups.length;

    for (const group of groups) {
      if (textHashCounts && textHashSamples && hashRangeCounts && hashRangeSamples) {
        const textHash = hashObservationText(group.content);
        textHashCounts.set(textHash, (textHashCounts.get(textHash) ?? 0) + 1);

        const textSample = textHashSamples.get(textHash) ?? createDuplicateHashAccumulator();
        textSample.count += 1;
        if (textSample.sampleGroupIds.length < 3 && !textSample.sampleGroupIds.includes(group.id)) {
          textSample.sampleGroupIds.push(group.id);
        }
        if (textSample.sampleRanges.length < 3 && !textSample.sampleRanges.includes(group.range)) {
          textSample.sampleRanges.push(group.range);
        }
        if (textSample.sampleContents.length < 3 && !textSample.sampleContents.includes(group.content)) {
          textSample.sampleContents.push(group.content);
        }
        if (textSample.sampleProvenance.length < 3) {
          textSample.sampleProvenance.push(group.provenance);
        }
        textHashSamples.set(textHash, textSample);

        const hashRangeKey = `${textHash}:${group.range}`;
        hashRangeCounts.set(hashRangeKey, (hashRangeCounts.get(hashRangeKey) ?? 0) + 1);
        const hashRangeSample = hashRangeSamples.get(hashRangeKey) ?? createDuplicateHashAccumulator();
        hashRangeSample.count += 1;
        if (hashRangeSample.sampleGroupIds.length < 3 && !hashRangeSample.sampleGroupIds.includes(group.id)) {
          hashRangeSample.sampleGroupIds.push(group.id);
        }
        if (hashRangeSample.sampleRanges.length < 3 && !hashRangeSample.sampleRanges.includes(group.range)) {
          hashRangeSample.sampleRanges.push(group.range);
        }
        if (hashRangeSample.sampleContents.length < 3 && !hashRangeSample.sampleContents.includes(group.content)) {
          hashRangeSample.sampleContents.push(group.content);
        }
        if (hashRangeSample.sampleProvenance.length < 3) {
          hashRangeSample.sampleProvenance.push(group.provenance);
        }
        hashRangeSamples.set(hashRangeKey, hashRangeSample);
        continue;
      }

      try {
        await (memory as any).indexObservation({
          text: group.content,
          groupId: group.id,
          range: group.range,
          threadId: threadId ?? '',
          resourceId,
        });
        indexed++;
      } catch (err: any) {
        errors++;
        console.log(`\n    group ${group.id} ERROR: ${err.message}`);
      }
    }

    if (page === 0 || page % 10 === 0 || !result.hasMore) {
      const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
      const hashSummary = textHashCounts
        ? `, unique text hashes ${textHashCounts.size}, duplicate text groups ${Array.from(textHashCounts.values()).reduce((sum, count) => sum + Math.max(0, count - 1), 0)}`
        : '';
      console.log(
        `    ${label}: page ${page + 1}, messages ${scannedMessages}, groups ${emittedGroups}, open cycles ${state.openCycles.size}, rss ${rssMb}MB${hashSummary}`,
      );
    }

    if (!result.hasMore) break;
    page++;
  }

  if (textHashCounts && textHashSamples && hashRangeCounts && hashRangeSamples) {
    const textCounts = Array.from(textHashCounts.values());
    const duplicateHashes = textCounts.filter(count => count > 1).length;
    const duplicateGroups = textCounts.reduce((sum, count) => sum + Math.max(0, count - 1), 0);
    const topDuplicateHashes = Array.from(textHashSamples.entries())
      .map(([hash, sample]) => ({
        hash,
        count: sample.count,
        sampleGroupIds: sample.sampleGroupIds,
        sampleRanges: sample.sampleRanges,
        sampleContents: sample.sampleContents,
        sampleProvenance: sample.sampleProvenance,
      }))
      .filter(sample => sample.count > 1)
      .sort((a, b) => b.count - a.count || a.hash.localeCompare(b.hash))
      .slice(0, 10);

    const hashRangeCountsList = Array.from(hashRangeCounts.values());
    const duplicateHashRangeKeys = hashRangeCountsList.filter(count => count > 1).length;
    const duplicateHashRangeGroups = hashRangeCountsList.reduce((sum, count) => sum + Math.max(0, count - 1), 0);
    const topDuplicateHashRangeKeys = Array.from(hashRangeSamples.entries())
      .map(([hash, sample]) => ({
        hash,
        count: sample.count,
        sampleGroupIds: sample.sampleGroupIds,
        sampleRanges: sample.sampleRanges,
        sampleContents: sample.sampleContents,
        sampleProvenance: sample.sampleProvenance,
      }))
      .filter(sample => sample.count > 1)
      .sort((a, b) => b.count - a.count || a.hash.localeCompare(b.hash))
      .slice(0, 10);

    const textHashCollisionGroups = duplicateGroups - duplicateHashRangeGroups;
    const textHashCollisionHashes = Array.from(textHashSamples.entries()).filter(([hash, sample]) => {
      if (sample.count <= 1) {
        return false;
      }

      return sample.sampleRanges.some(range => {
        const compositeKey = `${hash}:${range}`;
        return (hashRangeCounts.get(compositeKey) ?? 0) === 1;
      });
    }).length;

    const report: HashOnlyReport = {
      resourceId,
      threadId,
      generatedAt: new Date().toISOString(),
      scannedMessages,
      emittedGroups,
      uniqueTextHashes: textHashCounts.size,
      duplicateTextHashes: duplicateHashes,
      duplicateTextGroups: duplicateGroups,
      uniqueHashRangeKeys: hashRangeCounts.size,
      duplicateHashRangeKeys,
      duplicateHashRangeGroups,
      textHashCollisionGroups,
      textHashCollisionHashes,
      topDuplicateTextHashes: topDuplicateHashes,
      topDuplicateHashRangeKeys,
    };

    const topCollisionWithDifferentProvenance = topDuplicateHashes.find(sample => {
      const markerTypes = new Set((sample.sampleProvenance ?? []).map(provenance => provenance.markerType));
      const matchTypes = new Set((sample.sampleProvenance ?? []).map(provenance => provenance.matchType));
      return markerTypes.size > 1 || matchTypes.size > 1;
    });

    const reportDir = path.join(getAppDataDir(), 'om-hash-reports');
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, `${resourceId}${threadId ? `-${threadId}` : ''}.json`);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    if (topCollisionWithDifferentProvenance) {
      console.log('    sample duplicate hash with differing provenance:');
      for (let index = 0; index < topCollisionWithDifferentProvenance.sampleProvenance!.length; index++) {
        const provenance = topCollisionWithDifferentProvenance.sampleProvenance![index];
        const range = topCollisionWithDifferentProvenance.sampleRanges[index] ?? '(missing range)';
        const groupId = topCollisionWithDifferentProvenance.sampleGroupIds[index] ?? '(missing group id)';
        console.log(
          `      [${index + 1}] range=${range} group=${groupId} marker=${provenance.markerType} match=${provenance.matchType} start=${provenance.startMessageId ?? '-'} end=${provenance.endMessageId}`,
        );
      }
    }

    return {
      indexed: 0,
      errors,
      scannedMessages,
      emittedGroups,
      uniqueHashes: textHashCounts.size,
      duplicateHashes,
      duplicateGroups,
      uniqueHashRangeKeys: hashRangeCounts.size,
      duplicateHashRangeKeys,
      duplicateHashRangeGroups,
      textHashCollisionGroups,
      textHashCollisionHashes,
      topDuplicateHashes,
      topDuplicateHashRangeKeys,
      hashOnlyReportPath: reportPath,
    };
  }

  return { indexed, errors, scannedMessages, emittedGroups };
}

// -- Main --

function getAppDataDir(): string {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'mastracode');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'mastracode');
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'mastracode');
}

function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    if (error?.code === 'EPERM') {
      return true;
    }
    return false;
  }
}

function tryBreakStaleLock(lockPath: string) {
  if (!fs.existsSync(lockPath)) {
    return false;
  }

  const ownerText = fs.readFileSync(lockPath, 'utf8').trim();
  if (!ownerText) {
    fs.unlinkSync(lockPath);
    return true;
  }

  try {
    const owner = JSON.parse(ownerText) as { pid?: number; workerMode?: boolean };
    if (!owner.workerMode && !isProcessAlive(owner.pid ?? -1)) {
      fs.unlinkSync(lockPath);
      return true;
    }
  } catch {
    fs.unlinkSync(lockPath);
    return true;
  }

  return false;
}

function acquireIndexLock(lockPath: string): IndexLock {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  let fd: number;
  try {
    fd = fs.openSync(lockPath, 'wx');
  } catch (error: any) {
    if (error?.code === 'EEXIST' && tryBreakStaleLock(lockPath)) {
      fd = fs.openSync(lockPath, 'wx');
    } else if (error?.code === 'EEXIST') {
      const owner = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, 'utf8').trim() : 'unknown process';
      throw new Error(`Indexing lock already held at ${lockPath}${owner ? ` by ${owner}` : ''}`);
    } else {
      throw error;
    }
  }

  const owner = JSON.stringify({
    pid: process.pid,
    startedAt: new Date().toISOString(),
    resourceId: RESOURCE_ID,
    workerMode: WORKER_MODE,
  });
  fs.writeFileSync(fd, `${owner}\n`, 'utf8');

  let released = false;
  const release = () => {
    if (released) {
      return;
    }
    released = true;
    try {
      fs.closeSync(fd);
    } catch {}
    try {
      fs.unlinkSync(lockPath);
    } catch {}
  };

  process.on('exit', release);
  process.on('SIGINT', () => {
    release();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    release();
    process.exit(143);
  });

  return { path: lockPath, release };
}

function summarizeProgressThreads(threads: Record<string, ProgressThreadState>) {
  const values = Object.values(threads);
  return {
    completed: values.filter(thread => thread.status === 'completed').length,
    failed: values.filter(thread => thread.status === 'failed').length,
    inProgress: values.filter(thread => thread.status === 'in_progress').length,
    pending: values.filter(thread => thread.status === 'pending').length,
  };
}

function readProgress(progressPath: string, resourceId: string): ProgressState {
  if (!fs.existsSync(progressPath)) {
    const now = new Date().toISOString();
    return {
      resourceId,
      startedAt: now,
      updatedAt: now,
      completed: 0,
      failed: 0,
      inProgress: 0,
      pending: 0,
      threads: {},
    };
  }

  const raw = fs.readFileSync(progressPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<ProgressState>;
  const threads = parsed.threads && typeof parsed.threads === 'object' ? parsed.threads : {};
  const counts = summarizeProgressThreads(threads);

  return {
    resourceId,
    startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString(),
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    completed: counts.completed,
    failed: counts.failed,
    inProgress: counts.inProgress,
    pending: counts.pending,
    threads,
  };
}

function writeProgress(progressPath: string, progress: ProgressState) {
  const counts = summarizeProgressThreads(progress.threads);
  const next = {
    ...progress,
    ...counts,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(progressPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function updateThreadProgress(
  progressPath: string,
  resourceId: string,
  threadId: string,
  state: ProgressThreadState,
): ProgressState {
  const progress = readProgress(progressPath, resourceId);
  progress.threads[threadId] = state;
  writeProgress(progressPath, progress);
  return readProgress(progressPath, resourceId);
}

function ensureThreadsTracked(
  progressPath: string,
  resourceId: string,
  threads: { id: string; title?: string | null }[],
) {
  const progress = readProgress(progressPath, resourceId);
  let changed = false;

  for (const thread of threads) {
    if (!progress.threads[thread.id]) {
      progress.threads[thread.id] = {
        status: 'pending',
        title: thread.title || '(untitled)',
        attempts: 0,
        indexed: 0,
        errors: 0,
        scannedMessages: 0,
        emittedGroups: 0,
        updatedAt: new Date().toISOString(),
      };
      changed = true;
      continue;
    }

    if (progress.threads[thread.id]!.title !== (thread.title || '(untitled)')) {
      progress.threads[thread.id]!.title = thread.title || '(untitled)';
      changed = true;
    }
  }

  if (changed) {
    writeProgress(progressPath, progress);
  }

  return readProgress(progressPath, resourceId);
}

function recoverStaleInProgressThreads(progressPath: string, resourceId: string): ProgressState {
  const progress = readProgress(progressPath, resourceId);
  let changed = false;

  for (const thread of Object.values(progress.threads)) {
    if (thread.status === 'in_progress') {
      thread.status = thread.attempts >= MAX_THREAD_ATTEMPTS ? 'failed' : 'pending';
      thread.failure = 'Recovered stale in_progress state after restart';
      thread.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    writeProgress(progressPath, progress);
  }

  return readProgress(progressPath, resourceId);
}

function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function shouldRetryThread(existing: ProgressThreadState | undefined) {
  if (!existing) {
    return true;
  }

  if (existing.status === 'completed' || existing.status === 'in_progress') {
    return false;
  }

  return existing.attempts < MAX_THREAD_ATTEMPTS;
}

function classifyWorkerFailure(result: {
  status: number | null;
  stderr?: string | null;
  stdout?: string | null;
  error?: Error | null;
  signal?: NodeJS.Signals | null;
}) {
  const combined = `${result.stderr ?? ''}\n${result.stdout ?? ''}\n${result.error?.message ?? ''}`;
  const lockRelated = /SQLITE_BUSY|SQLITE_BUSY_SNAPSHOT|database is locked|cannot commit transaction/i.test(combined);
  const crashRelated = /mutex lock failed|libc\+\+abi|SIGABRT|status 134/i.test(combined);
  const timeoutRelated = /ETIMEDOUT|timed out/i.test(combined) || result.signal === 'SIGTERM';

  return {
    lockRelated,
    crashRelated,
    timeoutRelated,
    retryable: lockRelated || crashRelated || timeoutRelated || result.status === 134 || result.status === 128,
    detail: combined.trim().split('\n').filter(Boolean).slice(-4).join(' | '),
  };
}

const cliArgs = process.argv.slice(2).filter(arg => arg !== '--hash-only');
const RESOURCE_ID = process.env.RESOURCE_ID || cliArgs[0] || 'mastra-96f658f9';
const THREAD_ID = process.env.THREAD_ID || cliArgs[1];
const WORKER_MODE = process.env.OM_INDEX_WORKER === '1';
const HASH_ONLY_MODE = process.env.OM_INDEX_HASH_ONLY === '1' || process.argv.includes('--hash-only');
const scriptPath = fileURLToPath(import.meta.url);
const workerExecArgv = process.execArgv.filter(arg => arg !== scriptPath && arg !== RESOURCE_ID && arg !== THREAD_ID);
const appDataDir = getAppDataDir();
const storageDbPath = `file:${path.join(appDataDir, 'mastra.db')}`;
const vectorDbPath = `file:${path.join(appDataDir, 'mastra-vectors.db')}`;
const progressPath = path.join(appDataDir, `om-index-${RESOURCE_ID}.progress.json`);
const MAX_THREAD_ATTEMPTS = Number(process.env.OM_INDEX_MAX_ATTEMPTS || '3');
const RETRY_BACKOFF_MS = Number(process.env.OM_INDEX_RETRY_BACKOFF_MS || '2000');
const THREAD_PAGE_SIZE = Number(process.env.OM_INDEX_PAGE_SIZE || '100');
const THREAD_TIMEOUT_MS = Number(process.env.OM_INDEX_THREAD_TIMEOUT_MS || String(15 * 60 * 1000));

function createMemory() {
  const storage = new LibSQLStore({ id: 'migration-storage', url: storageDbPath });
  const vectorStore = new LibSQLVector({ id: 'migration-vectors', url: vectorDbPath });

  return new Memory({
    storage,
    vector: vectorStore,
    embedder: fastembed.small,
  });
}

async function runThreadWorker(resourceId: string, threadId: string) {
  const memory = createMemory();
  const stats = await indexObservationGroupsFromMessages(memory, resourceId, threadId, `thread ${threadId}`);
  console.log(
    `WORKER_RESULT ${JSON.stringify({ threadId, ...stats } satisfies { threadId: string } & ThreadRunStats)}`,
  );
}

async function main() {
  if (WORKER_MODE) {
    console.log(`Storage DB: ${storageDbPath}`);
    console.log(`Vector DB:  ${vectorDbPath}`);
    console.log(`Resource:   ${RESOURCE_ID}`);
    console.log(`Mode:       ${HASH_ONLY_MODE ? 'hash-only' : 'index'}`);
    console.log();

    if (!THREAD_ID) {
      throw new Error('THREAD_ID is required when OM_INDEX_WORKER=1');
    }

    await runThreadWorker(RESOURCE_ID, THREAD_ID);
    return;
  }

  const lockPath = path.join(appDataDir, `om-index-${RESOURCE_ID}.lock`);
  const lock = acquireIndexLock(lockPath);

  console.log(`Storage DB: ${storageDbPath}`);
  console.log(`Vector DB:  ${vectorDbPath}`);
  console.log(`Resource:   ${RESOURCE_ID}`);
  console.log(`Mode:       ${HASH_ONLY_MODE ? 'hash-only' : 'index'}`);
  console.log(`Lock:       ${lock.path}`);
  console.log();

  try {
    const memory = createMemory();

    console.log(`Listing threads for resource: ${RESOURCE_ID}`);
    const { threads: allThreads } = await memory.listThreads({
      filter: { resourceId: RESOURCE_ID },
      perPage: false,
    });
    const threads = THREAD_ID ? allThreads.filter(thread => thread.id === THREAD_ID) : allThreads;
    console.log(`Found ${allThreads.length} threads${THREAD_ID ? `, selected ${threads.length}` : ''}\n`);

    let totalIndexed = 0;
    let progress = ensureThreadsTracked(progressPath, RESOURCE_ID, allThreads);
    progress = recoverStaleInProgressThreads(progressPath, RESOURCE_ID);

    console.log('Skipping resource-scoped scan; indexing per-thread only.');
    console.log(`Progress file: ${progressPath}`);
    if (progress.completed > 0 || progress.failed > 0 || progress.pending > 0 || progress.inProgress > 0) {
      console.log(
        `Queue state: ${progress.completed} completed, ${progress.failed} failed, ${progress.pending} pending, ${progress.inProgress} in_progress.`,
      );
    }
    console.log();

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i]!;
      const title = thread.title || '(untitled)';
      const existing = readProgress(progressPath, RESOURCE_ID).threads[thread.id];

      if (existing?.status === 'completed' && !HASH_ONLY_MODE) {
        totalIndexed += existing.indexed;
        console.log(`  [${i + 1}/${threads.length}] "${title}" (${thread.id})`);
        console.log(
          `    SKIP: already completed with ${existing.indexed}/${existing.emittedGroups} groups from ${existing.scannedMessages} messages`,
        );
        continue;
      }

      if (!HASH_ONLY_MODE && !shouldRetryThread(existing)) {
        console.log(`  [${i + 1}/${threads.length}] "${title}" (${thread.id})`);
        console.log(
          `    SKIP: attempts exhausted at ${existing?.attempts ?? 0}/${MAX_THREAD_ATTEMPTS}${existing?.failure ? ` — ${existing.failure}` : ''}`,
        );
        continue;
      }

      const attemptNumber = (existing?.attempts ?? 0) + 1;
      if (existing?.status === 'failed' && RETRY_BACKOFF_MS > 0) {
        console.log(`    BACKOFF: waiting ${RETRY_BACKOFF_MS}ms before retry`);
        sleep(RETRY_BACKOFF_MS);
      }
      updateThreadProgress(progressPath, RESOURCE_ID, thread.id, {
        status: 'in_progress',
        title,
        attempts: attemptNumber,
        indexed: existing?.indexed ?? 0,
        errors: existing?.errors ?? 0,
        scannedMessages: existing?.scannedMessages ?? 0,
        emittedGroups: existing?.emittedGroups ?? 0,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        failure: undefined,
      });

      console.log(`  [${i + 1}/${threads.length}] "${title}" (${thread.id})`);
      if (existing?.status === 'failed') {
        console.log(
          `    RETRY #${attemptNumber}: previous failure at ${existing.updatedAt}${existing.failure ? ` — ${existing.failure}` : ''}`,
        );
      } else {
        console.log(`    START: attempt ${attemptNumber}`);
      }

      const result = spawnSync(process.execPath, [...workerExecArgv, scriptPath, RESOURCE_ID, thread.id], {
        cwd: process.cwd(),
        env: { ...process.env, OM_INDEX_WORKER: '1', OM_INDEX_HASH_ONLY: HASH_ONLY_MODE ? '1' : '0' },
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 50,
        timeout: THREAD_TIMEOUT_MS,
      });

      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      if (result.stderr) {
        process.stderr.write(result.stderr);
      }

      if (result.status !== 0 || result.error || result.signal) {
        const failure = classifyWorkerFailure(result);
        const terminal = attemptNumber >= MAX_THREAD_ATTEMPTS || !failure.retryable;
        const statusLabel =
          result.error?.message || (result.signal ? `signal ${result.signal}` : `status ${result.status ?? 'unknown'}`);
        updateThreadProgress(progressPath, RESOURCE_ID, thread.id, {
          status: terminal ? 'failed' : 'pending',
          title,
          attempts: attemptNumber,
          indexed: 0,
          errors: 1,
          scannedMessages: 0,
          emittedGroups: 0,
          startedAt: existing?.startedAt,
          updatedAt: new Date().toISOString(),
          failure:
            `worker exited with ${statusLabel}` +
            (failure.detail ? ` — ${failure.detail}` : '') +
            (terminal ? '' : ' — scheduled for retry'),
        });
        console.log(
          `    ERROR: worker exited with ${statusLabel}` +
            (failure.retryable
              ? ` (retryable${terminal ? ', attempts exhausted' : ', queued for retry'})`
              : ' (non-retryable)'),
        );
        continue;
      }

      const workerLine = result.stdout?.split('\n').find(line => line.startsWith('WORKER_RESULT '));

      if (!workerLine) {
        const terminal = attemptNumber >= MAX_THREAD_ATTEMPTS;
        updateThreadProgress(progressPath, RESOURCE_ID, thread.id, {
          status: terminal ? 'failed' : 'pending',
          title,
          attempts: attemptNumber,
          indexed: 0,
          errors: 1,
          scannedMessages: 0,
          emittedGroups: 0,
          startedAt: existing?.startedAt,
          updatedAt: new Date().toISOString(),
          failure: `worker did not return summary stats${terminal ? '' : ' — scheduled for retry'}`,
        });
        console.log(`    ERROR: worker did not return summary stats${terminal ? '' : ' (queued for retry)'}`);
        continue;
      }

      const stats = JSON.parse(workerLine.slice('WORKER_RESULT '.length)) as { threadId: string } & ThreadRunStats;
      totalIndexed += HASH_ONLY_MODE ? stats.emittedGroups : stats.indexed;
      updateThreadProgress(progressPath, RESOURCE_ID, thread.id, {
        status: 'completed',
        title,
        attempts: attemptNumber,
        indexed: stats.indexed,
        errors: stats.errors,
        scannedMessages: stats.scannedMessages,
        emittedGroups: stats.emittedGroups,
        startedAt: existing?.startedAt,
        updatedAt: new Date().toISOString(),
        failure: undefined,
      });

      console.log(
        HASH_ONLY_MODE
          ? `    ${stats.emittedGroups} groups from ${stats.scannedMessages} messages, ${stats.uniqueHashes ?? 0} unique text hashes, ${stats.duplicateHashes ?? 0} repeated text hashes, ${stats.duplicateGroups ?? 0} duplicate text groups, ${stats.uniqueHashRangeKeys ?? 0} unique text-hash+range keys, ${stats.duplicateHashRangeKeys ?? 0} repeated text-hash+range keys` +
              (stats.emittedGroups === 0 ? ' (no observation groups)' : '')
          : `    ${stats.indexed}/${stats.emittedGroups} groups indexed from ${stats.scannedMessages} messages` +
              (stats.errors > 0 ? ` (${stats.errors} group errors skipped)` : '') +
              (stats.emittedGroups === 0 ? ' (no observation groups)' : ''),
      );

      if (HASH_ONLY_MODE) {
        if (stats.hashOnlyReportPath) {
          console.log(`    JSON report: ${stats.hashOnlyReportPath}`);
        }
        if (typeof stats.textHashCollisionGroups === 'number' && typeof stats.duplicateGroups === 'number') {
          console.log(
            `    Text-hash collisions across different ranges: ${stats.textHashCollisionGroups}/${stats.duplicateGroups} duplicate groups`,
          );
        }
        if (stats.topDuplicateHashes?.length) {
          console.log('    Top repeated text hashes:');
          for (const sample of stats.topDuplicateHashes) {
            console.log(
              `      ${truncateHash(sample.hash)} × ${sample.count} | groups: ${sample.sampleGroupIds.join(', ') || '-'} | ranges: ${sample.sampleRanges.join(', ') || '-'}`,
            );
          }
        }
        if (stats.topDuplicateHashRangeKeys?.length) {
          console.log('    Top repeated text-hash+range keys:');
          for (const sample of stats.topDuplicateHashRangeKeys) {
            console.log(
              `      ${truncateHash(sample.hash)} × ${sample.count} | groups: ${sample.sampleGroupIds.join(', ') || '-'} | ranges: ${sample.sampleRanges.join(', ') || '-'}`,
            );
          }
        }
      }
    }

    const finalProgress = readProgress(progressPath, RESOURCE_ID);
    console.log(
      `\nDone! ${HASH_ONLY_MODE ? `Hashed ${totalIndexed} indexed-groups-equivalent observations` : `Indexed ${totalIndexed} observation groups`}.`,
    );
    console.log(
      `Progress summary: ${finalProgress.completed} completed, ${finalProgress.failed} failed, ${finalProgress.pending} pending, ${finalProgress.inProgress} in_progress.`,
    );
    process.exit(0);
  } finally {
    lock.release();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
