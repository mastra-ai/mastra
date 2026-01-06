import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { ObservationalMemory, OBSERVATIONAL_MEMORY_DEFAULTS } from '@mastra/memory/experiments';
import { MessageHistory } from '@mastra/core/processors';
import { openai } from '@ai-sdk/openai';
import { cachedOpenAI } from '../embeddings/cached-openai-provider';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { join } from 'path';
import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { existsSync, writeFileSync } from 'fs';

import { BenchmarkStore, BenchmarkVectorStore, PersistableInMemoryMemory } from '../storage';
import { LongMemEvalMetric } from '../evaluation/longmemeval-metric';
import type { EvaluationResult, BenchmarkMetrics, QuestionType, MemoryConfigType, DatasetType } from '../data/types';
import { getMemoryOptions, observationalMemoryConfig } from '../config';
import { makeRetryModel } from '../retry-model';
import { DatasetLoader } from '../data/loader';

export interface RunOptions {
  dataset: DatasetType;
  memoryConfig: MemoryConfigType;
  model: string;
  preparedDataDir?: string;
  outputDir?: string;
  subset?: number;
  offset?: number;
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
  improvedQuestion?: string; // Clarified version for vague/ambiguous questions
  improvedAnswer?: string; // Updated answer for the clarified question (if different)
  improvementNote?: string; // Notes about why this question failed (for tracking investigated failures)
  requiresRetry?: boolean; // Eval agent sometimes fails due to poor reasoning, retry once on failure
  answer: string;
  evidenceSessionIds?: string[];
  questionDate?: string;
}

const retry4o = makeRetryModel(openai('gpt-4o'));

export class RunCommand {
  private preparedDataDir: string;
  private outputDir: string;
  private loader: DatasetLoader;

  constructor() {
    this.preparedDataDir = './prepared-data';
    this.outputDir = './results';
    this.loader = new DatasetLoader();
  }

