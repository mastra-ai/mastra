#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync, statSync } from 'fs';
import { execSync } from 'child_process';

import { DatasetLoader } from './data/loader';
import type { EvaluationResult, BenchmarkMetrics, QuestionType, DatasetType, MemoryConfigType } from './data/types';
import { PrepareCommand } from './commands/prepare';
import { RunCommand } from './commands/run';
import { SyncCommand } from './commands/sync';
import { CleanCommand } from './commands/clean';
import { ObscureThreadIdsCommand } from './commands/obscure-thread-ids';
import { SessionsCommand } from './commands/sessions';
import { DeterministicIdsCommand } from './commands/deterministic-ids';
import { ListPartialCommand } from './commands/list-partial';
import { TokensCommand } from './commands/tokens';
import { PrecomputeEmbeddingsCommand } from './commands/precompute-embeddings';
import { FindProhibitedCommand } from './commands/find-prohibited';
import { PartialResultsCommand } from './commands/partial-results';
import {
  getRunVariant,
  resolveConfigAlias,
  getConfigAliases,
  getMemoryConfig,
  RUN_VARIANTS,
  CONFIG_ALIASES,
} from './config';

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

// Helper to load preparation token usage from om-debug.jsonl files
interface PreparationTokenUsage {
  observerInputTokens: number;
  observerOutputTokens: number;
  reflectorInputTokens: number;
  reflectorOutputTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  questionCount: number;
}

async function loadPreparationTokenUsage(
  preparedDataDir: string,
  memoryConfig: string,
  questionIds?: string[],
): Promise<PreparationTokenUsage | null> {
  const usage: PreparationTokenUsage = {
    observerInputTokens: 0,
    observerOutputTokens: 0,
    reflectorInputTokens: 0,
    reflectorOutputTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    questionCount: 0,
  };

  try {
    const configDir = join(preparedDataDir, 'longmemeval_s', memoryConfig);
    if (!existsSync(configDir)) {
      return null;
    }

    const questionDirs = await readdir(configDir);
    const dirsToProcess = questionIds
      ? questionDirs.filter(d => questionIds.includes(d))
      : questionDirs;

    for (const questionDir of dirsToProcess) {
      const debugFile = join(configDir, questionDir, 'om-debug.jsonl');
      if (!existsSync(debugFile)) continue;

      try {
        const content = await readFile(debugFile, 'utf-8');
        
        // Parse pretty-printed JSON objects
        // Each event starts with { (possibly with content on same line) and ends with } on its own line
        const events: any[] = [];
        let currentJson = '';
        let braceCount = 0;
        
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          
          // Check if this line starts a new JSON object
          if (braceCount === 0 && trimmed.startsWith('{')) {
            currentJson = line;
            braceCount = (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length;
          } else if (braceCount > 0) {
            currentJson += '\n' + line;
            braceCount += (trimmed.match(/{/g) || []).length;
            braceCount -= (trimmed.match(/}/g) || []).length;
          }
          
          // If we've closed all braces, parse the JSON
          if (braceCount === 0 && currentJson) {
            try {
              events.push(JSON.parse(currentJson));
            } catch {
              // Skip malformed JSON
            }
            currentJson = '';
          }
        }

        for (const event of events) {
          if (event.usage && event.usage.inputTokens) {
            if (event.type === 'observation_complete') {
              usage.observerInputTokens += event.usage.inputTokens || 0;
              usage.observerOutputTokens += event.usage.outputTokens || 0;
            } else if (event.type === 'reflection_complete') {
              usage.reflectorInputTokens += event.usage.inputTokens || 0;
              usage.reflectorOutputTokens += event.usage.outputTokens || 0;
            }
          }
        }
        usage.questionCount++;
      } catch {
        // Skip files that can't be read
      }
    }

    usage.totalInputTokens = usage.observerInputTokens + usage.reflectorInputTokens;
    usage.totalOutputTokens = usage.observerOutputTokens + usage.reflectorOutputTokens;

    return usage.questionCount > 0 ? usage : null;
  } catch {
    return null;
  }
}

program.name('longmemeval').description('LongMemEval benchmark for Mastra Memory').version('0.1.0');

