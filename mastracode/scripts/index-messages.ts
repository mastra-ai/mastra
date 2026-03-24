#!/usr/bin/env npx tsx
/**
 * One-time migration script to index MastraCode's existing observation groups
 * into the vector store for semantic search via recall mode="search".
 *
 * Reads activeObservations from each thread's OM record, parses observation groups,
 * and embeds each group's content with its range metadata.
 *
 * Usage:
 *   npx tsx scripts/index-messages.ts [resource-id]
 */

import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';
import { Memory } from '@mastra/memory';
import crypto from 'crypto';
import os from 'os';
import path from 'path';

// -- Inline observation group parsing (not exported from memory dist) --

const OBSERVATION_GROUP_PATTERN = /<observation-group\s([^>]*)>([\s\S]*?)<\/observation-group>/g;
const ATTRIBUTE_PATTERN = /([\w][\w-]*)="([^"]*)"/g;
const DATE_HEADER_PATTERN = /^Date:\s.+$/gm;

function parseObservationGroupAttributes(attributeString: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of attributeString.matchAll(ATTRIBUTE_PATTERN)) {
    const [, key, value] = match;
    if (key && value !== undefined) attributes[key] = value;
  }
  return attributes;
}

function parseObservationGroups(observations: string): Array<{ id: string; range: string; content: string }> {
  if (!observations) return [];
  const groups: Array<{ id: string; range: string; content: string }> = [];
  let match: RegExpExecArray | null;
  OBSERVATION_GROUP_PATTERN.lastIndex = 0;
  while ((match = OBSERVATION_GROUP_PATTERN.exec(observations)) !== null) {
    const attributes = parseObservationGroupAttributes(match[1] ?? '');
    const id = attributes.id;
    const range = attributes.range;
    if (!id || !range) continue;
    groups.push({ id, range, content: match[2]!.trim() });
  }
  return groups;
}

function stripObservationGroups(observations: string): string {
  OBSERVATION_GROUP_PATTERN.lastIndex = 0;
  return observations.replace(OBSERVATION_GROUP_PATTERN, '').trim();
}

function buildLegacyGroupId(threadId: string | null, dateHeader: string, content: string): string {
  return crypto
    .createHash('sha1')
    .update(`${threadId ?? 'resource'}\n${dateHeader}\n${content}`)
    .digest('hex')
    .slice(0, 16);
}

function parseLegacyObservationGroups(
  observations: string,
  threadId: string | null,
): Array<{ id: string; range: string; content: string }> {
  const plainText = stripObservationGroups(observations);
  if (!plainText) return [];

  const matches = Array.from(plainText.matchAll(DATE_HEADER_PATTERN));
  if (matches.length === 0) {
    const content = plainText.trim();
    if (!content) return [];
    return [
      {
        id: buildLegacyGroupId(threadId, 'legacy', content),
        range: '',
        content,
      },
    ];
  }

  const groups: Array<{ id: string; range: string; content: string }> = [];

  for (let index = 0; index < matches.length; index++) {
    const current = matches[index];
    if (!current) continue;

    const start = current.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1]!.index ?? plainText.length) : plainText.length;
    const block = plainText.slice(start, end).trim();
    if (!block) continue;

    const lines = block.split('\n');
    const dateHeader = lines[0]?.trim() ?? 'legacy';
    const content = block.trim();
    if (!content) continue;

    groups.push({
      id: buildLegacyGroupId(threadId, dateHeader, content),
      range: '',
      content,
    });
  }

  return groups;
}

type ParsedGroup = {
  id: string;
  range: string;
  content: string;
  threadId: string | null;
};

function collectUniqueGroups(
  threadId: string | null,
  observationsList: string[],
): { groups: ParsedGroup[]; duplicateCount: number } {
  const seen = new Set<string>();
  const groups: ParsedGroup[] = [];
  let duplicateCount = 0;

  for (const observations of observationsList) {
    const parsedGroups = [...parseObservationGroups(observations), ...parseLegacyObservationGroups(observations, threadId)];

    for (const group of parsedGroups) {
      const dedupeKey = `${threadId ?? 'resource'}:${group.id}:${group.range}:${group.content}`;
      if (seen.has(dedupeKey)) {
        duplicateCount++;
        continue;
      }

      seen.add(dedupeKey);
      groups.push({ ...group, threadId });
    }
  }

  return { groups, duplicateCount };
}

