import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

interface DeterministicIdsOptions {
  preparedDataDir?: string;
  questionId?: string;
}

/**
 * Makes message IDs deterministic for a single om.json file.
 * Format: {thread_id}_msg_{index}
 * @returns Number of IDs updated
 */
export async function makeDeterministicIds(omJsonPath: string): Promise<number> {
  const content = await readFile(omJsonPath, 'utf-8');
  const data = JSON.parse(content);

  if (!data.messages || !Array.isArray(data.messages)) {
    return 0;
  }

  // Group messages by thread_id to get proper indices
  const messagesByThread = new Map<string, Array<{ index: number; entry: [string, any] }>>();

  for (let i = 0; i < data.messages.length; i++) {
    const entry = data.messages[i] as [string, any];
    const message = entry[1];
    const threadId = message.thread_id;

    if (!messagesByThread.has(threadId)) {
      messagesByThread.set(threadId, []);
    }
    messagesByThread.get(threadId)!.push({ index: i, entry });
  }

  // Update IDs to be deterministic
  let updatedCount = 0;

  for (const [threadId, messages] of messagesByThread) {
    // Sort by createdAt to ensure consistent ordering
    messages.sort((a, b) => {
      const dateA = new Date(a.entry[1].createdAt).getTime();
      const dateB = new Date(b.entry[1].createdAt).getTime();
      return dateA - dateB;
    });

    for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
      const { index, entry } = messages[msgIdx];
      const newId = `${threadId}_msg_${msgIdx}`;
      const oldId = entry[0];

      if (oldId !== newId) {
        // Update both the key and the id field
        data.messages[index] = [newId, { ...entry[1], id: newId }];
        updatedCount++;
      }
    }
  }

  if (updatedCount > 0) {
    await writeFile(omJsonPath, JSON.stringify(data, null, 2));
  }

  return updatedCount;
}

/**
 * Updates message IDs in prepared data to be deterministic.
 * Format: {thread_id}_msg_{index}
 */
export class DeterministicIdsCommand {
  private preparedDataDir: string;
  private questionId?: string;

  constructor(options: DeterministicIdsOptions) {
    this.preparedDataDir =
      options.preparedDataDir || join(process.cwd(), 'prepared-data', 'longmemeval_s', 'observational-memory');
    this.questionId = options.questionId;
  }

  async run(): Promise<void> {
    console.log(chalk.blue('\n📋 Making message IDs deterministic...\n'));

    // Get list of question directories
    let questionDirs: string[];

    if (this.questionId) {
      questionDirs = [this.questionId];
    } else {
      questionDirs = await readdir(this.preparedDataDir);
      questionDirs = questionDirs.filter(d => !d.startsWith('.'));
    }

    let totalUpdated = 0;
    let totalMessages = 0;

    for (const questionDir of questionDirs) {
      const omJsonPath = join(this.preparedDataDir, questionDir, 'om.json');

      try {
        const updatedCount = await makeDeterministicIds(omJsonPath);

        // Count total messages for stats
        const content = await readFile(omJsonPath, 'utf-8');
        const data = JSON.parse(content);
        totalMessages += data.messages?.length || 0;

        if (updatedCount > 0) {
          console.log(chalk.green(`  ✓ ${questionDir}: updated ${updatedCount} message IDs`));
          totalUpdated += updatedCount;
        } else {
          console.log(chalk.gray(`  - ${questionDir}: already deterministic`));
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log(chalk.yellow(`  ⚠ ${questionDir}: no om.json found`));
        } else {
          console.log(chalk.red(`  ✗ ${questionDir}: ${error.message}`));
        }
      }
    }

    console.log(chalk.blue(`\n✓ Updated ${totalUpdated} of ${totalMessages} message IDs\n`));
  }
}