// Helper to show available variants and configs
function showAvailableOptions() {
  console.log(chalk.blue('\n📋 Available Run Variants:\n'));
  for (const [name, variant] of Object.entries(RUN_VARIANTS)) {
    const subsetInfo = variant.subset ? `${variant.subset} questions` : 'all questions';
    console.log(
      chalk.bold(`  ${name.padEnd(10)}`),
      chalk.gray(`- ${variant.description}`),
      chalk.dim(`(${subsetInfo}, prepare: ${variant.prepareConcurrency}x, bench: ${variant.benchConcurrency}x)`),
    );
  }

  console.log(chalk.blue('\n📋 Available Memory Configs:\n'));
  const configNames = getConfigAliases();
  // Build reverse map: full name -> short aliases
  const shortAliases: Record<string, string[]> = {};
  for (const [alias, fullName] of Object.entries(CONFIG_ALIASES)) {
    if (alias !== fullName) {
      if (!shortAliases[fullName]) shortAliases[fullName] = [];
      shortAliases[fullName].push(alias);
    }
  }
  for (const configName of configNames) {
    const configAliases = shortAliases[configName];
    if (configAliases && configAliases.length > 0) {
      console.log(chalk.bold(`  ${configName.padEnd(35)}`), chalk.gray(`(alias: ${configAliases.join(', ')})`));
    } else {
      console.log(chalk.bold(`  ${configName}`));
    }
  }

  console.log(chalk.gray('\n\nUsage:'));
  console.log(chalk.gray('  pnpm run prepare <config> [-v quick|full]'));
  console.log(chalk.gray('  pnpm run bench <config> [-v quick|full]'));
  console.log(chalk.gray('\nExamples:'));
  console.log(chalk.gray('  pnpm run prepare om              # uses quick variant by default'));
  console.log(chalk.gray('  pnpm run prepare om -v full      # full benchmark'));
  console.log(chalk.gray('  pnpm run bench om'));
  console.log(chalk.gray('  pnpm run bench om-glm -v full'));
  console.log(chalk.gray('\nAdditional flags:'));
  console.log(chalk.gray('  -v, --variant      Run variant (quick, full, rip) - default: quick'));
  console.log(chalk.gray('  --offset <n>       Skip first n questions'));
  console.log(chalk.gray('  --question-id <id> Process specific question'));
  console.log(chalk.gray('  -y, --yes          Skip confirmation prompt'));
}

