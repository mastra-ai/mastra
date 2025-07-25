#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync, statSync } from 'fs';
import { execSync } from 'child_process';

import { DatasetLoader } from './data/loader';
import type { EvaluationResult, BenchmarkMetrics, QuestionType } from './data/types';
import { PrepareCommand } from './commands/prepare';
import { RunCommand } from './commands/run';

const program = new Command();

// Force immediate exit on Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nForce exiting...');
  process.exit(130); // Standard exit code for SIGINT
});

// Also handle SIGTERM
process.on('SIGTERM', () => {
  process.exit(143); // Standard exit code for SIGTERM
});

// Helper function to calculate metrics
function calculateMetrics(results: EvaluationResult[]): BenchmarkMetrics {
  const metrics: BenchmarkMetrics = {
    overall_accuracy: 0,
    accuracy_by_type: {},
    abstention_accuracy: 0,
    total_questions: results.length,
    correct_answers: 0,
    abstention_correct: 0,
    abstention_total: 0,
  } as const;

  // Calculate overall metrics
  for (const result of results) {
    if (result.is_correct) {
      metrics.correct_answers++;
    }

    // Track by question type
    const type = result.question_type;
    if (type && !metrics.accuracy_by_type[type]) {
      metrics.accuracy_by_type[type] = { correct: 0, total: 0, accuracy: 0 };
    }
    const accuracyByType = type ? metrics.accuracy_by_type[type] : null;
    if (accuracyByType) {
      accuracyByType.total++;
    }
    if (accuracyByType && result.is_correct) {
      accuracyByType.correct++;
    }

    // Track abstention separately
    if (result.question_id.endsWith('_abs')) {
      metrics.abstention_total!++;
      if (result.is_correct) {
        metrics.abstention_correct!++;
      }
    }
  }

  // Calculate per-type accuracies first
  for (const type in metrics.accuracy_by_type) {
    const typeMetrics = metrics.accuracy_by_type[type as QuestionType];
    if (typeMetrics) {
      typeMetrics.accuracy = typeMetrics.total > 0 ? typeMetrics.correct / typeMetrics.total : 0;
    }
  }

  if (metrics && (metrics.abstention_total || 0) > 0) {
    metrics.abstention_accuracy = (metrics.abstention_correct || 0) / (metrics.abstention_total || 0);
  }

  // Calculate overall accuracy as average of all question type accuracies (excluding abstention)
  const allTypeAccuracies = Object.values(metrics.accuracy_by_type).map(t => t.accuracy);

  metrics.overall_accuracy =
    allTypeAccuracies.length > 0 ? allTypeAccuracies.reduce((sum, acc) => sum + acc, 0) / allTypeAccuracies.length : 0;

  return metrics;
}

program.name('longmemeval').description('LongMemEval benchmark for Mastra Memory').version('0.1.0');