async function getAllObservationalMemoryTexts(
  memoryStore: any,
  threadId: string | null,
  resourceId: string,
): Promise<{ texts: string[]; error: Error | null }> {
  try {
    const records = await memoryStore.getObservationalMemoryHistory(threadId, resourceId, 1000);
    return {
      texts: records
        .map((record: any) => record.activeObservations)
        .filter((value: unknown): value is string => Boolean(value)),
      error: null,
    };
  } catch (error) {
    return {
      texts: [],
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// -- Main --

function getAppDataDir(): string {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'mastracode');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'mastracode');
  }
  return path.join(os.homedir(), '.local', 'share', 'mastracode');
}

const RESOURCE_ID = process.env.RESOURCE_ID || process.argv[2] || 'mastra-96f658f9';
const appDataDir = getAppDataDir();
const storageDbPath = `file:${path.join(appDataDir, 'mastra.db')}`;
const vectorDbPath = `file:${path.join(appDataDir, 'mastra-vectors.db')}`;

async function main() {
  console.log(`Storage DB: ${storageDbPath}`);
  console.log(`Vector DB:  ${vectorDbPath}`);
  console.log(`Resource:   ${RESOURCE_ID}`);
  console.log();

  const storage = new LibSQLStore({ id: 'migration-storage', url: storageDbPath });
  const vectorStore = new LibSQLVector({ id: 'migration-vectors', url: vectorDbPath });

  const memory = new Memory({
    storage,
    vector: vectorStore,
    embedder: fastembed.small,
  });

  const memoryStore = await (memory as any).getMemoryStore();

  // List all threads for the resource
  console.log(`Listing threads for resource: ${RESOURCE_ID}`);
  const { threads } = await memory.listThreads({
    filter: { resourceId: RESOURCE_ID },
    perPage: false,
  });
  console.log(`Found ${threads.length} threads\n`);

  // Also scan all resource-scoped OM generations (threadId = null)
  let resourceGroups: ParsedGroup[] = [];
  const resourceObservationResult = await getAllObservationalMemoryTexts(memoryStore, null, RESOURCE_ID);
  if (resourceObservationResult.error) {
    console.log(`Warning: failed to read resource-scoped OM history: ${resourceObservationResult.error.message}\n`);
  } else {
    const resourceCollection = collectUniqueGroups(null, resourceObservationResult.texts);
    resourceGroups = resourceCollection.groups;
    console.log(
      `Found ${resourceGroups.length} unique observation groups in ${resourceObservationResult.texts.length} resource-scoped OM records` +
        (resourceCollection.duplicateCount > 0 ? ` (${resourceCollection.duplicateCount} duplicates skipped)` : '') +
        `\n`,
    );
  }

  let totalIndexed = 0;

  // Index resource-scoped observation groups
  if (resourceGroups.length > 0) {
    console.log(`Indexing ${resourceGroups.length} resource-scoped observation groups...`);
    for (let i = 0; i < resourceGroups.length; i++) {
      const group = resourceGroups[i]!;
      process.stdout.write(`  [${i + 1}/${resourceGroups.length}] group ${group.id}... `);
      try {
        await (memory as any).indexObservation({
          text: group.content,
          groupId: group.id,
          range: group.range,
          threadId: '', // resource-scoped, no specific thread
          resourceId: RESOURCE_ID,
        });
        totalIndexed++;
        console.log('done');
      } catch (err: any) {
        console.log(`ERROR: ${err.message}`);
      }
    }
    console.log();
  }

  // Index thread-scoped observation groups from all OM generations
  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i]!;
    const title = thread.title || '(untitled)';
    process.stdout.write(`  [${i + 1}/${threads.length}] "${title}" (${thread.id})... `);

    try {
      const observationResult = await getAllObservationalMemoryTexts(memoryStore, thread.id, RESOURCE_ID);
      if (observationResult.error) {
        console.log(`ERROR: failed to read OM history: ${observationResult.error.message}`);
        continue;
      }

      if (observationResult.texts.length === 0) {
        console.log('no observations');
        continue;
      }

      const { groups, duplicateCount } = collectUniqueGroups(thread.id, observationResult.texts);
      if (groups.length === 0) {
        console.log('no observation groups');
        continue;
      }

      for (const group of groups) {
        await (memory as any).indexObservation({
          text: group.content,
          groupId: group.id,
          range: group.range,
          threadId: thread.id,
          resourceId: RESOURCE_ID,
        });
        totalIndexed++;
      }

      console.log(
        `${groups.length} groups from ${observationResult.texts.length} OM records` +
          (duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : ''),
      );
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  console.log(`\nDone! Indexed ${totalIndexed} observation groups.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