// Prepare command
program
  .command('prepare [config]')
  .description('Prepare LongMemEval data by processing through mock agents')
  .option('-v, --variant <variant>', 'Run variant (quick, full, rip)', 'quick')
  .option('-o, --output <dir>', 'Output directory for prepared data', './prepared-data')
  .option('--subset <n>', 'Override subset size', parseInt)
  .option('--offset <n>', 'Skip first n questions', parseInt)
  .option('--concurrency <n>', 'Override concurrency', parseInt)
  .option('--question-id <id>', 'Prepare a specific question by ID')
  .option('--resume-from-message-id <id>', 'Resume processing from a specific message ID')
  .option('--session-limit <n>', 'Limit processing to n sessions after resume point', parseInt)
  .option('--session-offset <n>', 'Start processing from the nth session (1-based)', parseInt)
  .option('--from-failures [path]', 'Re-prepare failed questions (uses latest failures.json if no path given)')
  .option('--older-than <duration>', 'Only re-prepare questions older than this duration (e.g., "1h", "30m", "2d")')
  .option('--dry-run', 'Show what would be re-prepared without actually doing it (use with --from-failures)')
  .option('--force-regenerate', 'Force regeneration by deleting existing prepared data first')
  .option('-y, --yes', 'Skip confirmation prompt')
  // Legacy options for backwards compatibility
  .option('-d, --dataset <dataset>', 'Dataset to use (legacy)')
  .option('-c, --memory-config <config>', 'Memory configuration (legacy)')
  .action(async (config, options) => {
    try {
      // If no config provided, show help
      if (!config && !options.dataset) {
        showAvailableOptions();
        process.exit(0);
      }

      // Resolve variant and config (support legacy options)
      let resolvedVariant: ReturnType<typeof getRunVariant>;
      let resolvedConfig: string;
      let dataset: string;

      if (options.dataset && options.memoryConfig) {
        // Legacy mode: use -d and -c flags
        dataset = options.dataset;
        resolvedConfig = options.memoryConfig;
        resolvedVariant = {
          name: 'custom',
          description: 'Custom run',
          dataset: dataset as any,
          subset: options.subset,
          prepareConcurrency: options.concurrency ?? 4,
          benchConcurrency: options.concurrency ?? 10,
        };
      } else if (config) {
        // New mode: config as positional, variant as flag (default: quick)
        resolvedVariant = getRunVariant(options.variant);
        resolvedConfig = resolveConfigAlias(config);
        dataset = resolvedVariant.dataset;
      } else {
        console.error(chalk.red('Error: Please provide a <config>'));
        console.error(chalk.gray('Run without arguments to see available options'));
        process.exit(1);
      }

      // Apply overrides
      const subset = options.subset ?? resolvedVariant.subset;
      const perTypeCount = resolvedVariant.perTypeCount;
      const concurrency = options.concurrency ?? resolvedVariant.prepareConcurrency;

      console.log(chalk.blue('\n🚀 LongMemEval Data Preparation\n'));
      console.log(chalk.gray(`Variant: ${resolvedVariant.name}`));
      console.log(chalk.gray(`Dataset: ${dataset}`));
      console.log(chalk.gray(`Memory Config: ${resolvedConfig}`));
      console.log(chalk.gray(`Concurrency: ${concurrency}`));
      if (perTypeCount) {
        console.log(chalk.gray(`Stratified Sample: ${perTypeCount} per type`));
      } else if (subset) {
        console.log(chalk.gray(`Subset: ${subset} questions`));
      }
      if (options.offset) {
        console.log(chalk.gray(`Offset: skipping first ${options.offset} questions`));
      }
      if (options.questionId) {
        console.log(chalk.gray(`Question ID: ${options.questionId}`));
      }
      console.log();

      // Check for OpenAI API key (needed for embeddings in semantic-recall)
      if ((resolvedConfig === 'semantic-recall' || resolvedConfig === 'combined') && !process.env.OPENAI_API_KEY) {
        console.error(chalk.red('Error: OPENAI_API_KEY environment variable is required for semantic recall'));
        console.error(chalk.gray('Please set it in your environment or .env file'));
        process.exit(1);
      }

      // Validate dataset option
      const validDatasets = ['longmemeval_s', 'longmemeval_m', 'longmemeval_oracle'];
      if (!validDatasets.includes(dataset)) {
        console.error(chalk.red(`Invalid dataset: ${dataset}`));
        console.error(chalk.gray(`Valid options: ${validDatasets.join(', ')}`));
        process.exit(1);
      }

      // Check if dataset exists and download if needed
      await ensureDatasetExists(dataset);

      // For readOnlyConfig, no preparation is needed
      const configDef = getMemoryConfig(resolvedConfig as MemoryConfigType);
      if (configDef.readOnlyConfig && configDef.baseConfig) {
        console.log(
          chalk.green(`✓ Config "${resolvedConfig}" is read-only and uses data from "${configDef.baseConfig}"`),
        );
        console.log(chalk.gray(`  No preparation needed. Run benchmark directly with: pnpm bench ${resolvedConfig}`));
        console.log(chalk.gray(`  Make sure "${configDef.baseConfig}" is prepared first.\n`));
        return;
      }

      // Show warning and ask for confirmation (skip if -y flag is passed)
      if (!options.yes) {
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
      }

      // Run prepare command
      const prepareCommand = new PrepareCommand();
      await prepareCommand.run({
        dataset: dataset as DatasetType,
        memoryConfig: resolvedConfig as MemoryConfigType,
        outputDir: options.output,
        subset: perTypeCount ? undefined : subset, // Don't use subset if using perTypeCount
        perTypeCount,
        offset: options.offset,
        concurrency,
        questionId: options.questionId,
        resumeFromMessageId: options.resumeFromMessageId,
        sessionLimit: options.sessionLimit,
        sessionOffset: options.sessionOffset,
        fromFailures: options.fromFailures,
        olderThan: options.olderThan,
        dryRun: options.dryRun,
        forceRegenerate: options.forceRegenerate,
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

// Run benchmark command (aliased as 'bench' too)
program
  .command('run [config]')
  .alias('bench')
  .description('Run LongMemEval benchmark using prepared data')
  .option('-v, --variant <variant>', 'Run variant (quick, full, rip, sample, sample-comb)', 'quick')
  .option('-o, --output <dir>', 'Output directory for results', './results')
  .option('--prepared-data <dir>', 'Directory containing prepared data', './prepared-data')
  .option('--subset <n>', 'Override subset size', parseInt)
  .option('--offset <n>', 'Skip first n questions', parseInt)
  .option('--concurrency <n>', 'Override concurrency', parseInt)
  .option('--question-id <id>', 'Focus on a specific question by ID')
  .option('-t, --type <type>', 'Filter to a specific question type (e.g., multi-session, knowledge-update)')
  .option('--comb-offset <n>', 'Comb sampling: stride between questions (for sample-comb variant)', parseInt)
  .option('--start-offset <n>', 'Comb sampling: starting index (for sample-comb variant)', parseInt)
  .option('--no-fixed', 'Skip improved/fixed question evaluation')
  .option(
    '--from-failures [path]',
    'Re-run only failed questions from a previous run (path to failures.json or "latest")',
  )
  .option(
    '--older-than <duration>',
    'With --from-failures: only re-run questions prepared before this duration (e.g., "1h", "30m", "2d")',
  )
  .option('--resume [run-id]', 'Resume a partial run (omit run-id to auto-detect most recent)')
  // Legacy options for backwards compatibility
  .option('-d, --dataset <dataset>', 'Dataset to use (legacy)')
  .option('-c, --memory-config <config>', 'Memory configuration (legacy)')
  .action(async (config, options) => {
    try {
      // If no config provided, show help
      if (!config && !options.dataset) {
        showAvailableOptions();
        process.exit(0);
      }

      // Resolve variant and config (support legacy options)
      let resolvedVariant: ReturnType<typeof getRunVariant>;
      let resolvedConfig: string;
      let dataset: string;

      if (options.dataset && options.memoryConfig) {
        // Legacy mode: use -d and -c flags
        dataset = options.dataset;
        resolvedConfig = options.memoryConfig;
        resolvedVariant = {
          name: 'custom',
          description: 'Custom run',
          dataset: dataset as any,
          subset: options.subset,
          prepareConcurrency: options.concurrency ?? 4,
          benchConcurrency: options.concurrency ?? 10,
        };
      } else if (config) {
        // New mode: config as positional, variant as flag (default: quick)
        resolvedVariant = getRunVariant(options.variant);
        resolvedConfig = resolveConfigAlias(config);
        dataset = resolvedVariant.dataset;
      } else {
        console.error(chalk.red('Error: Please provide a <config>'));
        console.error(chalk.gray('Run without arguments to see available options'));
        process.exit(1);
      }

      // Apply overrides
      const subset = options.subset ?? resolvedVariant.subset;
      const perTypeCount = resolvedVariant.perTypeCount;
      const combSampleSize = resolvedVariant.combSampleSize;
      const combOffset = options.combOffset ?? resolvedVariant.combOffset;
      const combStartOffset = options.startOffset ?? resolvedVariant.combStartOffset;
      const concurrency = options.concurrency ?? resolvedVariant.benchConcurrency;

      console.log(chalk.blue('\n🚀 LongMemEval Benchmark Runner\n'));
      console.log(chalk.gray(`Variant: ${resolvedVariant.name}`));
      console.log(chalk.gray(`Dataset: ${dataset}`));
      console.log(chalk.gray(`Memory Config: ${resolvedConfig}`));
      console.log(chalk.gray(`Concurrency: ${concurrency}`));
      if (combSampleSize) {
        console.log(
          chalk.gray(`Comb Sample: ${combSampleSize} per type (offset=${combOffset}, start=${combStartOffset})`),
        );
      } else if (perTypeCount) {
        console.log(chalk.gray(`Stratified Sample: ${perTypeCount} per type`));
      } else if (subset) {
        console.log(chalk.gray(`Subset: ${subset} questions`));
      }
      if (options.offset) {
        console.log(chalk.gray(`Offset: skipping first ${options.offset} questions`));
      }
      if (options.questionId) {
        console.log(chalk.gray(`Question ID: ${options.questionId}`));
      }
      console.log();

      // Check for OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        console.error(chalk.red('Error: OPENAI_API_KEY environment variable is not set'));
        console.error(chalk.gray('Please set it in your environment or .env file'));
        process.exit(1);
      }

      // Validate dataset option
      const validDatasets = ['longmemeval_s', 'longmemeval_m', 'longmemeval_oracle'];
      if (!validDatasets.includes(dataset)) {
        console.error(chalk.red(`Invalid dataset: ${dataset}`));
        console.error(chalk.gray(`Valid options: ${validDatasets.join(', ')}`));
        process.exit(1);
      }

      // Run benchmark using prepared data
      const runCommand = new RunCommand();
      await runCommand.run({
        dataset: dataset as DatasetType,
        memoryConfig: resolvedConfig as MemoryConfigType,
        preparedDataDir: options.preparedData,
        outputDir: options.output,
        subset: combSampleSize || perTypeCount ? undefined : subset, // Don't use subset if using sampling
        perTypeCount,
        combSampleSize,
        combOffset,
        combStartOffset,
        offset: options.offset,
        concurrency,
        questionId: options.questionId,
        questionType: options.type,
        skipFixed: options.fixed === false, // --no-fixed sets options.fixed to false
        fromFailures: options.fromFailures,
        resume: options.resume,
        olderThan: options.olderThan,
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

// Sync command - sync improved_question/improved_answer from dataset to prepared meta.json files
program
  .command('sync')
  .description('Sync improved_question and improved_answer from dataset JSON to prepared meta.json files')
  .requiredOption('-d, --dataset <dataset>', 'Dataset to sync from (longmemeval_s, longmemeval_m, longmemeval_oracle)')
  .option('-c, --memory-config <config>', 'Memory configuration', 'working-memory')
  .option('--prepared-data <dir>', 'Directory containing prepared data', './prepared-data')
  .action(async options => {
    try {
      console.log(chalk.blue('\n🔄 Syncing Improved Questions/Answers\n'));

      // Validate dataset option
      const validDatasets = ['longmemeval_s', 'longmemeval_m', 'longmemeval_oracle'];
      if (!validDatasets.includes(options.dataset)) {
        console.error(chalk.red(`Invalid dataset: ${options.dataset}`));
        console.error(chalk.gray(`Valid options: ${validDatasets.join(', ')}`));
        process.exit(1);
      }

      const syncCommand = new SyncCommand();
      await syncCommand.run({
        dataset: options.dataset,
        memoryConfig: options.memoryConfig,
        preparedDataDir: options.preparedData,
      });
    } catch (error) {
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });

// Results command - shows latest results for each memory configuration
program
  .command('clean')
  .description('Delete prepared data by offset/subset')
  .requiredOption('-d, --dataset <name>', 'Dataset name (longmemeval_s, longmemeval_m, longmemeval_oracle)')
  .option('-c, --memory-config <type>', 'Memory configuration to clean', 'observational-memory')
  .option('-o, --offset <n>', 'Skip first N questions (delete from N+1 onwards)', parseInt)
  .option('-s, --subset <n>', 'Only delete N questions (after offset)', parseInt)
  .option('-q, --question-id <id>', 'Delete a specific question by ID')
  .option('-p, --prepared-data <dir>', 'Prepared data directory', './prepared-data')
  .option('--partial', 'Only delete partially prepared questions (have progress.json but no meta.json)')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async options => {
    try {
      const cleanCommand = new CleanCommand();
      await cleanCommand.run({
        dataset: options.dataset,
        memoryConfig: options.memoryConfig,
        preparedDataDir: options.preparedData,
        offset: options.offset,
        subset: options.subset,
        questionId: options.questionId,
        dryRun: options.dryRun,
        partial: options.partial,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Obscure thread IDs command - replace thread IDs with hashed versions to prevent LLM bias
program
  .command('obscure-thread-ids')
  .description('Replace thread IDs in prepared om.json files with hashed versions to prevent LLM bias')
  .requiredOption('-d, --dataset <name>', 'Dataset name (longmemeval_s, longmemeval_m, longmemeval_oracle)')
  .option('-c, --memory-config <type>', 'Memory configuration', 'observational-memory')
  .option('-p, --prepared-data <dir>', 'Prepared data directory', './prepared-data')
  .option('--dry-run', 'Show what would be changed without actually modifying files')
  .action(async options => {
    try {
      const obscureCommand = new ObscureThreadIdsCommand();
      await obscureCommand.run({
        dataset: options.dataset,
        memoryConfig: options.memoryConfig,
        preparedDataDir: options.preparedData,
        dryRun: options.dryRun,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('results')
  .description('Show latest benchmark results for each memory configuration')
  .option('-r, --results <dir>', 'Results directory', './results')
  .option('-d, --dataset <dataset>', 'Filter by dataset')
  .option('-l, --latest', 'Show only the latest result per config')
  .option('--min-questions <n>', 'Minimum questions to include (default: 20)', parseInt)
  .option('-s, --sort <by>', 'Sort by: date, accuracy, fixed (default: date)', 'date')
  .option('--no-fixed', 'Hide fixed accuracy numbers')
  .action(async options => {
    const minQuestions = options.minQuestions ?? 20;
    const sortBy = options.sort ?? 'date';
    const showFixed = options.fixed !== false;
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
        metricsPath: string;
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

              // Filter by minimum questions
              if (data.total_questions < minQuestions) {
                continue;
              }

              allRuns.push({
                runId: runDir,
                metrics: data,
                config: data.config,
                timestamp: data.timestamp,
                metricsPath,
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

          // Filter by minimum questions
          if (data.total_questions < minQuestions) {
            continue;
          }

          allRuns.push({
            runId: runDir,
            metrics: data,
            config: data.config,
            timestamp: data.timestamp,
            metricsPath,
          });
        } catch (error) {
          // Skip runs with missing or invalid metrics
        }
      }

      if (allRuns.length === 0) {
        console.log(chalk.yellow('No results found matching criteria.'));
        return;
      }

      // Sort all runs based on sortBy option (best/newest at bottom for terminal viewing)
      let runsToShow = [...allRuns];

      if (options.latest) {
        // Group by config and take only the latest from each
        const byConfig = new Map<string, (typeof allRuns)[0]>();
        for (const run of allRuns) {
          const key = `${run.config.dataset}_${run.config.memoryConfig}`;
          const existing = byConfig.get(key);
          if (!existing || run.timestamp > existing.timestamp) {
            byConfig.set(key, run);
          }
        }
        runsToShow = Array.from(byConfig.values());
      }

      // Sort runs (oldest/worst first, newest/best at bottom for terminal viewing)
      runsToShow.sort((a, b) => {
        if (sortBy === 'date') {
          // Sort by date (oldest first, newest at bottom)
          return a.timestamp.localeCompare(b.timestamp);
        } else if (sortBy === 'fixed') {
          // Sort by fixed accuracy (worst first, best at bottom), fall back to vanilla if no fixed
          const aFixed = a.metrics.fixed_overall_accuracy ?? a.metrics.overall_accuracy;
          const bFixed = b.metrics.fixed_overall_accuracy ?? b.metrics.overall_accuracy;
          return aFixed - bFixed;
        } else {
          // Sort by vanilla accuracy (worst first, best at bottom)
          return a.metrics.overall_accuracy - b.metrics.overall_accuracy;
        }
      });

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
        // Make path relative to cwd
        const relativePath = require('path').relative(process.cwd(), require('path').resolve(run.metricsPath));
        console.log(chalk.gray('Metrics:'), chalk.blue(relativePath));
        console.log(chalk.gray('─'.repeat(Math.min(lineWidth, 60))));

        // Display metrics using same format as regular runs
        const metrics = run.metrics;

        // Recalculate overall accuracy using the new formula (average of type averages)
        const typeAccuracies = Object.values(metrics.accuracy_by_type).map((t: any) => t.accuracy);
        const recalculatedOverall =
          typeAccuracies.length > 0 ? typeAccuracies.reduce((sum, acc) => sum + acc, 0) / typeAccuracies.length : 0;
        metrics.overall_accuracy = recalculatedOverall;

        // Check if fixed accuracy data exists
        const hasFixedAccuracy =
          showFixed && metrics.fixed_accuracy_by_type && Object.keys(metrics.fixed_accuracy_by_type).length > 0;

        // Question type breakdown
        if (hasFixedAccuracy) {
          console.log(chalk.bold('\nAccuracy by Question Type:'), chalk.gray('(vanilla → fixed)'));
        } else {
          console.log(chalk.bold('\nAccuracy by Question Type:'));
        }

        // Sort question types alphabetically
        const sortedTypes = Object.entries(metrics.accuracy_by_type).sort(([a], [b]) => a.localeCompare(b));

        for (const [type, typeMetrics] of sortedTypes) {
          const { correct, total, accuracy } = typeMetrics as any;
          const typeColor = accuracy >= 0.8 ? 'green' : accuracy >= 0.6 ? 'yellow' : 'red';

          // Create a simple progress bar
          const barLength = 20;
          const filledLength = Math.round(accuracy * barLength);
          const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

          let fixedPart = '';
          if (hasFixedAccuracy && metrics.fixed_accuracy_by_type[type]) {
            const fixedMetrics = metrics.fixed_accuracy_by_type[type] as any;
            const fixedColor = fixedMetrics.accuracy >= 0.8 ? 'green' : fixedMetrics.accuracy >= 0.6 ? 'yellow' : 'red';
            fixedPart = chalk.gray(' → ') + chalk[fixedColor](`${(fixedMetrics.accuracy * 100).toFixed(1)}%`);
          }

          console.log(
            chalk.gray(`  ${type.padEnd(25)}:`),
            chalk[typeColor](`${(accuracy * 100).toFixed(1).padStart(5)}%`) + fixedPart,
            chalk.gray(`[${bar}]`),
            chalk.gray(`(${correct}/${total})`),
          );
        }

        // Abstention is hidden - it tests LLM reasoning ability rather than memory system performance

        // Overall summary at the bottom
        console.log();
        const accuracyColor =
          metrics.overall_accuracy >= 0.8 ? 'green' : metrics.overall_accuracy >= 0.6 ? 'yellow' : 'red';

        if (hasFixedAccuracy && metrics.fixed_overall_accuracy != null) {
          const fixedOverallColor =
            metrics.fixed_overall_accuracy >= 0.8 ? 'green' : metrics.fixed_overall_accuracy >= 0.6 ? 'yellow' : 'red';
          console.log(
            chalk.bold('Overall Accuracy:'),
            chalk[accuracyColor](`${(metrics.overall_accuracy * 100).toFixed(2)}%`),
            chalk.gray('→'),
            chalk[fixedOverallColor](`${(metrics.fixed_overall_accuracy * 100).toFixed(2)}%`),
            chalk.gray('(fixed)'),
          );
        } else {
          console.log(
            chalk.bold('Overall Accuracy:'),
            chalk[accuracyColor](`${(metrics.overall_accuracy * 100).toFixed(2)}%`),
            chalk.gray(`(average of ${Object.keys(metrics.accuracy_by_type).length} question types)`),
          );
        }

        // Token usage summary (if available)
        const formatTokens = (n: number) => n.toLocaleString();
        
        if (metrics.total_usage) {
          console.log(
            chalk.gray('Answering Tokens:'),
            chalk.cyan(formatTokens(metrics.total_usage.inputTokens)),
            chalk.gray('input,'),
            chalk.cyan(formatTokens(metrics.total_usage.outputTokens)),
            chalk.gray('output'),
            chalk.gray(`(avg ${formatTokens(Math.round(metrics.total_usage.inputTokens / metrics.total_questions))}/q)`),
          );
        }

        // Load preparation token usage from om-debug.jsonl files
        const prepUsage = await loadPreparationTokenUsage(
          './prepared-data',
          run.config.memoryConfig,
        );
        if (prepUsage && prepUsage.totalInputTokens > 0) {
          console.log(
            chalk.gray('Preparation Tokens:'),
            chalk.cyan(formatTokens(prepUsage.totalInputTokens)),
            chalk.gray('input,'),
            chalk.cyan(formatTokens(prepUsage.totalOutputTokens)),
            chalk.gray('output'),
            chalk.gray(`(Observer: ${formatTokens(prepUsage.observerInputTokens)}, Reflector: ${formatTokens(prepUsage.reflectorInputTokens)})`),
          );
        }
      }

      // Get terminal width for final separator
      const terminalWidth = process.stdout.columns || 80;
      const lineWidth = Math.min(terminalWidth - 1, 80);

      // Count unique configurations
      const uniqueConfigs = new Set(allRuns.map(r => `${r.config.dataset}_${r.config.memoryConfig}`));

      console.log(chalk.bold('\n' + '═'.repeat(lineWidth)));
      console.log(chalk.gray(`\nFound ${allRuns.length} total runs across ${uniqueConfigs.size} configurations`));
      if (!options.latest && uniqueConfigs.size > 0 && allRuns.length > uniqueConfigs.size) {
        console.log(chalk.gray('Use --latest to see only the latest run per config'));
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
    // Run the download script with specific dataset
    execSync(`pnpm download -- --dataset ${dataset}`, { stdio: 'inherit' });

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

// Sessions command - browse answer sessions for a question
program
  .command('sessions')
  .description('Browse answer sessions for a specific question ID')
  .requiredOption('-d, --dataset <dataset>', 'Dataset to use (longmemeval_s, longmemeval_m, longmemeval_oracle)')
  .requiredOption('-q, --question-id <id>', 'Question ID to browse')
  .option('-a, --all', 'Show all haystack sessions, not just answer sessions')
  .action(async options => {
    try {
      const sessionsCommand = new SessionsCommand();
      await sessionsCommand.run({
        dataset: options.dataset,
        questionId: options.questionId,
        showAll: options.all,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Deterministic IDs command - update message IDs to be deterministic
program
  .command('deterministic-ids')
  .description('Update message IDs in prepared data to be deterministic (thread_id_msg_index)')
  .option('--prepared-data-dir <dir>', 'Directory containing prepared data')
  .option('-q, --question-id <id>', 'Only update a specific question')
  .action(async options => {
    try {
      const command = new DeterministicIdsCommand({
        preparedDataDir: options.preparedDataDir,
        questionId: options.questionId,
      });
      await command.run();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List partial command - find partially prepared questions
program
  .command('list-partial')
  .description('List partially prepared or failed questions')
  .option('--prepared-data-dir <dir>', 'Directory containing prepared data')
  .action(async options => {
    try {
      const command = new ListPartialCommand({
        preparedDataDir: options.preparedDataDir,
      });
      await command.run();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Tokens command - estimate token counts for questions
program
  .command('tokens')
  .description('Estimate token counts for LongMemEval questions')
  .requiredOption('-d, --dataset <dataset>', 'Dataset to use (longmemeval_s, longmemeval_m, longmemeval_oracle)')
  .option('-q, --question-id <id>', 'Analyze a specific question by ID')
  .option('-o, --offset <n>', 'Skip first n questions', parseInt)
  .option('-s, --subset <n>', 'Analyze only n questions (after offset)', parseInt)
  .option('-p, --prepared-data <dir>', 'Directory containing prepared data', './prepared-data')
  .option('--sessions', 'Show per-session breakdown')
  .option('--top <n>', 'Show top N largest questions in aggregate view', parseInt)
  .option('--observations-only', 'Only count observation tokens from prepared data (fast)')
  .option('-c, --config <config>', 'Config to use for observations-only mode', 'observational-memory')
  .action(async options => {
    try {
      const tokensCommand = new TokensCommand();
      await tokensCommand.run({
        dataset: options.dataset,
        questionId: options.questionId,
        offset: options.offset,
        subset: options.subset,
        preparedDataDir: options.preparedData,
        showSessions: options.sessions,
        topN: options.top,
        observationsOnly: options.observationsOnly,
        config: options.config,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('precompute-embeddings')
  .description('Precompute embeddings for RAG-based observation filtering')
  .requiredOption('-d, --dataset <dataset>', 'Dataset to use (longmemeval_s, longmemeval_m, longmemeval_oracle)')
  .requiredOption('-c, --memory-config <config>', 'Memory configuration to use')
  .option('-o, --offset <n>', 'Skip first n questions', parseInt)
  .option('-s, --subset <n>', 'Process only n questions (after offset)', parseInt)
  .option('-p, --prepared-data <dir>', 'Directory containing prepared data', './prepared-data')
  .option('-b, --batch-size <n>', 'Batch size for embedding (default: 100)', parseInt)
  .option('--cooldown <ms>', 'Cooldown in ms between questions (default: 1000)', parseInt)
  .action(async options => {
    try {
      const command = new PrecomputeEmbeddingsCommand();
      await command.run({
        dataset: options.dataset,
        memoryConfig: options.memoryConfig,
        preparedDataDir: options.preparedData,
        offset: options.offset,
        subset: options.subset,
        batchSize: options.batchSize,
        cooldown: options.cooldown,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('find-prohibited')
  .description('Find messages that trigger Gemini PROHIBITED_CONTENT filter using binary search')
  .requiredOption('-d, --dataset <dataset>', 'Dataset to use (longmemeval_s, longmemeval_m, longmemeval_oracle)')
  .requiredOption('-q, --question-id <id>', 'Question ID to analyze')
  .action(async options => {
    try {
      const command = new FindProhibitedCommand();
      await command.run({
        dataset: options.dataset,
        questionId: options.questionId,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('partial [config]')
  .description('Check partial or complete benchmark results')
  .option('-o, --output <dir>', 'Results directory', './results')
  .option('--run-id <id>', 'Specific run ID to check')
  .action(async (config, options) => {
    try {
      const command = new PartialResultsCommand();
      await command.run({
        config,
        runId: options.runId,
        outputDir: options.output,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Investigate command
import { InvestigateCommand } from './commands/investigate';

program
  .command('investigate [run-id]')
  .description('Setup and manage investigation of failed questions')
  .option('-l, --list', 'List all runs with failures')
  .option('-c, --config <config>', 'Filter by config name (used with --list)')
  .option('--status', 'Show investigation status')
  .option('--next', 'Open next uninvestigated question')
  .option('--done <question-id>', 'Mark a question as investigated')
  .option('--fixed <question-id>', 'Mark a question as fix-implemented')
  .option('--sync', 'Sync fixes to longmemeval_s.json')
  .option('-o, --output <dir>', 'Investigation output directory', './investigations')
  .option('-r, --results <dir>', 'Results directory', './results')
  .option('-p, --prepared-data <dir>', 'Prepared data directory', './prepared-data')
  .option('--data <dir>', 'Dataset directory', './data')
  .option('--editor <cmd>', 'Editor command to open files', process.env.EDITOR || 'code')
  .option('--inspect <question-id>', 'Inspect a question\'s data')
  .option('--search <keyword>', 'Search observations for a keyword')
  .option('--trace <keyword>', 'Trace information flow for a keyword')
  .option('-q, --question-id <id>', 'Question ID for search/trace/date')
  .option('--date <date>', 'View observations around a date (e.g., "2023/05/29", "May 29")')
  .option('--context <days>', 'Days of context around --date (default: 1)', '1')
  .option('--session <idx>', 'View a specific session from original dataset')
  .option('--list-sessions', 'List all sessions with dates for a question')
  .option('--check-stale', 'Check if prepared data is stale (pre-cursor-fix)')
  .option('--stale-only', 'Only list stale questions (use with --check-stale)')
  .option('--check-duplicates', 'Check for duplicate thread blocks in observations')
  .option('--baseline', 'Run comprehensive data quality check for a question')
  .option('--search-original <keyword>', 'Search original dataset for a keyword (shows full context)')
  .option('--improve <question-id>', 'Add improvements to a question in the dataset')
  .option('--improve-question <text>', 'Improved question text (use with --improve)')
  .option('--improve-answer <text>', 'Improved answer text (use with --improve)')
  .option('--improve-note <text>', 'Improvement note (use with --improve)')
  .option('--category <category>', 'Failure category: observer-miss, reflector-loss, agent-reasoning, dataset-error, data-freshness, knowledge-update, rag-miss, other')
  .option('--clear-improved [fields]', 'Clear improved fields: all, question, answer, note, category (comma-separated)')
  .option('--prepare-stale', '(deprecated) Use --print-prepare-command instead')
  .option('--print-prepare-command', 'Print a prepare command for stale/partial questions')
  .option('--dry-run', 'Show what would be prepared without actually doing it')
  .action(async (runId, options) => {
    try {
      const command = new InvestigateCommand({
        outputDir: options.output,
        resultsDir: options.results,
        preparedDataDir: options.preparedData,
        datasetDir: options.data,
        editor: options.editor,
      });
      await command.run({
        runId,
        list: options.list,
        config: options.config,
        status: options.status,
        next: options.next,
        done: options.done,
        fixed: options.fixed,
        sync: options.sync,
        inspect: options.inspect,
        search: options.search,
        trace: options.trace,
        questionId: options.questionId,
        date: options.date,
        context: options.context ? parseInt(options.context, 10) : 1,
        session: options.session !== undefined ? parseInt(options.session, 10) : undefined,
        listSessions: options.listSessions,
        checkStale: options.checkStale,
        staleOnly: options.staleOnly,
        checkDuplicates: options.checkDuplicates,
        baseline: options.baseline,
        searchOriginal: options.searchOriginal,
        improve: options.improve,
        improveQuestion: options.improveQuestion,
        improveAnswer: options.improveAnswer,
        improveNote: options.improveNote,
        category: options.category,
        clearImproved: options.clearImproved,
        prepareStale: options.prepareStale,
        printPrepareCommand: options.printPrepareCommand,
        dryRun: options.dryRun,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
