import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

interface ListPartialOptions {
  preparedDataDir?: string;
}

interface PartialQuestion {
  questionId: string;
  processedSessions: number;
  totalSessions?: number;
  failed: boolean;
  failedAt?: string;
  error?: string;
}

/**
 * Lists partially prepared questions (have progress.json but no meta.json or failed)
 */
export class ListPartialCommand {
  private preparedDataDir: string;

  constructor(options: ListPartialOptions) {
    this.preparedDataDir =
      options.preparedDataDir || join(process.cwd(), 'prepared-data', 'longmemeval_s', 'observational-memory');
  }

  async run(): Promise<void> {
    console.log(chalk.blue('\n🔍 Scanning for partially prepared questions...\n'));

    if (!existsSync(this.preparedDataDir)) {
      console.log(chalk.yellow(`Directory not found: ${this.preparedDataDir}`));
      return;
    }

    const questionDirs = (await readdir(this.preparedDataDir)).filter(d => !d.startsWith('.'));

    const partialQuestions: PartialQuestion[] = [];
    const failedQuestions: PartialQuestion[] = [];

    for (const questionId of questionDirs) {
      const questionDir = join(this.preparedDataDir, questionId);
      const progressPath = join(questionDir, 'progress.json');
      const metaPath = join(questionDir, 'meta.json');

      // Skip if fully prepared (has meta.json)
      if (existsSync(metaPath)) {
        continue;
      }

      // Check if has progress.json
      if (existsSync(progressPath)) {
        try {
          const progress = JSON.parse(await readFile(progressPath, 'utf-8'));
          const info: PartialQuestion = {
            questionId,
            processedSessions: progress.processedSessionIds?.length || 0,
            totalSessions: progress.totalSessions,
            failed: progress.failed || false,
            failedAt: progress.failedAt,
            error: progress.error,
          };

          if (info.failed) {
            failedQuestions.push(info);
          } else {
            partialQuestions.push(info);
          }
        } catch (e) {
          // Corrupted progress file
          partialQuestions.push({
            questionId,
            processedSessions: 0,
            failed: false,
          });
        }
      }
    }

    // Display results
    if (failedQuestions.length > 0) {
      console.log(chalk.red(`❌ Failed questions (${failedQuestions.length}):\n`));
      for (const q of failedQuestions) {
        const progress = q.totalSessions
          ? `${q.processedSessions}/${q.totalSessions} sessions`
          : `${q.processedSessions} sessions`;
        console.log(`  ${chalk.red(q.questionId)} - ${progress}`);
        if (q.error) {
          console.log(chalk.gray(`    Error: ${q.error}`));
        }
        if (q.failedAt) {
          console.log(chalk.gray(`    Failed at: ${q.failedAt}`));
        }
      }
      console.log();
    }

    if (partialQuestions.length > 0) {
      console.log(chalk.yellow(`⏳ Partially prepared questions (${partialQuestions.length}):\n`));
      for (const q of partialQuestions) {
        const progress = q.totalSessions
          ? `${q.processedSessions}/${q.totalSessions} sessions`
          : `${q.processedSessions} sessions`;
        console.log(`  ${chalk.yellow(q.questionId)} - ${progress}`);
      }
      console.log();
    }

    if (failedQuestions.length === 0 && partialQuestions.length === 0) {
      console.log(chalk.green('✓ No partially prepared or failed questions found.\n'));
    } else {
      // Print summary with actionable commands
      console.log(chalk.blue('─'.repeat(50)));
      console.log(chalk.white('\nTo resume preparation:'));
      
      const allIds = [...failedQuestions, ...partialQuestions].map(q => q.questionId);
      if (allIds.length === 1) {
        console.log(chalk.gray(`  pnpm prepare -q ${allIds[0]}`));
      } else {
        console.log(chalk.gray(`  pnpm prepare  # will auto-resume all`));
      }

      console.log(chalk.white('\nTo clean and re-prepare:'));
      if (allIds.length <= 3) {
        for (const id of allIds) {
          console.log(chalk.gray(`  pnpm clean -q ${id} && pnpm prepare -q ${id}`));
        }
      } else {
        console.log(chalk.gray(`  # Clean specific questions:`));
        console.log(chalk.gray(`  pnpm clean -q <question_id>`));
      }
      console.log();
    }
  }
}
