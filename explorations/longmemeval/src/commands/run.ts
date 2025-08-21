import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';
import { cachedOpenAI } from '../embeddings/cached-openai-provider';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { join } from 'path';
import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

import { BenchmarkStore, BenchmarkVectorStore } from '../storage';
import { LongMemEvalMetric } from '../evaluation/longmemeval-metric';
import type { EvaluationResult, BenchmarkMetrics, QuestionType, MemoryConfigType, DatasetType } from '../data/types';
import { getMemoryOptions } from '../config';
import { makeRetryModel } from '../retry-model';

export interface RunOptions {
  dataset: DatasetType;
  memoryConfig: MemoryConfigType;
  model: string;
  preparedDataDir?: string;
  outputDir?: string;
  subset?: number;
  concurrency?: number;
  questionId?: string;
}

interface PreparedQuestionMeta {
  questionId: string;
  questionType: string;
  resourceId: string;
  threadIds: string[];
  memoryConfig: string;
  question: string;
  answer: string;
  evidenceSessionIds?: string[];
  questionDate?: string;
}

const retry4o = makeRetryModel(openai('gpt-4o'));

export class RunCommand {
  private preparedDataDir: string;
  private outputDir: string;

  constructor() {
    this.preparedDataDir = './prepared-data';
    this.outputDir = './results';
  }

  async run(options: RunOptions): Promise<BenchmarkMetrics> {
    const runId = `run_${Date.now()}`;
    const runDir = join(options.outputDir || this.outputDir, options.memoryConfig, runId);
    await mkdir(runDir, { recursive: true });

    console.log(chalk.blue(`\n🚀 Starting LongMemEval benchmark run: ${runId}\n`));
    console.log(chalk.gray(`Dataset: ${options.dataset}`));
    console.log(chalk.gray(`Model: ${options.model}`));
    console.log(chalk.gray(`Memory Config: ${options.memoryConfig}`));
    if (options.subset) {
      console.log(chalk.gray(`Subset: ${options.subset} questions`));
    }
    console.log();

    const preparedDir = join(options.preparedDataDir || this.preparedDataDir, options.dataset, options.memoryConfig);

    if (!existsSync(preparedDir)) {
      throw new Error(`Prepared data not found at: ${preparedDir}\nPlease run 'longmemeval prepare' first.`);
    }

    // Load prepared questions
    const spinner = ora('Loading prepared data...').start();
    const questionDirs = await readdir(preparedDir);
    const preparedQuestions: PreparedQuestionMeta[] = [];

    let skippedCount = 0;
    let failedCount = 0;
    for (const questionDir of questionDirs) {
      const questionPath = join(preparedDir, questionDir);
      const metaPath = join(questionPath, 'meta.json');
      const progressPath = join(questionPath, 'progress.json');

      // Check if question has been prepared
      if (existsSync(metaPath)) {
        // Check if there's an incomplete or failed preparation
        if (existsSync(progressPath)) {
          const progress = JSON.parse(await readFile(progressPath, 'utf-8'));
          if (!progress.completed) {
            skippedCount++;
            continue; // Skip this question as it's still being prepared
          }
          if (progress.failed) {
            failedCount++;
            continue; // Skip this question as it failed to prepare
          }
        }

        const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
        preparedQuestions.push(meta);
      }
    }

    spinner.succeed(
      `Loaded ${preparedQuestions.length} prepared questions${skippedCount > 0 || failedCount > 0 ? ` (${skippedCount} incomplete, ${failedCount} failed)` : ''}`,
    );

    if (skippedCount > 0) {
      console.log(
        chalk.yellow(
          `\n⚠️  ${skippedCount} question${skippedCount > 1 ? 's' : ''} skipped due to incomplete preparation.`,
        ),
      );
      console.log(chalk.gray(`   Run 'prepare' command to complete preparation.\n`));
    }

    if (failedCount > 0) {
      console.log(
        chalk.red(`\n⚠️  ${failedCount} question${failedCount > 1 ? 's' : ''} skipped due to failed preparation.`),
      );
      console.log(chalk.gray(`   Check error logs and re-run 'prepare' command.\n`));
    }

    // Filter by questionId if specified
    let questionsToProcess = preparedQuestions;
    if (options.questionId) {
      questionsToProcess = preparedQuestions.filter(q => q.questionId === options.questionId);
      if (questionsToProcess.length === 0) {
        throw new Error(`Question with ID "${options.questionId}" not found in prepared data`);
      }
      console.log(chalk.yellow(`\nFocusing on question: ${options.questionId}\n`));
    } else if (options.subset) {
      // Apply subset if requested
      questionsToProcess = preparedQuestions.slice(0, options.subset);
      console.log(
        chalk.gray(`\nApplying subset: ${options.subset} questions from ${preparedQuestions.length} total\n`),
      );
    }

    console.log(
      chalk.yellow(`\nEvaluating ${questionsToProcess.length} question${questionsToProcess.length !== 1 ? 's' : ''}\n`),
    );

    // Process questions with concurrency control
    const results: EvaluationResult[] = [];
    const concurrency = options.concurrency || 5;
    const questionSpinner = ora('Evaluating questions...').start();

    let completedCount = 0;
    let inProgressCount = 0;
    const startTime = Date.now();

    // Track active evaluations
    const activeEvaluations = new Map<number, { questionId: string; status: string }>();

    // Function to update progress display
    let lastText = '';
    const updateProgress = () => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = elapsed > 0 ? completedCount / elapsed : 0;
      const remaining = rate > 0 ? Math.round((questionsToProcess.length - completedCount) / rate) : 0;

      let progressText = `Overall: ${completedCount}/${questionsToProcess.length} (${inProgressCount} in progress, ${Math.round(rate * 60)} q/min, ~${remaining}s remaining)`;

      if (activeEvaluations.size > 0 && concurrency > 1) {
        progressText += '\n\nActive evaluations:';

        // Sort active evaluations by completion status
        const sortedEvaluations = Array.from(activeEvaluations.entries())
          .map(([index, info]) => {
            // Assign progress based on status
            let progress = 0;
            if (info.status.includes('Querying agent')) progress = 0.75;
            else if (info.status.includes('Loading vector')) progress = 0.5;
            else if (info.status.includes('Loading data')) progress = 0.25;
            else if (info.status.includes('Starting')) progress = 0.0;

            return { index, info, progress };
          })
          .sort((a, b) => b.progress - a.progress); // Sort by most complete first

        sortedEvaluations.forEach(({ index, info, progress }) => {
          const percentage = (progress * 100).toFixed(0);
          progressText += `\n  [${index + 1}] ${info.questionId} - ${info.status} (${percentage}%)`;
        });
      }

      if (lastText !== progressText) {
        lastText = progressText;
        questionSpinner.text = progressText;
      }
    };

