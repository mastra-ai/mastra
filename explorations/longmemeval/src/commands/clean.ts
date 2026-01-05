import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';

import { DatasetLoader } from '../data/loader';
import type { DatasetType, MemoryConfigType } from '../data/types';

export interface CleanOptions {
  dataset: DatasetType;
  memoryConfig: MemoryConfigType;
  preparedDataDir?: string;
  offset?: number;
  subset?: number;
  questionId?: string;
  dryRun?: boolean;
}

export class CleanCommand {
  private preparedDataDir: string;
  private loader: DatasetLoader;

  constructor() {
    this.preparedDataDir = './prepared-data';
    this.loader = new DatasetLoader();
  }

  async run(options: CleanOptions): Promise<void> {
    const preparedDir = join(options.preparedDataDir || this.preparedDataDir, options.dataset, options.memoryConfig);

    if (!existsSync(preparedDir)) {
      console.log(chalk.yellow(`No prepared data found at: ${preparedDir}`));
      return;
    }

    // Load original dataset to get correct question order
    const spinner = ora('Loading dataset for ordering...').start();
    const originalQuestions = await this.loader.loadDataset(options.dataset);
    const questionIdOrder = new Map(originalQuestions.map((q, i) => [q.question_id, i]));
    spinner.succeed(`Loaded ${originalQuestions.length} questions`);

    // Get all prepared question directories
    const questionDirs = await readdir(preparedDir);
    
    // Sort by original dataset order
    const sortedDirs = questionDirs
      .filter(dir => questionIdOrder.has(dir))
      .sort((a, b) => {
        const orderA = questionIdOrder.get(a) ?? Infinity;
        const orderB = questionIdOrder.get(b) ?? Infinity;
        return orderA - orderB;
      });

    // Determine which to delete
    let toDelete: string[] = [];

    if (options.questionId) {
      // Delete specific question
      if (sortedDirs.includes(options.questionId)) {
        toDelete = [options.questionId];
      } else {
        console.log(chalk.yellow(`Question ${options.questionId} not found in prepared data`));
        return;
      }
    } else {
      // Apply offset and subset
      const offset = options.offset || 0;
      let selected = sortedDirs.slice(offset);
      
      if (options.subset) {
        selected = selected.slice(0, options.subset);
      }
      
      toDelete = selected;
    }

    if (toDelete.length === 0) {
      console.log(chalk.yellow('No questions to delete'));
      return;
    }

    // Show what will be deleted
    const offset = options.offset || 0;
    console.log(
      chalk.yellow(`\n${options.dryRun ? '[DRY RUN] Would delete' : 'Deleting'} ${toDelete.length} prepared question(s):`),
    );
    console.log(chalk.gray(`  Range: ${offset + 1}-${offset + toDelete.length} of ${sortedDirs.length} total\n`));

    // Show first few and last few
    const showCount = 3;
    if (toDelete.length <= showCount * 2) {
      for (const id of toDelete) {
        const idx = questionIdOrder.get(id)! + 1;
        console.log(chalk.gray(`  ${idx}. ${id}`));
      }
    } else {
      for (let i = 0; i < showCount; i++) {
        const id = toDelete[i];
        const idx = questionIdOrder.get(id)! + 1;
        console.log(chalk.gray(`  ${idx}. ${id}`));
      }
      console.log(chalk.gray(`  ... (${toDelete.length - showCount * 2} more)`));
      for (let i = toDelete.length - showCount; i < toDelete.length; i++) {
        const id = toDelete[i];
        const idx = questionIdOrder.get(id)! + 1;
        console.log(chalk.gray(`  ${idx}. ${id}`));
      }
    }

    if (options.dryRun) {
      console.log(chalk.cyan('\n[DRY RUN] No files deleted. Remove --dry-run to actually delete.'));
      return;
    }

    // Delete the directories
    const deleteSpinner = ora('Deleting...').start();
    let deleted = 0;
    for (const id of toDelete) {
      const dirPath = join(preparedDir, id);
      await rm(dirPath, { recursive: true, force: true });
      deleted++;
      deleteSpinner.text = `Deleting... ${deleted}/${toDelete.length}`;
    }
    deleteSpinner.succeed(`Deleted ${deleted} prepared question(s)`);
  }
}
