import { readdir, readFile, unlink, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface FailedQuestion {
  questionId: string;
  dataset: string;
  memoryConfig: string;
  error: string;
  failedAt: string;
  path: string;
}

async function findFailedQuestions(baseDir: string = './prepared-data'): Promise<FailedQuestion[]> {
  const failed: FailedQuestion[] = [];

  console.log(chalk.gray(`Scanning directory: ${baseDir}`));

  if (!existsSync(baseDir)) {
    console.error(chalk.red(`Base directory not found: ${baseDir}`));
    return failed;
  }

  try {
    // Iterate through datasets
    const datasets = await readdir(baseDir);
    console.log(chalk.gray(`Found datasets: ${datasets.join(', ')}`));

    for (const dataset of datasets) {
      const datasetPath = join(baseDir, dataset);
      const stat = await readdir(datasetPath).catch(() => null);
      if (!stat) continue;

      // Iterate through memory configs
      const configs = await readdir(datasetPath);
      console.log(chalk.gray(`  ${dataset} configs: ${configs.join(', ')}`));

      for (const config of configs) {
        const configPath = join(datasetPath, config);
        const configStat = await readdir(configPath).catch(() => null);
        if (!configStat) continue;

        // Iterate through questions
        const questions = await readdir(configPath);
        console.log(chalk.gray(`    ${config}: ${questions.length} questions`));

        let progressFound = 0;
        let failedFound = 0;

        for (const questionId of questions) {
          const questionPath = join(configPath, questionId);
          const progressPath = join(questionPath, 'progress.json');

          // Check if progress.json exists and has failed status
          if (existsSync(progressPath)) {
            progressFound++;
            try {
              const progress = JSON.parse(await readFile(progressPath, 'utf-8'));

              if (progress.failed === true) {
                failedFound++;
                failed.push({
                  questionId,
                  dataset,
                  memoryConfig: config,
                  error: progress.error || 'Unknown error',
                  failedAt: progress.failedAt || 'Unknown time',
                  path: questionPath,
                });
              }
            } catch (e) {
              console.error(chalk.red(`Error reading progress for ${questionId}:`, e));
            }
          }
        }

        if (progressFound > 0) {
          console.log(chalk.gray(`      Progress files found: ${progressFound}, Failed: ${failedFound}`));
        }
      }
    }
  } catch (error) {
    console.error(chalk.red('Error scanning directories:'), error);
  }

  return failed;
}

async function deleteQuestionDir(path: string): Promise<void> {
  // Recursively delete directory
  const entries = await readdir(path, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) {
      await deleteQuestionDir(fullPath);
    } else {
      await unlink(fullPath);
    }
  }

  await rmdir(path);
}

async function main() {
  const args = process.argv.slice(2);
  const shouldDelete = args.includes('--delete');
  const dataset = args.find(arg => arg.startsWith('--dataset='))?.split('=')[1];
  const config = args.find(arg => arg.startsWith('--config='))?.split('=')[1];

  console.log(chalk.blue('\n🔍 Finding failed questions...\n'));

  const failed = await findFailedQuestions();

  // Filter by dataset/config if specified
  let filtered = failed;
  if (dataset) {
    filtered = filtered.filter(f => f.dataset === dataset);
  }
  if (config) {
    filtered = filtered.filter(f => f.memoryConfig === config);
  }

  if (filtered.length === 0) {
    console.log(chalk.green('✅ No failed questions found!\n'));
    return;
  }

  // Group by dataset and config
  const grouped = filtered.reduce(
    (acc, f) => {
      const key = `${f.dataset}/${f.memoryConfig}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(f);
      return acc;
    },
    {} as Record<string, FailedQuestion[]>,
  );

  // Display results
  console.log(chalk.red(`Found ${filtered.length} failed questions:\n`));

  for (const [group, questions] of Object.entries(grouped)) {
    console.log(chalk.yellow(`\n${group}:`));

    for (const q of questions) {
      console.log(chalk.gray(`  - ${q.questionId}`));
      console.log(chalk.gray(`    Error: ${q.error.substring(0, 100)}${q.error.length > 100 ? '...' : ''}`));
      console.log(chalk.gray(`    Failed at: ${q.failedAt}`));
    }
  }

  if (shouldDelete) {
    console.log(chalk.yellow('\n⚠️  Deleting failed question directories...\n'));

    for (const q of filtered) {
      try {
        await deleteQuestionDir(q.path);
        console.log(chalk.green(`✓ Deleted ${q.questionId}`));
      } catch (error) {
        console.error(chalk.red(`✗ Failed to delete ${q.questionId}:`, error));
      }
    }

    console.log(chalk.green(`\n✅ Deleted ${filtered.length} failed question directories\n`));
  } else {
    console.log(chalk.gray('\n💡 Tip: Use --delete to remove these directories and retry preparation'));
    console.log(chalk.gray('   Example: pnpm tsx scripts/find-failed.ts --delete'));
    console.log(
      chalk.gray('   Filter: pnpm tsx scripts/find-failed.ts --dataset=longmemeval_s --config=working-memory'),
    );
  }
}

main().catch(console.error);