    // Create a queue of questions to evaluate
    const questionQueue = [...questionsToProcess];

    // Function to process next question from queue
    const processNextQuestion = async (slotIndex: number): Promise<EvaluationResult[]> => {
      const workerResults: EvaluationResult[] = [];

      while (questionQueue.length > 0) {
        const meta = questionQueue.shift();
        if (!meta) break;

        inProgressCount++;
        activeEvaluations.set(slotIndex, { questionId: meta.questionId, status: 'Starting...' });
        // Don't update progress here - let the periodic timer handle it

        const result = await this.evaluateQuestion(
          meta,
          preparedDir,
          retry4o.model,
          options,
          concurrency > 1
            ? {
                updateStatus: (status: string) => {
                  activeEvaluations.set(slotIndex, { questionId: meta.questionId, status });
                },
              }
            : questionSpinner,
        );

        completedCount++;
        inProgressCount--;
        activeEvaluations.delete(slotIndex);

        // Log result when running concurrently
        if (concurrency > 1) {
          // Temporarily clear the spinner to log cleanly
          questionSpinner.clear();

          console.log(
            chalk.blue(`▶ ${meta.questionId}`),
            chalk.gray(`(${meta.questionType})`),
            chalk[result.is_correct ? 'green' : 'red'](`${result.is_correct ? '✓' : '✗'}`),
            chalk.gray(`${((Date.now() - startTime) / 1000).toFixed(1)}s`),
          );
          if (!result.is_correct) {
            console.log(chalk.gray(`  Q: "${meta.question}"`));
            console.log(chalk.gray(`  A: "${result.hypothesis}"`));
            console.log(chalk.yellow(`  Expected: "${meta.answer}"`));
          }

          // Re-render the spinner
          questionSpinner.render();
        }

        // Don't update progress here - let the periodic timer handle it
        workerResults.push(result);
      }

      return workerResults;
    };

    // Set up periodic progress updates
    const progressInterval = setInterval(updateProgress, 500);

    // Create worker slots
    const workers = Array.from({ length: concurrency }, (_, i) => processNextQuestion(i));

    // Wait for all workers to complete and collect results
    const workerResults = await Promise.all(workers);

    // Process results from all workers
    for (const workerResultArray of workerResults) {
      results.push(...workerResultArray);
    }

