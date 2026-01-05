import chalk from 'chalk';
import { join } from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { xxh64 } from '@node-rs/xxhash';

import { DatasetLoader } from '../data/loader';
import type { DatasetType } from '../data/types';

export interface ObscureThreadIdsOptions {
  dataset: DatasetType;
  memoryConfig: string;
  preparedDataDir: string;
  dryRun?: boolean;
}

/**
 * Hash a thread ID using xxhash to create an opaque, non-reversible identifier.
 * This prevents LLMs from recognizing patterns like "answer_" in thread IDs.
 */
function hashThreadId(threadId: string): string {
  return xxh64(threadId).toString(16);
}

/**
 * Replace all thread IDs in a string with their hashed versions.
 * Handles patterns like:
 * - <thread id="...">  
 * - <other-conversation id="...">
 * - thread_id: "..."
 */
function replaceThreadIds(
  content: string,
  threadIdMap: Map<string, string>,
): { content: string; replacements: number } {
  let replacements = 0;

  // Replace <thread id="..."> patterns
  let result = content.replace(
    /<thread\s+id="([^"]+)"/g,
    (match, threadId) => {
      const hashed = threadIdMap.get(threadId);
      if (hashed && hashed !== threadId) {
        replacements++;
        return `<thread id="${hashed}"`;
      }
      return match;
    },
  );

  // Replace <other-conversation id="..."> patterns
  result = result.replace(
    /<other-conversation\s+id="([^"]+)"/g,
    (match, threadId) => {
      const hashed = threadIdMap.get(threadId);
      if (hashed && hashed !== threadId) {
        replacements++;
        return `<other-conversation id="${hashed}"`;
      }
      return match;
    },
  );

  // Replace thread_id: "..." patterns (in JSON)
  result = result.replace(
    /"thread_id":\s*"([^"]+)"/g,
    (match, threadId) => {
      const hashed = threadIdMap.get(threadId);
      if (hashed && hashed !== threadId) {
        replacements++;
        return `"thread_id": "${hashed}"`;
      }
      return match;
    },
  );

  return { content: result, replacements };
}

export class ObscureThreadIdsCommand {
  async run(options: ObscureThreadIdsOptions): Promise<void> {
    const { dataset, memoryConfig, preparedDataDir, dryRun } = options;

    console.log(chalk.bold('\n🔐 Obscure Thread IDs in Prepared Data\n'));
    console.log(chalk.gray(`Dataset: ${dataset}`));
    console.log(chalk.gray(`Memory config: ${memoryConfig}`));
    console.log(chalk.gray(`Prepared data: ${preparedDataDir}`));
    if (dryRun) {
      console.log(chalk.yellow('\n⚠️  DRY RUN - no files will be modified\n'));
    }

    // Load the source dataset to get all session IDs
    console.log(chalk.gray(`\nLoading dataset to extract session IDs...`));
    const loader = new DatasetLoader();
    const questions = await loader.loadDataset(dataset);

    // Build a map of all session IDs -> hashed versions
    const threadIdMap = new Map<string, string>();
    let sessionCount = 0;

    for (const question of questions) {
      // Each question has haystack_session_ids
      if (question.haystack_session_ids) {
        for (const sessionId of question.haystack_session_ids) {
          if (sessionId && !threadIdMap.has(sessionId)) {
            threadIdMap.set(sessionId, hashThreadId(sessionId));
            sessionCount++;
          }
        }
      }
      // Also include answer_session_ids
      if (question.answer_session_ids) {
        for (const sessionId of question.answer_session_ids) {
          if (sessionId && !threadIdMap.has(sessionId)) {
            threadIdMap.set(sessionId, hashThreadId(sessionId));
            sessionCount++;
          }
        }
      }
    }

    console.log(chalk.gray(`Found ${sessionCount} unique session IDs to hash\n`));

    // Show some examples
    console.log(chalk.gray('Example mappings:'));
    let exampleCount = 0;
    for (const [original, hashed] of threadIdMap) {
      if (exampleCount >= 5) break;
      console.log(chalk.gray(`  ${original} → ${hashed}`));
      exampleCount++;
    }
    console.log('');

    // Find prepared data directory
    const preparedDir = join(preparedDataDir, dataset, memoryConfig);

    if (!existsSync(preparedDir)) {
      console.error(chalk.red(`No prepared data found at: ${preparedDir}`));
      console.error(chalk.gray(`Run 'longmemeval prepare' first`));
      process.exit(1);
    }

    // Get all question directories
    const questionDirs = await readdir(preparedDir);

    let filesModified = 0;
    let totalReplacements = 0;
    let filesSkipped = 0;

    for (const questionDir of questionDirs) {
      const omPath = join(preparedDir, questionDir, 'om.json');

      if (!existsSync(omPath)) {
        filesSkipped++;
        continue;
      }

      try {
        const content = await readFile(omPath, 'utf-8');
        const { content: newContent, replacements } = replaceThreadIds(content, threadIdMap);

        if (replacements > 0) {
          if (!dryRun) {
            await writeFile(omPath, newContent, 'utf-8');
          }
          filesModified++;
          totalReplacements += replacements;
          console.log(
            chalk.green(`  ✓ ${questionDir}: ${replacements} thread ID(s) replaced`),
          );
        } else {
          filesSkipped++;
        }
      } catch (error) {
        console.error(chalk.red(`  ✗ ${questionDir}: Error processing file`));
        console.error(chalk.gray(`    ${error}`));
      }
    }

    // Summary
    console.log('');
    console.log(chalk.bold('Summary:'));
    console.log(chalk.gray(`  Files modified: ${filesModified}`));
    console.log(chalk.gray(`  Total replacements: ${totalReplacements}`));
    console.log(chalk.gray(`  Files skipped: ${filesSkipped}`));

    if (dryRun && filesModified > 0) {
      console.log(chalk.yellow(`\n⚠️  Run without --dry-run to apply changes`));
    }
  }
}