  async run(options: RunOptions): Promise<BenchmarkMetrics> {
    const runId = `run_${Date.now()}`;
    const runDir = join(options.outputDir || this.outputDir, options.memoryConfig, runId);
    await mkdir(runDir, { recursive: true });

    console.log(
      chalk.blue(`
🚀 Starting LongMemEval benchmark run: ${runId}
`),
    );
    console.log(chalk.gray(`Dataset: ${options.dataset}`));
    console.log(chalk.gray(`Model: ${options.model}`));
    console.log(chalk.gray(`Memory Config: ${options.memoryConfig}`));
    if (options.subset) {
      console.log(chalk.gray(`Subset: ${options.subset} questions`));
    }
    console.log();

    const preparedDir = join(options.preparedDataDir || this.preparedDataDir, options.dataset, options.memoryConfig);

    if (!existsSync(preparedDir)) {
      throw new Error(`Prepared data not found at: ${preparedDir}
Please run 'longmemeval prepare' first.`);
    }

    // Load original dataset to get correct question order
    const spinner = ora('Loading prepared data...').start();
    const originalQuestions = await this.loader.loadDataset(options.dataset);
    const questionIdOrder = new Map(originalQuestions.map((q, i) => [q.question_id, i]));

    // Load prepared questions
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

    // Sort prepared questions to match original dataset order
    preparedQuestions.sort((a, b) => {
      const orderA = questionIdOrder.get(a.questionId) ?? Infinity;
      const orderB = questionIdOrder.get(b.questionId) ?? Infinity;
      return orderA - orderB;
    });

    spinner.succeed(
      `Loaded ${preparedQuestions.length} prepared questions${skippedCount > 0 || failedCount > 0 ? ` (${skippedCount} incomplete, ${failedCount} failed)` : ''}`,
    );

    if (skippedCount > 0) {
      console.log(
        chalk.yellow(
          `
⚠️  ${skippedCount} question${skippedCount > 1 ? 's' : ''} skipped due to incomplete preparation.`,
        ),
      );
      console.log(
        chalk.gray(`   Run 'prepare' command to complete preparation.
`),
      );
    }

    if (failedCount > 0) {
      console.log(
        chalk.red(`
⚠️  ${failedCount} question${failedCount > 1 ? 's' : ''} skipped due to failed preparation.`),
      );
      console.log(
        chalk.gray(`   Check error logs and re-run 'prepare' command.
`),
      );
    }

    // Filter by questionId if specified
    let questionsToProcess = preparedQuestions;
    if (options.questionId) {
      questionsToProcess = preparedQuestions.filter(q => q.questionId === options.questionId);
      if (questionsToProcess.length === 0) {
        throw new Error(`Question with ID "${options.questionId}" not found in prepared data`);
      }
      console.log(
        chalk.yellow(`
Focusing on question: ${options.questionId}
`),
      );
    } else {
      // Apply offset and subset if requested
      const offset = options.offset || 0;
      if (offset > 0) {
        questionsToProcess = preparedQuestions.slice(offset);
        console.log(chalk.gray(`Skipping first ${offset} questions`));
      }
      if (options.subset) {
        questionsToProcess = questionsToProcess.slice(0, options.subset);
      }
      if (offset > 0 || options.subset) {
        console.log(
          chalk.gray(`
Processing questions ${offset + 1}-${offset + questionsToProcess.length} of ${preparedQuestions.length} total
`),
        );
      }
    }

    console.log(
      chalk.yellow(`
Evaluating ${questionsToProcess.length} question${questionsToProcess.length !== 1 ? 's' : ''}
`),
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
        progressText += `

Active evaluations:`;

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
          progressText += `
  [${index + 1}] ${info.questionId} - ${info.status} (${percentage}%)`;
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

          // Show improved result if applicable
          if (result.improved_question) {
            console.log(
              chalk.cyan(`  ↳ improved:`),
              chalk[result.improved_is_correct ? 'green' : 'red'](`${result.improved_is_correct ? '✓' : '✗'}`),
            );
            // if (!result.improved_is_correct) {
            console.log(chalk.gray(`    Q: "${result.improved_question}"`));
            console.log(chalk.gray(`    A: "${result.improved_hypothesis}"`));
            // }
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
    console.log(
      chalk.blue(`
📊 Calculating metrics...
`),
    );
    const metrics = this.calculateMetrics(results);

    // Save results
    await this.saveResults(runDir, results, metrics, options);

    // Display results
    this.displayMetrics(metrics, options);

    // Display uninvestigated failures
    this.displayUninvestigatedFailures(results);

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
    const benchmarkVectorStore = new BenchmarkVectorStore('read');

    const memoryOptions = getMemoryOptions(options.memoryConfig);
    const usesObservationalMemory = options.memoryConfig === 'observational-memory';

    // Only load BenchmarkStore for non-OM configs (OM uses PersistableInMemoryMemory)
    let benchmarkStore: BenchmarkStore | undefined;
    if (!usesObservationalMemory) {
      benchmarkStore = new BenchmarkStore('read');
      await benchmarkStore.init();
      await benchmarkStore.hydrate(join(questionDir, 'db.json'));
    }

    // Hydrate vector store if it exists
    const vectorPath = join(questionDir, 'vector.json');
    if (existsSync(vectorPath)) {
      await benchmarkVectorStore.hydrate(vectorPath);
      updateStatus(`Loading vector embeddings for ${meta.questionId}...`);
    }

    // Create memory with the hydrated stores (for non-OM configs)
    // Note: BenchmarkStore is outdated and doesn't fully implement MastraStorage
    // Using 'as any' as a workaround since OM configs use PersistableInMemoryMemory instead
    const memory = usesObservationalMemory
      ? undefined
      : new Memory({
          storage: benchmarkStore as any,
          vector: benchmarkVectorStore,
          embedder: cachedOpenAI.embedding('text-embedding-3-small'),
          options: memoryOptions.options,
        });

    // Create observational memory processor if using OM config
    let observationalMemory: ObservationalMemory | undefined;
    let messageHistory: MessageHistory | undefined;
    let omStorage: PersistableInMemoryMemory | undefined;

    if (usesObservationalMemory) {
      // Use PersistableInMemoryMemory for ObservationalMemory
      omStorage = new PersistableInMemoryMemory();

      // Hydrate OM storage from prepared data
      const omPath = join(questionDir, 'om.json');
      if (existsSync(omPath)) {
        await omStorage.hydrate(omPath);
        updateStatus(`Loaded OM data for ${meta.questionId}...`);
      }

      observationalMemory = new ObservationalMemory({
        obscureThreadIds: true, // can't show answer_x in context when we put the thread id in xml tags
        storage: omStorage,
        observer: {
          model: retry4o.model,
          observationThreshold: 100_000, // high number because the eval agent shouldn't be making observations
          focus: observationalMemoryConfig.focus,
        },
        reflector: {
          model: retry4o.model,
          reflectionThreshold: 100_000, // high number because the eval agent shouldn't be making observations
        },
        scope: observationalMemoryConfig.scope,
      });

      // MessageHistory for persisting messages
      messageHistory = new MessageHistory({
        storage: omStorage,
        lastMessages: 10,
      });
    }

    // Create agent with the specified model
    const agentInstructions = `You are a helpful assistant with access to extensive conversation history. 
When answering questions, carefully review the conversation history to identify and use any relevant user preferences, interests, or specific details they have mentioned.
For example, if the user previously mentioned they prefer a specific software, tool, or approach, tailor your recommendations to match their stated preferences.
Be specific rather than generic when the user has expressed clear preferences in past conversations. If there is a clear preference, focus in on that, and do not add additional irrelevant information.`;

    const agent = new Agent({
      id: 'longmemeval-agent',
      name: 'LongMemEval Agent',
      model: modelProvider,
      // model: 'anthropic/claude-haiku-4-5',
      // model: 'cerebras/zai-glm-4.6',
      // model: 'cerebras/gpt-oss-120b',
      instructions: agentInstructions,
      memory,
      // For OM, use processors instead of memory
      // OM handles message loading itself via cursor-based loadUnobservedMessages
      // MessageHistory must come first in output to save messages before OM observes them
      inputProcessors: usesObservationalMemory
        ? [
            observationalMemory!,
            {
              id: 'debug',
              processInputStep: args => {
                const omm = args.messageList.getSystemMessages(`observational-memory`);
                if (omm.length && omm[0]?.content) {
                  writeFileSync(
                    join(process.cwd(), 'omm.md'),
                    (omm[0].content as string) +
                      `\n\n${JSON.stringify(args.messageList.get.all.core(), null, 2)}\n\n${JSON.stringify(args.requestContext?.get('MastraMemory') || {}, null, 2)}`,
                  );
                }
                omm;
                return args.messageList;
              },
            },
          ]
        : undefined,
      // don't use output processors, this eval agent shouldn't be writing back to the db at all
      // outputProcessors: usesObservationalMemory ? [observationalMemory!] : undefined,
    });

    // Create a fresh thread for the evaluation question
    const evalThreadId = `eval_${meta.questionId}_${Date.now()}`;

    updateStatus(`${meta.threadIds.length} sessions, ${options.memoryConfig}`);

    let response = await agent.generate(meta.question, {
      threadId: evalThreadId,
      resourceId: meta.resourceId,
      modelSettings: {
        temperature: 0,
      },
      context: meta.questionDate ? [{ role: 'system', content: `Todays date is ${meta.questionDate}` }] : undefined,
    });

    console.log(
      response.text +
        `

`,
    );

    const evalAgent = new Agent({
      id: 'longmemeval-metric-agent',
      name: 'LongMemEval Metric Agent',
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
    let isCorrect = result.score === 1;

    // Check if there's an improved version - if so, we'll only retry that one
    const hasImprovedVersion = !!(meta.improvedQuestion || meta.improvedAnswer);

    // Retry failed evaluations: always at least 1 retry, up to 5 if requiresRetry is set
    // Only retry vanilla if there's NO improved version (otherwise we retry the improved one)
    let retryCount = 0;
    const maxRetries = meta.requiresRetry || hasImprovedVersion ? 2 : 0;
    while (!isCorrect && !hasImprovedVersion && retryCount < maxRetries) {
      retryCount++;
      updateStatus(`Retry ${retryCount}/${maxRetries} for ${meta.questionId}...`);

      const retryThreadId = `eval_retry_${meta.questionId}_${retryCount}_${Date.now()}`;
      const retryResponse = await agent.generate(meta.question, {
        threadId: retryThreadId,
        resourceId: meta.resourceId,
        modelSettings: {
          temperature: 0,
        },
        context: meta.questionDate ? [{ role: 'system', content: `Todays date is ${meta.questionDate}` }] : undefined,
      });

      const retryResult = await metric.measure(input, retryResponse.text);
      if (retryResult.score === 1) {
        isCorrect = true;
        // Update response to the successful retry for logging
        response = retryResponse;
      }
    }
    const didRetry = retryCount > 0;

    // Run improved evaluation if improved question OR improved answer exists
    let improvedHypothesis: string | undefined;
    let improvedIsCorrect: boolean | undefined;

    // Normalize: if only improvedAnswer exists, copy the original question to improvedQuestion
    // This simplifies the logic - we always run a "fixed" evaluation if either field is set
    const improvedQuestion = meta.improvedQuestion ?? (meta.improvedAnswer ? meta.question : undefined);
    const improvedAnswer = meta.improvedAnswer ?? meta.answer;

    if (improvedQuestion) {
      // If the improved question is the same as the original (only answer changed),
      // reuse the vanilla response. Otherwise, run a new query.
      if (improvedQuestion === meta.question) {
        improvedHypothesis = response.text;
      } else {
        updateStatus(`Running improved question for ${meta.questionId}...`);

        // Create a separate thread for the improved question evaluation
        const improvedThreadId = `eval_improved_${meta.questionId}_${Date.now()}`;

        const improvedResponse = await agent.generate(improvedQuestion, {
          threadId: improvedThreadId,
          resourceId: meta.resourceId,
          modelSettings: {
            temperature: 0,
          },
          context: meta.questionDate ? [{ role: 'system', content: `Todays date is ${meta.questionDate}` }] : undefined,
        });

        improvedHypothesis = improvedResponse.text;
      }

      const improvedInput = JSON.stringify({
        question: improvedQuestion,
        answer: improvedAnswer,
      });

      const improvedResult = await metric.measure(improvedInput, improvedHypothesis);
      improvedIsCorrect = improvedResult.score === 1;

      // Retry improved version: always retry at least once, up to 5 times if requiresRetry is set
      const improvedMaxRetries = meta.requiresRetry ? maxRetries : 1;
      let improvedRetryCount = 0;
      while (!improvedIsCorrect && improvedRetryCount < improvedMaxRetries) {
        improvedRetryCount++;
        updateStatus(`Retry improved ${improvedRetryCount}/${improvedMaxRetries} for ${meta.questionId}...`);

        const retryThreadId = `eval_improved_retry_${meta.questionId}_${improvedRetryCount}_${Date.now()}`;
        const retryResponse = await agent.generate(improvedQuestion, {
          threadId: retryThreadId,
          resourceId: meta.resourceId,
          modelSettings: {
            temperature: 0,
          },
          context: meta.questionDate ? [{ role: 'system', content: `Todays date is ${meta.questionDate}` }] : undefined,
        });

        const retryResult = await metric.measure(improvedInput, retryResponse.text);
        if (retryResult.score === 1) {
          improvedIsCorrect = true;
          improvedHypothesis = retryResponse.text;
        }
      }
    }

    const elapsed = ((Date.now() - questionStart) / 1000).toFixed(1);

    const isOraSpinner = spinner && 'clear' in spinner;
    if (isOraSpinner) {
      // Show vanilla result (with retry indicator if applicable)
      const retryIndicator = didRetry
        ? isCorrect
          ? chalk.yellow(` (retry ${retryCount}/${maxRetries} ✓)`)
          : chalk.gray(` (retry ${retryCount}/${maxRetries} ✗)`)
        : '';
      console.log(
        chalk.blue(`▶ ${meta.questionId}`),
        chalk.gray(`(${meta.questionType})`),
        chalk[isCorrect ? 'green' : 'red'](`${isCorrect ? '✓' : '✗'}`),
        retryIndicator,
        chalk.gray(`${elapsed}s`),
      );
      if (!isCorrect) {
        console.log(chalk.gray(`  Q: "${meta.question}"`));
        console.log(chalk.gray(`  A: "${response.text}"`));
        console.log(chalk.yellow(`  Expected: "${meta.answer}"`));
      }

      // Show improved result if applicable
      if (improvedQuestion) {
        // Show whether it's an improved question or just improved answer
        const label = meta.improvedQuestion ? 'improved Q' : 'improved A';
        console.log(
          chalk.cyan(`  ↳ ${label}:`),
          chalk[improvedIsCorrect ? 'green' : 'red'](`${improvedIsCorrect ? '✓' : '✗'}`),
        );
        console.log(chalk.gray(`    Q: "${improvedQuestion}"`));
        console.log(chalk.gray(`    A: "${improvedHypothesis}"`));
        if (!improvedIsCorrect) {
          console.log(chalk.yellow(`    Expected: "${improvedAnswer}"`));
        }
      }
    }

    return {
      question_id: meta.questionId,
      question: meta.question,
      expected_answer: meta.answer,
      hypothesis: response.text,
      question_type: meta.questionType as QuestionType,
      is_correct: isCorrect,
      improved_question: improvedQuestion,
      improved_hypothesis: improvedHypothesis,
      improved_is_correct: improvedIsCorrect,
      has_improvement_info: !!(meta.improvedQuestion || meta.improvedAnswer || meta.improvementNote),
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
    const usesObservationalMemory = options.memoryConfig === 'observational-memory';
    const metricsData = {
      ...metrics,
      config: {
        dataset: options.dataset,
        model: options.model,
        memoryConfig: options.memoryConfig,
        subset: options.subset,
        // Store OM config for reproducibility (actual values used, with defaults as fallback)
        ...(usesObservationalMemory && {
          observationalMemoryConfig: {
            scope: observationalMemoryConfig.scope,
            focus: observationalMemoryConfig.focus,
            observationThreshold:
              (observationalMemoryConfig as any).observationThreshold ??
              OBSERVATIONAL_MEMORY_DEFAULTS.observer.observationThreshold,
            reflectionThreshold:
              (observationalMemoryConfig as any).reflectionThreshold ??
              OBSERVATIONAL_MEMORY_DEFAULTS.reflector.reflectionThreshold,
            observerModel:
              (observationalMemoryConfig as any).observerModel ?? OBSERVATIONAL_MEMORY_DEFAULTS.observer.model,
            reflectorModel:
              (observationalMemoryConfig as any).reflectorModel ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflector.model,
          },
        }),
      },
      timestamp: new Date().toISOString(),
    };
    await writeFile(metricsPath, JSON.stringify(metricsData, null, 2));

    console.log(
      chalk.gray(`
Results saved to: ${runDir}`),
    );
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
      // "Fixed" metrics - uses improved_is_correct where available, otherwise is_correct
      improved_accuracy: undefined,
      improved_correct: 0,
      improved_total: 0,
      fixed_accuracy_by_type: {} as Record<QuestionType, { correct: number; total: number; accuracy: number }>,
      fixed_overall_accuracy: undefined,
    };

    // Check if any results have improved questions
    const hasAnyImprovedQuestions = results.some(r => r.improved_question !== undefined);

    // Calculate overall metrics
    for (const result of results) {
      // Vanilla metrics (original question only)
      if (result.is_correct) {
        metrics.correct_answers++;
      }

      // Track how many questions have improved versions
      if (result.improved_question !== undefined) {
        metrics.improved_total = (metrics.improved_total || 0) + 1;
        if (result.improved_is_correct) {
          metrics.improved_correct = (metrics.improved_correct || 0) + 1;
        }
      }

      // Track by question type (vanilla)
      if (result.question_type) {
        const type = result.question_type;
        if (!metrics.accuracy_by_type[type]) {
          metrics.accuracy_by_type[type] = { correct: 0, total: 0, accuracy: 0 };
        }
        metrics.accuracy_by_type[type].total++;
        if (result.is_correct) {
          metrics.accuracy_by_type[type].correct++;
        }

        // Track "fixed" metrics by type (use improved result if available, otherwise vanilla)
        if (hasAnyImprovedQuestions) {
          if (!metrics.fixed_accuracy_by_type![type]) {
            metrics.fixed_accuracy_by_type![type] = { correct: 0, total: 0, accuracy: 0 };
          }
          metrics.fixed_accuracy_by_type![type].total++;

          // Use improved_is_correct if this question has an improved version, otherwise use is_correct
          const isCorrectFixed =
            result.improved_question !== undefined ? result.improved_is_correct : result.is_correct;
          if (isCorrectFixed) {
            metrics.fixed_accuracy_by_type![type].correct++;
          }
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

    // Calculate per-type accuracies (vanilla)
    for (const type in metrics.accuracy_by_type) {
      const typeMetrics = metrics.accuracy_by_type[type as QuestionType];
      if (typeMetrics) {
        typeMetrics.accuracy = typeMetrics.total > 0 ? typeMetrics.correct / typeMetrics.total : 0;
      }
    }

    // Calculate per-type accuracies (fixed)
    if (hasAnyImprovedQuestions && metrics.fixed_accuracy_by_type) {
      for (const type in metrics.fixed_accuracy_by_type) {
        const typeMetrics = metrics.fixed_accuracy_by_type[type as QuestionType];
        if (typeMetrics) {
          typeMetrics.accuracy = typeMetrics.total > 0 ? typeMetrics.correct / typeMetrics.total : 0;
        }
      }
    }

    if (metrics.abstention_total && metrics.abstention_total > 0) {
      metrics.abstention_accuracy = (metrics.abstention_correct || 0) / metrics.abstention_total;
    }

    // Calculate overall accuracy as average of all question type accuracies (vanilla)
    const allTypeAccuracies = Object.values(metrics.accuracy_by_type).map(t => t.accuracy);
    metrics.overall_accuracy =
      allTypeAccuracies.length > 0
        ? allTypeAccuracies.reduce((sum, acc) => sum + acc, 0) / allTypeAccuracies.length
        : 0;

    // Calculate fixed overall accuracy
    if (hasAnyImprovedQuestions && metrics.fixed_accuracy_by_type) {
      const fixedTypeAccuracies = Object.values(metrics.fixed_accuracy_by_type).map(t => t.accuracy);
      metrics.fixed_overall_accuracy =
        fixedTypeAccuracies.length > 0
          ? fixedTypeAccuracies.reduce((sum, acc) => sum + acc, 0) / fixedTypeAccuracies.length
          : 0;
    }

    return metrics;
  }

  private displayMetrics(metrics: BenchmarkMetrics, options?: RunOptions): void {
    console.log(
      chalk.bold(`
📊 Benchmark Results
`),
    );

    // Display configuration if provided
    if (options) {
      console.log(
        chalk.bold(`Configuration:
`),
      );
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

    // Check if we have fixed metrics to display
    const hasFixedMetrics = metrics.fixed_accuracy_by_type && Object.keys(metrics.fixed_accuracy_by_type).length > 0;

    // Question type breakdown
    console.log(chalk.bold('Accuracy by Question Type:'));

    // Sort question types alphabetically
    const sortedTypes = Object.entries(metrics.accuracy_by_type).sort(([a], [b]) => a.localeCompare(b));

    // Helper to create progress bar
    const createBar = (accuracy: number, length: number = 20) => {
      const filledLength = Math.round(accuracy * length);
      return '█'.repeat(filledLength) + '░'.repeat(length - filledLength);
    };

    // Helper to get color based on accuracy
    const getColor = (accuracy: number) => (accuracy >= 0.8 ? 'green' : accuracy >= 0.6 ? 'yellow' : 'red');

    // Display regular question types (vanilla)
    for (const [type, typeMetrics] of sortedTypes) {
      const { correct, total, accuracy } = typeMetrics;
      const typeColor = getColor(accuracy);

      console.log(
        chalk.gray(`  ${type.padEnd(25)}:`),
        chalk[typeColor](`${(accuracy * 100).toFixed(1).padStart(5)}%`),
        chalk.gray(`[${createBar(accuracy)}]`),
        chalk.gray(`(${correct}/${total})`),
      );

      // If we have fixed metrics, show the fixed version right after
      if (hasFixedMetrics && metrics.fixed_accuracy_by_type![type as QuestionType]) {
        const fixedTypeMetrics = metrics.fixed_accuracy_by_type![type as QuestionType];
        const fixedColor = getColor(fixedTypeMetrics.accuracy);
        console.log(
          chalk.gray(`  ${(type + ' (fixed)').padEnd(25)}:`),
          chalk[fixedColor](`${(fixedTypeMetrics.accuracy * 100).toFixed(1).padStart(5)}%`),
          chalk.gray(`[${createBar(fixedTypeMetrics.accuracy)}]`),
          chalk.gray(`(${fixedTypeMetrics.correct}/${fixedTypeMetrics.total})`),
        );
      }
    }

    console.log();

    // Overall accuracy (vanilla)
    const accuracyColor = getColor(metrics.overall_accuracy);
    console.log(
      chalk.bold('Overall Accuracy:        '),
      chalk[accuracyColor](`${(metrics.overall_accuracy * 100).toFixed(2)}%`),
      chalk.gray(`(average of ${Object.keys(metrics.accuracy_by_type).length} question types)`),
    );

    // Overall accuracy (fixed) - shown if any improved questions exist
    if (hasFixedMetrics && metrics.fixed_overall_accuracy !== undefined) {
      const fixedAccuracyColor = getColor(metrics.fixed_overall_accuracy);
      console.log(
        chalk.bold('Overall Accuracy (fixed):'),
        chalk[fixedAccuracyColor](`${(metrics.fixed_overall_accuracy * 100).toFixed(2)}%`),
        chalk.gray(`(${metrics.improved_total} questions clarified)`),
      );
    }
  }

  private displayUninvestigatedFailures(results: EvaluationResult[]): void {
    // Find failures that have no improvement info (not yet investigated)
    const uninvestigatedFailures = results.filter(r => r.is_correct === false && !r.has_improvement_info);

    if (uninvestigatedFailures.length === 0) {
      return;
    }

    console.log(
      chalk.yellow(`
🔍 Failures for Investigation (${uninvestigatedFailures.length})
`),
    );
    console.log(
      chalk.gray('These questions failed and have no improved_question, improved_answer, or improvement_note:\n'),
    );

    // Group by question type for easier review
    const byType = new Map<string, EvaluationResult[]>();
    for (const result of uninvestigatedFailures) {
      const type = result.question_type || 'unknown';
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(result);
    }

    // Display grouped by type
    for (const [type, failures] of Array.from(byType.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(chalk.cyan(`  ${type}:`));
      for (const result of failures) {
        console.log(chalk.gray(`    - ${result.question_id}`));
        console.log(chalk.gray(`      Q: "${result.question}"`));
        console.log(chalk.gray(`      A: "${result.hypothesis}"`));
        console.log(chalk.yellow(`      Expected: "${result.expected_answer}"`));
      }
    }

    console.log();
  }
}