// Prepare command
program
  .command('prepare')
  .description('Prepare LongMemEval data by processing through mock agents')
  .option('-d, --dataset <dataset>', 'Dataset to use', 'longmemeval_s')
  .option(
    '-c, --memory-config <config>',
    'Memory configuration (last-k, semantic-recall, semantic-recall-reranked, working-memory, working-memory-tailored, combined, combined-tailored)',
    'semantic-recall',
  )
  .option('-o, --output <dir>', 'Output directory for prepared data', './prepared-data')
  .option('--subset <n>', 'Prepare only a subset of n questions', parseInt)
  .option('--concurrency <n>', 'Number of questions to process in parallel', parseInt)
  .option('--question-id <id>', 'Prepare a specific question by ID')
  .option('--resume-from-message-id <id>', 'Resume processing from a specific message ID')
  .option('--session-limit <n>', 'Limit processing to n sessions after resume point', parseInt)
  .option('--session-offset <n>', 'Start processing from the nth session (1-based)', parseInt)
  .action(async options => {
    try {
      console.log(chalk.blue('\n🚀 LongMemEval Data Preparation\n'));
      console.log(chalk.gray(`Dataset: ${options.dataset}`));
      console.log(chalk.gray(`Memory Config: ${options.memoryConfig}`));
      if (options.subset) {
        console.log(chalk.gray(`Subset: ${options.subset} questions`));
      }
      if (options.questionId) {
        console.log(chalk.gray(`Question ID: ${options.questionId}`));
      }
      if (options.resumeFromMessageId) {
        console.log(chalk.gray(`Resume from message ID: ${options.resumeFromMessageId}`));
      }
      if (options.sessionLimit) {
        console.log(chalk.gray(`Session limit: ${options.sessionLimit} sessions`));
      }
      if (options.sessionOffset) {
        console.log(chalk.gray(`Session offset: Start from session ${options.sessionOffset}`));
      }
      console.log();

      // Check for OpenAI API key (needed for embeddings in semantic-recall)
      if (
        (options.memoryConfig === 'semantic-recall' || options.memoryConfig === 'combined') &&
        !process.env.OPENAI_API_KEY
      ) {
        console.error(chalk.red('Error: OPENAI_API_KEY environment variable is required for semantic recall'));
        console.error(chalk.gray('Please set it in your environment or .env file'));
        process.exit(1);
      }

      // Validate dataset option
      const validDatasets = ['longmemeval_s', 'longmemeval_m', 'longmemeval_oracle'];
      if (!validDatasets.includes(options.dataset)) {
        console.error(chalk.red(`Invalid dataset: ${options.dataset}`));
        console.error(chalk.gray(`Valid options: ${validDatasets.join(', ')}`));
        process.exit(1);
      }

      // Check if dataset exists and download if needed
      await ensureDatasetExists(options.dataset);

      // Show warning and ask for confirmation
      console.log(chalk.yellow('\n⚠️  WARNING'));
      console.log(chalk.yellow('━'.repeat(50)));
      console.log(chalk.bold('\nPreparing this data can be very expensive!\n'));
      console.log('This process will:');
      console.log('  • Process many conversations through AI models');
      console.log('  • Generate embeddings for semantic recall');
      console.log('  • Potentially use significant API credits\n');
      console.log(chalk.gray('Memory configs like "working-memory" and "combined" are especially costly.\n'));

      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>(resolve => {
        rl.question(chalk.bold('Are you sure you want to continue? (y/N): '), resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log(chalk.gray('\nCancelled by user.'));
        process.exit(0);
      }

      console.log(); // Add spacing before continuing

      // Run prepare command
      const prepareCommand = new PrepareCommand();
      await prepareCommand.run({
        dataset: options.dataset,
        memoryConfig: options.memoryConfig,
        outputDir: options.output,
        subset: options.subset,
        concurrency: options.concurrency,
        questionId: options.questionId,
        resumeFromMessageId: options.resumeFromMessageId,
        sessionLimit: options.sessionLimit,
        sessionOffset: options.sessionOffset,
      });

      // Force exit after completion
      setTimeout(() => {
        process.exit(0);
      }, 100); // Give a tiny bit of time for any cleanup
    } catch (error) {
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });

// Run benchmark command
program
  .command('run')
  .description('Run LongMemEval benchmark using prepared data')
  .requiredOption('-d, --dataset <dataset>', 'Dataset to use (longmemeval_s, longmemeval_m, longmemeval_oracle)')
  .requiredOption('-m, --model <model>', 'Model to use (e.g., gpt-4o, claude-3-opus)')
  .option(
    '-c, --memory-config <config>',
    'Memory configuration (last-k, semantic-recall, semantic-recall-reranked, working-memory, working-memory-tailored, combined, combined-tailored)',
    'semantic-recall',
  )
  .option('-o, --output <dir>', 'Output directory for results', './results')
  .option('--prepared-data <dir>', 'Directory containing prepared data', './prepared-data')
  .option('--subset <n>', 'Run on subset of n questions', parseInt)
  .option('--concurrency <n>', 'Number of parallel requests (default: 5)', parseInt)
  .option('--question-id <id>', 'Focus on a specific question by ID')
  .action(async options => {
    try {
      console.log(chalk.blue('\n🚀 LongMemEval Benchmark Runner\n'));

      // Check for OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        console.error(chalk.red('Error: OPENAI_API_KEY environment variable is not set'));
        console.error(chalk.gray('Please set it in your environment or .env file'));
        process.exit(1);
      }

      // Validate dataset option
      const validDatasets = ['longmemeval_s', 'longmemeval_m', 'longmemeval_oracle'];
      if (!validDatasets.includes(options.dataset)) {
        console.error(chalk.red(`Invalid dataset: ${options.dataset}`));
        console.error(chalk.gray(`Valid options: ${validDatasets.join(', ')}`));
        process.exit(1);
      }

      // Run benchmark using prepared data
      const runCommand = new RunCommand();
      await runCommand.run({
        dataset: options.dataset,
        memoryConfig: options.memoryConfig,
        model: options.model,
        preparedDataDir: options.preparedData,
        outputDir: options.output,
        subset: options.subset,
        concurrency: options.concurrency,
        questionId: options.questionId,
      });

      // Force exit after completion
      setTimeout(() => {
        process.exit(0);
      }, 100); // Give a tiny bit of time for any cleanup
    } catch (error) {
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });

// Evaluate command
program
  .command('evaluate')
  .description('Evaluate existing results')
  .requiredOption('-r, --results <file>', 'Results file (JSONL format)')
  .requiredOption('-d, --dataset <dataset>', 'Dataset used for questions')
  .action(async options => {
    try {
      console.log(chalk.blue('\n📊 Evaluating Results\n'));

      // const loader = new DatasetLoader();
      // const questions = await loader.loadDataset(options.dataset);

      // Load results
      const resultsContent = await readFile(options.results, 'utf-8');
      const results: EvaluationResult[] = resultsContent
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      // Calculate metrics
      const metrics = calculateMetrics(results);

      // Print metrics
      console.log(chalk.bold('Overall Accuracy:'), chalk.yellow(`${(metrics.overall_accuracy * 100).toFixed(2)}%`));
      console.log(chalk.bold('Total Questions:'), metrics.total_questions);
      console.log(chalk.bold('Correct Answers:'), metrics.correct_answers);

      console.log(chalk.bold('\nAccuracy by Question Type:'));
      for (const [type, typeMetrics] of Object.entries(metrics.accuracy_by_type)) {
        const { correct, total, accuracy } = typeMetrics;
        console.log(
          chalk.gray(`  ${type}:`),
          chalk.yellow(`${(accuracy * 100).toFixed(2)}%`),
          chalk.gray(`(${correct}/${total})`),
        );
      }
    } catch (error) {
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show dataset statistics')
  .requiredOption('-d, --dataset <dataset>', 'Dataset to analyze')
  .action(async options => {
    try {
      console.log(chalk.blue('\n📈 Dataset Statistics\n'));

      const loader = new DatasetLoader();
      const stats = await loader.getDatasetStats(options.dataset);

      console.log(chalk.bold('Total Questions:'), stats.totalQuestions);
      console.log(chalk.bold('Abstention Questions:'), stats.abstentionQuestions);
      console.log(chalk.bold('Avg Sessions per Question:'), stats.avgSessionsPerQuestion.toFixed(2));
      console.log(chalk.bold('Avg Turns per Session:'), stats.avgTurnsPerSession.toFixed(2));
      console.log(chalk.bold('Total Tokens (estimate):'), stats.totalTokensEstimate.toLocaleString());

      console.log(chalk.bold('\nQuestions by Type:'));
      for (const [type, count] of Object.entries(stats.questionsByType)) {
        console.log(chalk.gray(`  ${type}:`), count);
      }
    } catch (error) {
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });

// List command to show available questions
program
  .command('list')
  .description('List prepared questions with their IDs')
  .requiredOption('-d, --dataset <dataset>', 'Dataset to list from')
  .option('-c, --memory-config <config>', 'Memory configuration', 'semantic-recall')
  .option('--prepared-data <dir>', 'Directory containing prepared data', './prepared-data')
  .action(async options => {
    try {
      console.log(chalk.blue('\n📋 Listing Prepared Questions\n'));

      const preparedDir = join(options.preparedData, options.dataset, options.memoryConfig);

      if (!existsSync(preparedDir)) {
        console.error(chalk.red(`No prepared data found for ${options.dataset} with ${options.memoryConfig} config`));
        console.error(chalk.gray(`Run 'longmemeval prepare' first`));
        process.exit(1);
      }

      const questionDirs = await readdir(preparedDir);
      const questions: any[] = [];

      for (const questionDir of questionDirs) {
        const metaPath = join(preparedDir, questionDir, 'meta.json');
        if (existsSync(metaPath)) {
          const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
          questions.push(meta);
        }
      }

      // Sort by question ID
      questions.sort((a, b) => a.questionId.localeCompare(b.questionId));

      console.log(chalk.gray(`Found ${questions.length} prepared questions:\n`));

      for (const q of questions) {
        const typeColor = q.questionType.includes('single')
          ? 'blue'
          : q.questionType.includes('multi')
            ? 'green'
            : q.questionType.includes('temporal')
              ? 'yellow'
              : 'cyan';

        console.log(
          chalk.bold(q.questionId),
          chalk[typeColor](`[${q.questionType}]`),
          chalk.gray(`- "${q.question.substring(0, 60)}${q.question.length > 60 ? '...' : ''}"`),
        );
      }

      console.log(chalk.gray(`\nTo run a specific question: longmemeval run --question-id <id> ...`));
    } catch (error) {
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });

// Results command - shows latest results for each memory configuration
program
  .command('results')
  .description('Show latest benchmark results for each memory configuration')
  .option('-r, --results <dir>', 'Results directory', './results')
  .option('-d, --dataset <dataset>', 'Filter by dataset')
  .option('-a, --all', 'Show all results, not just latest')
  .action(async options => {
    try {
      console.log(chalk.blue('\n📊 Benchmark Results Summary\n'));

      // Check if results directory exists
      if (!existsSync(options.results)) {
        console.log(chalk.yellow('No results found. Run a benchmark first with:'));
        console.log(chalk.gray('  longmemeval run -d <dataset> -m <model> -c <memory-config>'));
        return;
      }

      // List all memory config directories
      const memoryConfigs = await readdir(options.results).catch(() => []);

      // Load all metrics from new structure (results/memory-config/run_xxx)
      const allRuns: Array<{
        runId: string;
        metrics: any;
        config: any;
        timestamp: string;
      }> = [];

      // First, try new structure
      for (const memConfig of memoryConfigs) {
        const memConfigPath = join(options.results, memConfig);
        try {
          const stat = await require('fs/promises').stat(memConfigPath);
          if (!stat.isDirectory()) continue;

          const runs = await readdir(memConfigPath);
          const runDirs = runs.filter(r => r.startsWith('run_')).sort();

          for (const runDir of runDirs) {
            const metricsPath = join(memConfigPath, runDir, 'metrics.json');
            try {
              const metricsContent = await readFile(metricsPath, 'utf-8');
              const data = JSON.parse(metricsContent);

              // Filter by dataset if specified
              if (options.dataset && data.config.dataset !== options.dataset) {
                continue;
              }

              allRuns.push({
                runId: runDir,
                metrics: data,
                config: data.config,
                timestamp: data.timestamp,
              });
            } catch (error) {
              // Skip runs with missing or invalid metrics
            }
          }
        } catch (error) {
          // Not a directory, skip
        }
      }

      // Also check old structure for backwards compatibility
      const oldRuns = memoryConfigs.filter(r => r.startsWith('run_')).sort();
      for (const runDir of oldRuns) {
        const metricsPath = join(options.results, runDir, 'metrics.json');
        try {
          const metricsContent = await readFile(metricsPath, 'utf-8');
          const data = JSON.parse(metricsContent);

          // Filter by dataset if specified
          if (options.dataset && data.config.dataset !== options.dataset) {
            continue;
          }

          allRuns.push({
            runId: runDir,
            metrics: data,
            config: data.config,
            timestamp: data.timestamp,
          });
        } catch (error) {
          // Skip runs with missing or invalid metrics
        }
      }

      if (allRuns.length === 0) {
        console.log(chalk.yellow('No results found matching criteria.'));
        return;
      }

      // Group by memory configuration
      const byMemoryConfig = new Map<string, typeof allRuns>();
      for (const run of allRuns) {
        const key = `${run.config.dataset}_${run.config.memoryConfig}`;
        if (!byMemoryConfig.has(key)) {
          byMemoryConfig.set(key, []);
        }
        byMemoryConfig.get(key)!.push(run);
      }

      // Sort groups by worst performing to best performing (based on latest run)
      const sortedConfigs = Array.from(byMemoryConfig.entries()).sort(([_aKey, aRuns], [_bKey, bRuns]) => {
        // Get latest run for each config (already sorted by timestamp)
        const aLatest = aRuns.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
        const bLatest = bRuns.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

        // Sort by overall accuracy (worst first)
        return aLatest.metrics.overall_accuracy - bLatest.metrics.overall_accuracy;
      });

      for (const [_configKey, runs] of sortedConfigs) {
        // Sort runs by timestamp (newest first)
        runs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        // Show latest or all
        const runsToShow = options.all ? runs : [runs[0]];

        for (const run of runsToShow) {
          // Get terminal width, default to 80 if not available
          const terminalWidth = process.stdout.columns || 80;
          const lineWidth = Math.min(terminalWidth - 1, 80); // Cap at 80 for readability

          console.log(chalk.bold('\n' + '═'.repeat(lineWidth) + '\n'));

          // Configuration header
          console.log(chalk.bold('Configuration:\n'));
          console.log(chalk.gray('Dataset:'), chalk.cyan(run.config.dataset));
          console.log(chalk.gray('Model:'), chalk.cyan(run.config.model));
          console.log(chalk.gray('Memory Config:'), chalk.cyan(run.config.memoryConfig));
          if (run.config.subset) {
            console.log(chalk.gray('Subset:'), chalk.cyan(`${run.config.subset} questions`));
          }
          console.log(chalk.gray('Run ID:'), chalk.dim(run.runId));
          console.log(chalk.gray('Timestamp:'), chalk.dim(new Date(run.timestamp).toLocaleString()));
          console.log(chalk.gray('─'.repeat(Math.min(lineWidth, 60))));

          // Display metrics using same format as regular runs
          const metrics = run.metrics;

          // Recalculate overall accuracy using the new formula (average of type averages)
          const typeAccuracies = Object.values(metrics.accuracy_by_type).map((t: any) => t.accuracy);
          const recalculatedOverall =
            typeAccuracies.length > 0 ? typeAccuracies.reduce((sum, acc) => sum + acc, 0) / typeAccuracies.length : 0;
          metrics.overall_accuracy = recalculatedOverall;

          // Question type breakdown
          console.log(chalk.bold('\nAccuracy by Question Type:'));

          // Sort question types alphabetically
          const sortedTypes = Object.entries(metrics.accuracy_by_type).sort(([a], [b]) => a.localeCompare(b));

          for (const [type, typeMetrics] of sortedTypes) {
            const { correct, total, accuracy } = typeMetrics as any;
            const typeColor = accuracy >= 0.8 ? 'green' : accuracy >= 0.6 ? 'yellow' : 'red';

            // Create a simple progress bar
            const barLength = 20;
            const filledLength = Math.round(accuracy * barLength);
            const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

            console.log(
              chalk.gray(`  ${type.padEnd(25)}:`),
              chalk[typeColor](`${(accuracy * 100).toFixed(1).padStart(5)}%`),
              chalk.gray(`[${bar}]`),
              chalk.gray(`(${correct}/${total})`),
            );
          }

          // Abstention is hidden - it tests LLM reasoning ability rather than memory system performance

          // Overall summary at the bottom
          console.log();
          const accuracyColor =
            metrics.overall_accuracy >= 0.8 ? 'green' : metrics.overall_accuracy >= 0.6 ? 'yellow' : 'red';
          console.log(
            chalk.bold('Overall Accuracy:'),
            chalk[accuracyColor](`${(metrics.overall_accuracy * 100).toFixed(2)}%`),
            chalk.gray(`(average of ${Object.keys(metrics.accuracy_by_type).length} question types)`),
          );
        }
      }

      // Get terminal width for final separator
      const terminalWidth = process.stdout.columns || 80;
      const lineWidth = Math.min(terminalWidth - 1, 80);

      console.log(chalk.bold('\n' + '═'.repeat(lineWidth)));
      console.log(chalk.gray(`\nFound ${allRuns.length} total runs across ${byMemoryConfig.size} configurations`));
      if (!options.all && byMemoryConfig.size > 0) {
        console.log(chalk.gray('Use --all to see all runs, not just the latest'));
      }
    } catch (error) {
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate report from benchmark results')
  .requiredOption('-r, --results <dir>', 'Results directory')
  .action(async options => {
    try {
      console.log(chalk.blue('\n📄 Generating Report\n'));

      // List all runs in the results directory
      const runs = await readdir(options.results);
      const runDirs = runs.filter(r => r.startsWith('run_'));

      if (runDirs.length === 0) {
        console.log(chalk.yellow('No benchmark runs found in the results directory'));
        return;
      }

      console.log(chalk.bold(`Found ${runDirs.length} benchmark runs:\n`));

      // Load and display metrics for each run
      for (const runDir of runDirs) {
        const metricsPath = join(options.results, runDir, 'metrics.json');

        try {
          const metricsContent = await readFile(metricsPath, 'utf-8');
          const metrics = JSON.parse(metricsContent);

          console.log(chalk.bold(`Run: ${runDir}`));
          console.log(chalk.gray(`  Timestamp: ${metrics.timestamp}`));
          console.log(chalk.gray(`  Dataset: ${metrics.config.dataset}`));
          console.log(chalk.gray(`  Model: ${metrics.config.model}`));
          console.log(chalk.gray(`  Memory Config: ${metrics.config.memoryConfig}`));
          console.log(chalk.yellow(`  Overall Accuracy: ${(metrics.overall_accuracy * 100).toFixed(2)}%`));
          console.log();
        } catch (error) {
          console.log(chalk.red(`  Error loading metrics: ${error}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });

// Helper function to ensure dataset exists
async function ensureDatasetExists(dataset: string) {
  const dataDir = join(process.cwd(), 'data');
  const datasetPath = join(dataDir, `${dataset}.json`);

  // Check if dataset exists and is valid (> 1MB)
  if (existsSync(datasetPath)) {
    try {
      const stats = statSync(datasetPath);
      if (stats.size > 1000000) {
        return; // Dataset exists and is valid
      }
    } catch (error) {
      // File exists but can't get stats, continue to download
    }
  }

  // Dataset missing or invalid, need to download
  console.log(chalk.yellow(`Dataset ${dataset} not found or invalid.\n`));

  // Check for HuggingFace token
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
  if (!token) {
    console.log(chalk.red('Error: HuggingFace token required to download datasets.\n'));
    console.log(chalk.gray('1. Get your token from:'));
    console.log(chalk.cyan('   https://huggingface.co/settings/tokens\n'));
    console.log(chalk.gray('2. Set it as an environment variable:'));
    console.log(chalk.cyan('   export HF_TOKEN=your_token_here\n'));
    console.log(chalk.gray('3. Run the benchmark again\n'));
    console.log(chalk.blue('Alternative: Download manually from Google Drive'));
    console.log(chalk.gray('See DOWNLOAD_GUIDE.md for instructions'));
    process.exit(1);
  }

  console.log(chalk.blue('Downloading dataset...\n'));

  try {
    // Run the download script
    execSync('pnpm download', { stdio: 'inherit' });

    // Verify download succeeded
    if (!existsSync(datasetPath) || statSync(datasetPath).size < 1000000) {
      throw new Error('Dataset download failed or file is invalid');
    }

    console.log(chalk.green('\n✅ Dataset downloaded successfully!\n'));
  } catch (error) {
    console.error(chalk.red('\nError downloading dataset:'), error);
    console.log(chalk.yellow('\nPlease download the dataset manually.'));
    console.log(chalk.gray('See DOWNLOAD_GUIDE.md for instructions'));
    process.exit(1);
  }
}

program.parse();