    // Clear the interval
    clearInterval(progressInterval);

    questionSpinner.succeed(`Evaluated ${results.length} questions`);

    // Calculate metrics
    console.log(chalk.blue('\n📊 Calculating metrics...\n'));
    const metrics = this.calculateMetrics(results);

    // Save results
    await this.saveResults(runDir, results, metrics, options);

    // Display results
    this.displayMetrics(metrics, options);

    return metrics;
  }

  private async evaluateQuestion(
    meta: PreparedQuestionMeta,
    preparedDir: string,
    modelProvider: any,
    options: RunOptions,
    spinner?: Ora | { updateStatus: (status: string) => void },
  ): Promise<EvaluationResult> {
    const questionStart = Date.now();

    // Update status
    const updateStatus = (status: string) => {
      if (spinner && 'updateStatus' in spinner) {
        spinner.updateStatus(status);
      } else if (spinner && 'text' in spinner) {
        spinner.text = status;
      }
    };

    updateStatus(`Loading data for ${meta.questionId}...`);

    // Load the prepared storage and vector store
    const questionDir = join(preparedDir, meta.questionId);
    const benchmarkStore = new BenchmarkStore('read');
    const benchmarkVectorStore = new BenchmarkVectorStore('read');

    await benchmarkStore.init();
    await benchmarkStore.hydrate(join(questionDir, 'db.json'));

    // Hydrate vector store if it exists
    const vectorPath = join(questionDir, 'vector.json');
    if (existsSync(vectorPath)) {
      await benchmarkVectorStore.hydrate(vectorPath);
      updateStatus(`Loading vector embeddings for ${meta.questionId}...`);
    }

    const memoryOptions = getMemoryOptions(options.memoryConfig);

    // Create memory with the hydrated stores
    const memory = new Memory({
      storage: benchmarkStore,
      vector: benchmarkVectorStore,
      embedder: cachedOpenAI.embedding('text-embedding-3-small'),
      options: memoryOptions.options,
    });

    // Create agent with the specified model
    const agentInstructions = `You are a helpful assistant with access to extensive conversation history. 
When answering questions, carefully review the conversation history to identify and use any relevant user preferences, interests, or specific details they have mentioned.
For example, if the user previously mentioned they prefer a specific software, tool, or approach, tailor your recommendations to match their stated preferences.
Be specific rather than generic when the user has expressed clear preferences in past conversations. If there is a clear preference, focus in on that, and do not add additional irrelevant information.`;

    const agent = new Agent({
      name: 'longmemeval-agent',
      model: modelProvider,
      instructions: agentInstructions,
      memory,
    });

    // Create a fresh thread for the evaluation question
    const evalThreadId = `eval_${meta.questionId}_${Date.now()}`;

    updateStatus(`${meta.threadIds.length} sessions, ${options.memoryConfig}`);

    const response = await agent.generate(meta.question, {
      threadId: evalThreadId,
      resourceId: meta.resourceId,
      temperature: 0,
      context: meta.questionDate ? [{ role: 'system', content: `Todays date is ${meta.questionDate}` }] : undefined,
    });

    const evalAgent = new Agent({
      name: 'longmemeval-metric-agent',
      model: retry4o.model,
      instructions: 'You are an evaluation assistant. Answer questions precisely and concisely.',
    });

    const metric = new LongMemEvalMetric({
      agent: evalAgent,
      questionType: meta.questionType as any,
      isAbstention: meta.questionId.endsWith('_abs'),
    });

    const input = JSON.stringify({
      question: meta.question,
      answer: meta.answer,
    });

    const result = await metric.measure(input, response.text);
    const isCorrect = result.score === 1;

    const elapsed = ((Date.now() - questionStart) / 1000).toFixed(1);

    const isOraSpinner = spinner && 'clear' in spinner;
    if (isOraSpinner) {
      console.log(
        chalk.blue(`▶ ${meta.questionId}`),
        chalk.gray(`(${meta.questionType})`),
        chalk[isCorrect ? 'green' : 'red'](`${isCorrect ? '✓' : '✗'}`),
        chalk.gray(`${elapsed}s`),
      );
      if (!isCorrect) {
        console.log(chalk.gray(`  Q: "${meta.question}"`));
        console.log(chalk.gray(`  A: "${response.text}"`));
        console.log(chalk.yellow(`  Expected: "${meta.answer}"`));
      }
    }

    return {
      question_id: meta.questionId,
      hypothesis: response.text,
      question_type: meta.questionType as QuestionType,
      is_correct: isCorrect,
    };
  }

  private async saveResults(
    runDir: string,
    results: EvaluationResult[],
    metrics: BenchmarkMetrics,
    options: RunOptions,
  ): Promise<void> {
    // Save raw results
    const resultsPath = join(runDir, 'results.jsonl');
    const resultsContent = results.map(r => JSON.stringify(r)).join('\n');
    await writeFile(resultsPath, resultsContent);

    // Save metrics
    const metricsPath = join(runDir, 'metrics.json');
    const metricsData = {
      ...metrics,
      config: {
        dataset: options.dataset,
        model: options.model,
        memoryConfig: options.memoryConfig,
        subset: options.subset,
      },
      timestamp: new Date().toISOString(),
    };
    await writeFile(metricsPath, JSON.stringify(metricsData, null, 2));

    console.log(chalk.gray(`\nResults saved to: ${runDir}`));
  }

  private calculateMetrics(results: EvaluationResult[]): BenchmarkMetrics {
    const metrics: BenchmarkMetrics = {
      overall_accuracy: 0,
      accuracy_by_type: {} as Record<QuestionType, { correct: number; total: number; accuracy: number }>,
      abstention_accuracy: 0,
      total_questions: results.length,
      correct_answers: 0,
      abstention_correct: 0,
      abstention_total: 0,
    };

    // Calculate overall metrics
    for (const result of results) {
      if (result.is_correct) {
        metrics.correct_answers++;
      }

      // Track by question type
      if (result.question_type) {
        const type = result.question_type;
        if (!metrics.accuracy_by_type[type]) {
          metrics.accuracy_by_type[type] = { correct: 0, total: 0, accuracy: 0 };
        }
        metrics.accuracy_by_type[type].total++;
        if (result.is_correct) {
          metrics.accuracy_by_type[type].correct++;
        }
      }

      // Track abstention separately
      if (result.question_id.endsWith('_abs')) {
        metrics.abstention_total = (metrics.abstention_total || 0) + 1;
        if (result.is_correct) {
          metrics.abstention_correct = (metrics.abstention_correct || 0) + 1;
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

    if (metrics.abstention_total && metrics.abstention_total > 0) {
      metrics.abstention_accuracy = (metrics.abstention_correct || 0) / metrics.abstention_total;
    }

    // Calculate overall accuracy as average of all question type accuracies (excluding abstention)
    const allTypeAccuracies = Object.values(metrics.accuracy_by_type).map(t => t.accuracy);

    // Debug: Log the exact values being averaged
    console.log('\nDebug - Question type accuracies being averaged:');
    Object.entries(metrics.accuracy_by_type).forEach(([type, data]) => {
      console.log(`  ${type}: ${data.accuracy} (${data.correct}/${data.total})`);
    });
    console.log(`  Sum: ${allTypeAccuracies.reduce((sum, acc) => sum + acc, 0)}`);
    console.log(`  Count: ${allTypeAccuracies.length}`);

    metrics.overall_accuracy =
      allTypeAccuracies.length > 0
        ? allTypeAccuracies.reduce((sum, acc) => sum + acc, 0) / allTypeAccuracies.length
        : 0;

    console.log(`  Calculated overall: ${metrics.overall_accuracy}`);
    console.log(`  As percentage: ${(metrics.overall_accuracy * 100).toFixed(10)}%\n`);

    return metrics;
  }

  private displayMetrics(metrics: BenchmarkMetrics, options?: RunOptions): void {
    console.log(chalk.bold('\n📊 Benchmark Results\n'));

    // Display configuration if provided
    if (options) {
      console.log(chalk.bold('Configuration:\n'));
      console.log(chalk.gray('Dataset:'), chalk.cyan(options.dataset));
      console.log(chalk.gray('Model:'), chalk.cyan(options.model));
      console.log(chalk.gray('Memory Config:'), chalk.cyan(options.memoryConfig));
      if (options.subset) {
        console.log(chalk.gray('Subset:'), chalk.cyan(`${options.subset} questions`));
      }
      // Get terminal width
      const terminalWidth = process.stdout.columns || 80;
      const lineWidth = Math.min(terminalWidth - 1, 60);
      console.log(chalk.gray('─'.repeat(lineWidth)));
      console.log();
    }

    // Question type breakdown
    console.log(chalk.bold('Accuracy by Question Type:'));

    // Sort question types alphabetically
    const sortedTypes = Object.entries(metrics.accuracy_by_type).sort(([a], [b]) => a.localeCompare(b));

    // Display regular question types
    for (const [type, typeMetrics] of sortedTypes) {
      const { correct, total, accuracy } = typeMetrics;
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
