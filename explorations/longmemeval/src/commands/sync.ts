import chalk from 'chalk';
import { join } from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

import { DatasetLoader } from '../data/loader';
import type { LongMemEvalQuestion, DatasetType } from '../data/types';

export interface SyncOptions {
  dataset: DatasetType;
  memoryConfig: string;
  preparedDataDir: string;
}

export class SyncCommand {
  async run(options: SyncOptions): Promise<void> {
    const { dataset, memoryConfig, preparedDataDir } = options;

    // Load the source dataset
    console.log(chalk.gray(`Loading dataset: ${dataset}...`));
    const loader = new DatasetLoader();
    const questions = await loader.loadDataset(dataset);

    // Create a map for quick lookup by question_id
    const questionMap = new Map<string, LongMemEvalQuestion>();
    for (const q of questions) {
      questionMap.set(q.question_id, q);
    }

    console.log(chalk.gray(`Loaded ${questions.length} questions from dataset\n`));

    // Find prepared data directory
    const preparedDir = join(preparedDataDir, dataset, memoryConfig);

    if (!existsSync(preparedDir)) {
      console.error(chalk.red(`No prepared data found at: ${preparedDir}`));
      console.error(chalk.gray(`Run 'longmemeval prepare' first`));
      process.exit(1);
    }

    // Get all question directories
    const questionDirs = await readdir(preparedDir);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const questionDir of questionDirs) {
      const metaPath = join(preparedDir, questionDir, 'meta.json');

      if (!existsSync(metaPath)) {
        continue;
      }

      // Load existing meta.json
      const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
      const questionId = meta.questionId;

      // Find the source question
      const sourceQuestion = questionMap.get(questionId);

      if (!sourceQuestion) {
        console.log(chalk.yellow(`⚠ Question not found in dataset: ${questionId}`));
        notFound++;
        continue;
      }

      // Check if there are updates to sync
      const hasImprovedQuestion = sourceQuestion.improved_question !== undefined;
      const hasImprovedAnswer = sourceQuestion.improved_answer !== undefined;
      const hasImprovementNote = sourceQuestion.improvement_note !== undefined;
      const hasRequiresRetry = sourceQuestion.requires_retry !== undefined;
      const hasFailureCategory = sourceQuestion.failure_category !== undefined;

      const needsUpdate =
        meta.improvedQuestion !== sourceQuestion.improved_question ||
        meta.improvedAnswer !== sourceQuestion.improved_answer ||
        meta.improvementNote !== sourceQuestion.improvement_note ||
        meta.requiresRetry !== sourceQuestion.requires_retry ||
        meta.failureCategory !== sourceQuestion.failure_category;

      if (!needsUpdate) {
        skipped++;
        continue;
      }

      // Update meta with improved fields
      if (hasImprovedQuestion) {
        meta.improvedQuestion = sourceQuestion.improved_question;
      } else {
        delete meta.improvedQuestion;
      }

      if (hasImprovedAnswer) {
        meta.improvedAnswer = sourceQuestion.improved_answer;
      } else {
        delete meta.improvedAnswer;
      }

      if (hasImprovementNote) {
        meta.improvementNote = sourceQuestion.improvement_note;
      } else {
        delete meta.improvementNote;
      }

      if (hasRequiresRetry) {
        meta.requiresRetry = sourceQuestion.requires_retry;
      } else {
        delete meta.requiresRetry;
      }

      if (hasFailureCategory) {
        meta.failureCategory = sourceQuestion.failure_category;
      } else {
        delete meta.failureCategory;
      }

      // Write updated meta.json
      await writeFile(metaPath, JSON.stringify(meta, null, 2));

      // Log the update
      if (hasImprovedQuestion || hasImprovedAnswer || hasImprovementNote || hasRequiresRetry || hasFailureCategory) {
        console.log(
          chalk.green(`✓ ${questionId}`),
          hasImprovedQuestion ? chalk.cyan('(improved_question)') : '',
          hasImprovedAnswer ? chalk.magenta('(improved_answer)') : '',
          hasImprovementNote ? chalk.yellow('(improvement_note)') : '',
          hasRequiresRetry ? chalk.blue('(requires_retry)') : '',
          hasFailureCategory ? chalk.red(`(${sourceQuestion.failure_category})`) : '',
        );
      } else {
        console.log(chalk.gray(`○ ${questionId} (cleared improved fields)`));
      }

      updated++;
    }

    // Summary
    console.log(chalk.bold('\n─────────────────────────────────'));
    console.log(chalk.bold('Sync Summary:'));
    console.log(chalk.green(`  Updated: ${updated}`));
    console.log(chalk.gray(`  Skipped (no changes): ${skipped}`));
    if (notFound > 0) {
      console.log(chalk.yellow(`  Not found in dataset: ${notFound}`));
    }
    console.log(chalk.bold('─────────────────────────────────\n'));

    // Show count of questions with improved fields in dataset
    const withImproved = questions.filter(q => q.improved_question || q.improved_answer).length;
    console.log(
      chalk.gray(`Dataset has ${withImproved} questions with improved_question or improved_answer fields`),
    );
  }
}
