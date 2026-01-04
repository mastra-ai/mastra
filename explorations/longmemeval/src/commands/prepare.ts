import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { ObservationalMemory, OBSERVATIONAL_MEMORY_DEFAULTS } from '@mastra/memory/experiments';
import { MessageHistory } from '@mastra/core/processors';
import { MockLanguageModelV1, MockLanguageModelV2 } from '../test-utils/mock-model';
import { cachedOpenAI } from '../embeddings/cached-openai-provider';
import { embeddingCacheStats } from '../embeddings';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';

import { DatasetLoader } from '../data/loader';
import { BenchmarkStore, BenchmarkVectorStore, PersistableInMemoryMemory } from '../storage';
import type { LongMemEvalQuestion, MemoryConfigOptions, MemoryConfigType } from '../data/types';
import type { CoreMessage } from 'ai';

import { getMemoryOptions, observationalMemoryConfig } from '../config';
import { makeRetryModel } from '../retry-model';
import { google } from '@ai-sdk/google';

const retry4o = makeRetryModel(google('gemini-2.5-flash'));

export interface PrepareOptions {
  dataset: 'longmemeval_s' | 'longmemeval_m' | 'longmemeval_oracle';
  memoryConfig: MemoryConfigType;
  outputDir?: string;
  subset?: number;
  concurrency?: number;
  questionId?: string;
  resumeFromMessageId?: string;
  sessionLimit?: number;
  sessionOffset?: number;
}

export class PrepareCommand {
  private loader: DatasetLoader;
  private baseDir: string;

  constructor() {
    this.loader = new DatasetLoader();
    this.baseDir = './prepared-data';
  }

  async run(options: PrepareOptions): Promise<void> {
    console.log(chalk.blue('\n🔧 Preparing LongMemEval Data\n'));

    // Reset embedding cache statistics for this run
    embeddingCacheStats.reset();

    // Load dataset
    const spinner = ora('Loading dataset...').start();
    const questions = await this.loader.loadDataset(options.dataset);
    spinner.succeed(`Loaded ${questions.length} questions`);

    // Load working memory templates if using tailored working memory
    let wmTemplates: Record<string, any> = {};
    const usesTailoredWorkingMemory =
      options.memoryConfig === 'working-memory-tailored' || options.memoryConfig === 'combined-tailored';
    if (usesTailoredWorkingMemory) {
      const templatePath = join(this.baseDir, 'wm-templates', `${options.dataset}.json`);
      if (existsSync(templatePath)) {
        try {
          wmTemplates = JSON.parse(await readFile(templatePath, 'utf-8'));
          console.log(chalk.green(`✓ Loaded ${Object.keys(wmTemplates).length} working memory templates`));
        } catch (e) {
          console.log(chalk.yellow('⚠️  Could not load working memory templates, using default'));
        }
      } else {
        console.log(chalk.yellow('⚠️  No working memory templates found, using default'));
        console.log(chalk.gray('Run "pnpm generate-wm-templates" to generate them'));
      }
    }

    // Filter by questionId if specified
    let questionsToProcess = questions;
    if (options.questionId) {
      questionsToProcess = questions.filter(q => q.question_id === options.questionId);
      if (questionsToProcess.length === 0) {
        throw new Error(`Question with ID "${options.questionId}" not found in dataset`);
      }
      console.log(chalk.yellow(`\nFocusing on question: ${options.questionId}\n`));
    } else if (options.subset) {
      // Apply subset if requested
      questionsToProcess = questions.slice(0, options.subset);
    }

    console.log(
      chalk.yellow(`\nProcessing ${questionsToProcess.length} question${questionsToProcess.length !== 1 ? 's' : ''}\n`),
    );

    // Get memory configuration
    const memoryOptions = getMemoryOptions(options.memoryConfig);

    // Use real model for working memory and observational memory, mock for others
    const needsRealModel =
      options.memoryConfig === 'working-memory' ||
      options.memoryConfig === 'working-memory-tailored' ||
      options.memoryConfig === 'combined' ||
      options.memoryConfig === 'combined-tailored' ||
      options.memoryConfig === 'observational-memory';

    if (needsRealModel && !process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for working memory or observational memory preparation');
    }

    const model = needsRealModel
      ? retry4o.model
      : new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
          }),
        });

    // Track active questions progress
    const activeQuestions = new Map<
      number,
      { questionId: string; status: string; totalSessions?: number; processedSessions?: number; questionType?: string }
    >();

    // Create main progress spinner
    const mainSpinner = ora('Starting data preparation...').start();

    let processedCount = 0;
    let cachedCount = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    const startTime = Date.now();

    // Determine question batch size based on config
    const questionConcurrency = options.concurrency || 10; // Allow concurrency for all configs

    console.log(chalk.gray(`Question concurrency: ${questionConcurrency}`));

    // Warn about working memory concurrency
    if ((options.memoryConfig === 'working-memory' || options.memoryConfig === 'combined') && questionConcurrency > 1) {
      console.log(
        chalk.yellow(
          `⚠️  Note: Running working memory questions concurrently. Each question has its own resource scope.`,
        ),
      );
    }

    let lastText = ``;
    // Function to update progress display
    const updateProgress = () => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = elapsed > 0 ? completedCount / elapsed : 0;
      const remaining = rate > 0 ? Math.round((questionsToProcess.length - completedCount) / rate) : 0;

      // Build progress text with active questions
      let progressText = `Overall: ${completedCount}/${questionsToProcess.length} (${inProgressCount} in progress, ${cachedCount} cached, ~${remaining}s remaining)`;

      // Add embedding cache stats if available
      const totalEmbeddingOps = embeddingCacheStats.cacheHits + embeddingCacheStats.cacheMisses;
      if (totalEmbeddingOps > 0) {
        const hitRate = embeddingCacheStats.cacheHits / totalEmbeddingOps;
        progressText += `\nEmbedding cache: ${embeddingCacheStats.cacheHits} hits, ${embeddingCacheStats.cacheMisses} misses (${(hitRate * 100).toFixed(1)}% hit rate)`;
      }

      progressText += `\nRate limit count: ${retry4o.state.rateLimitCount}`;
      if (retry4o.state.pauseTime > 0 && retry4o.state.pause)
        progressText += ` (paused, waiting for ${retry4o.state.pauseTime}ms)`;

      if (activeQuestions.size > 0) {
        progressText += '\n\nActive questions:';

        // Sort active questions by completion percentage
        const sortedQuestions = Array.from(activeQuestions.entries())
          .map(([index, info]) => {
            const progress =
              info.processedSessions && info.totalSessions ? info.processedSessions / info.totalSessions : 0;
            return { index, info, progress };
          })
          .sort((a, b) => b.progress - a.progress); // Sort by most complete first

        sortedQuestions.forEach(({ info, progress }) => {
          const percentage = (progress * 100).toFixed(0);
          progressText += `\n ${info.status} (${percentage}%) ${chalk.grey(info.questionType || '')}`;
        });
      }

      if (lastText !== progressText) {
        lastText = progressText;
        mainSpinner.text = progressText;
      }
    };

    // Create a queue of questions to process
    const questionQueue = [...questionsToProcess];
    let questionIndex = 0;

    // Function to process next question from queue
    const processNextQuestion = async (slotIndex: number): Promise<void> => {
      while (questionQueue.length > 0) {
        const question = questionQueue.shift();
        if (!question) break;

        const currentIndex = questionIndex++;

        // Check if already prepared
        const questionDir = join(
          options.outputDir || this.baseDir,
          options.dataset,
          options.memoryConfig,
          question.question_id,
        );

        // Check if question has failed previously
        const progressPath = join(questionDir, 'progress.json');
        if (existsSync(progressPath)) {
          try {
            const progress = JSON.parse(await readFile(progressPath, 'utf-8'));
            if (progress.failed) {
              // Retry failed questions
              mainSpinner.clear();
              console.log(
                chalk.yellow(`↻`),
                chalk.blue(`${question.question_id}`),
                chalk.gray(`(${question.question_type})`),
                chalk.yellow(`[retrying previously failed]`),
              );
              mainSpinner.render();

              // Delete the failed progress file to start fresh
              await unlink(progressPath);

              // Continue processing this question normally (don't skip)
            }
          } catch (e) {
            // If we can't read progress, continue with normal processing
          }
        }

        // Skip cache check if we're resuming from a specific message
        if (!options.resumeFromMessageId && existsSync(join(questionDir, 'meta.json'))) {
          cachedCount++;
          completedCount++;

          mainSpinner.clear();
          console.log(
            chalk.green(`✓`),
            chalk.blue(`${question.question_id}`),
            chalk.gray(`(${question.question_type})`),
            chalk.yellow(`[cached]`),
            chalk.gray(`- ${completedCount}/${questionsToProcess.length}`),
          );
          mainSpinner.render();

          // Update progress
          updateProgress();

          // Continue to next question
          continue;
        }

        // Mark as in progress
        inProgressCount++;
        activeQuestions.set(slotIndex, { questionId: question.question_id, status: 'Starting...' });
        updateProgress();

        try {
          await this.processQuestion(
            question,
            options,
            model,
            memoryOptions,
            true,
            slotIndex,
            activeQuestions,
            wmTemplates,
          );

          // Mark as completed
          inProgressCount--;
          processedCount++;
          completedCount++;

          // Remove from active questions
          activeQuestions.delete(slotIndex);

          mainSpinner.clear();
          console.log(
            chalk.green(`✓`),
            chalk.blue(`${question.question_id}`),
            chalk.gray(`(${question.question_type})`),
            chalk.gray(`${question.haystack_sessions.length} sessions`),
            chalk.gray(`- ${completedCount}/${questionsToProcess.length}`),
          );
          mainSpinner.render();
        } catch (error) {
          console.error(`Error processing question ${question.question_id}:`, error);
          // Check if this is a rate limit error
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isRateLimitError =
            errorMessage.includes('Rate limit') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('RPM') ||
            errorMessage.includes('TPM') ||
            errorMessage.includes('429');

          if (isRateLimitError) {
            // Don't mark as failed for rate limits - just skip this run
            inProgressCount--;

            // Remove from active questions
            activeQuestions.delete(slotIndex);

            mainSpinner.clear();
            console.log(
              chalk.yellow(`⏸`),
              chalk.blue(`${question.question_id}`),
              chalk.gray(`(${question.question_type})`),
              chalk.yellow(`Rate limited - will retry later`),
              chalk.gray(`- ${completedCount}/${questionsToProcess.length}`),
            );
            mainSpinner.render();

            // Re-add to the end of the queue to retry later
            questionQueue.push(question);

            // Add a small delay to help with rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          } else {
            // Mark as completed but failed for non-rate-limit errors
            inProgressCount--;
            completedCount++;

            // Remove from active questions
            activeQuestions.delete(slotIndex);

            mainSpinner.clear();
            console.log(
              chalk.red(`✗`),
              chalk.blue(`${question.question_id}`),
              chalk.gray(`(${question.question_type})`),
              chalk.red(`Failed: ${errorMessage}`),
              chalk.gray(`- ${completedCount}/${questionsToProcess.length}`),
            );
            mainSpinner.render();

            // Save error state to progress file
            const questionDir = join(
              options.outputDir || this.baseDir,
              options.dataset,
              options.memoryConfig,
              question.question_id,
            );
            const progressFile = join(questionDir, 'progress.json');

            try {
              await mkdir(questionDir, { recursive: true });

              // Try to load existing progress if available
              let existingProgress = { processedSessionIds: [] };
              if (existsSync(progressFile)) {
                existingProgress = JSON.parse(await readFile(progressFile, 'utf-8'));
              }

              await writeFile(
                progressFile,
                JSON.stringify(
                  {
                    processedSessionIds: existingProgress.processedSessionIds || [],
                    completed: true,
                    failed: true,
                    error: errorMessage,
                    failedAt: new Date().toISOString(),
                  },
                  null,
                  2,
                ),
              );
            } catch (saveError) {
              console.error(chalk.red(`Failed to save error state: ${saveError}`));
            }
          }
        }

        updateProgress();
      }
    };

    const progressInterval = setInterval(updateProgress, 500);
    const workers = Array.from({ length: questionConcurrency }, (_, i) => processNextQuestion(i));
    await Promise.all(workers);
    clearInterval(progressInterval);
    updateProgress();

    mainSpinner.succeed(`Prepared ${processedCount} questions (${cachedCount} from cache)`);
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(chalk.gray(`Total time: ${totalTime}s (${Math.round((processedCount / totalTime) * 60)} q/min)`));

    // Display embedding cache statistics if any embeddings were processed
    const totalEmbeddingOps = embeddingCacheStats.cacheHits + embeddingCacheStats.cacheMisses;
    if (totalEmbeddingOps > 0) {
      const hitRate = embeddingCacheStats.cacheHits / totalEmbeddingOps;
      console.log(
        chalk.gray(
          `Embedding cache: ${embeddingCacheStats.cacheHits} hits, ${embeddingCacheStats.cacheMisses} misses, ${embeddingCacheStats.cacheWrites} writes (${(hitRate * 100).toFixed(1)}% hit rate)`,
        ),
      );
    }

    console.log(chalk.green('\n✅ Data preparation complete!\n'));
    console.log(chalk.gray(`Prepared data saved to: ${this.baseDir}/${options.dataset}/${options.memoryConfig}/`));
  }

  private async processQuestion(
    question: LongMemEvalQuestion,
    options: PrepareOptions,
    model: any,
    memoryOptions: MemoryConfigOptions,
    isConcurrent: boolean = false,
    slotIndex?: number,
    activeQuestions?: Map<
      number,
      { questionId: string; status: string; totalSessions?: number; processedSessions?: number; questionType?: string }
    >,
    wmTemplates?: Record<string, any>,
  ): Promise<void> {
    // Create fresh storage instances for this question
    const benchmarkStore = new PersistableInMemoryMemory();
    const benchmarkVectorStore = new BenchmarkVectorStore();

    // Initialize stores
    // await benchmarkStore.init();

    // Create vector index if using semantic recall
    if (options.memoryConfig === 'semantic-recall' || options.memoryConfig.includes('combined')) {
      await benchmarkVectorStore.createIndex({
        indexName: 'memory_messages',
        dimension: 1536, // text-embedding-3-small dimension
        metric: 'cosine',
      });
    }

    const usesWorkingMemory =
      options.memoryConfig === 'working-memory' ||
      options.memoryConfig === 'working-memory-tailored' ||
      options.memoryConfig === 'combined' ||
      options.memoryConfig === 'combined-tailored';
    const usesObservationalMemory = options.memoryConfig === 'observational-memory';
    const usesTailoredTemplate =
      options.memoryConfig === 'working-memory-tailored' || options.memoryConfig === 'combined-tailored';

    // Working memory and observational memory must run one session (thread) at a time, in order
    // otherwise the data will not be accurate as memory is meant
    // to build up over time, using the previous state to create the next.
    if (usesWorkingMemory || usesObservationalMemory) isConcurrent = false;

    // Use custom template if available for tailored configs
    if (usesTailoredTemplate && wmTemplates && wmTemplates[question.question_id]) {
      memoryOptions.options.workingMemory = {
        enabled: true,
        template: wmTemplates[question.question_id].template,
        scope: 'resource',
      };
      // if (!isConcurrent) {
      //   console.log(chalk.cyan('  Using tailored working memory template'));
      // }
    }

    // Create memory with appropriate configuration
    // Note: Using 'as any' to work around outdated BenchmarkStore types
    const memory = new Memory({
      storage: benchmarkStore as any,
      vector:
        options.memoryConfig === 'semantic-recall' || options.memoryConfig.includes('combined')
          ? benchmarkVectorStore
          : undefined,
      embedder:
        options.memoryConfig === 'semantic-recall' || options.memoryConfig.includes('combined')
          ? cachedOpenAI.embedding('text-embedding-3-small')
          : undefined,
      options: memoryOptions.options,
    });

    // Create observational memory processor if using OM config
    let observationalMemory: ObservationalMemory | undefined;
    let messageHistory: MessageHistory | undefined;
    let omStorage: PersistableInMemoryMemory | undefined;

    // Debug state for OM events (will be initialized after questionDir is known)
    const omDebugState = {
      debugLogFile: '',
      eventCount: 0,
    };

    if (usesObservationalMemory) {
      // Use PersistableInMemoryMemory for ObservationalMemory (has persist/hydrate)
      omStorage = new PersistableInMemoryMemory();

      // For OM: use REAL model for Observer/Reflector subagents (they need real LLMs to extract observations)
      observationalMemory = new ObservationalMemory({
        storage: omStorage,
        observer: {
          model: model, // Real model for Observer
          // Using defaults (observationThreshold: 10000)
          observationThreshold: 30000,
        },
        reflector: {
          model: model, // Real model for Reflector
          reflectionThreshold: 20000,
          // Using defaults (reflectionThreshold: 30000)
        },
        scope: observationalMemoryConfig.scope,
        // Debug callback to log all observation events to a file
        onDebugEvent: async (event: any) => {
          if (!omDebugState.debugLogFile) return; // Skip if not initialized yet
          omDebugState.eventCount++;
          const logEntry = {
            eventNumber: omDebugState.eventCount,
            ...event,
            timestamp: event.timestamp.toISOString(),
          };
          // Write to debug log file (append)
          await writeFile(
            omDebugState.debugLogFile,
            (omDebugState.eventCount === 1 ? '' : '\n') + JSON.stringify(logEntry, null, 2),
            { flag: 'a' },
          );
          // Also log summary to console
          if (event.type === 'observation_triggered') {
            console.log(
              chalk.yellow(`  [OM DEBUG] Observation triggered with ${event.messages?.length ?? 0} messages`),
            );
          } else if (event.type === 'observation_complete') {
            console.log(chalk.green(`  [OM DEBUG] Observation complete: ${event.observations?.substring(0, 100)}...`));
          } else if (event.type === 'tokens_accumulated') {
            console.log(
              chalk.dim(
                `  [OM DEBUG] Tokens accumulated: ${event.sessionTokens} (total: ${event.totalPendingTokens}/${event.threshold})`,
              ),
            );
          }
        },
      });

      // MessageHistory for persisting messages
      messageHistory = new MessageHistory({
        storage: omStorage,
        lastMessages: 10, // Keep last 10 for context
      });
    }

    // For OM: use mock model for main agent (it doesn't generate real responses during ingestion)
    // Only the Observer/Reflector subagents need real LLMs
    const mockAgentModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [],
        warnings: [],
      }),
      // No streaming needed for ingestion
    });

    // Create agent with appropriate model and processors
    const agent = new Agent({
      id: 'prep-agent',
      name: 'Prep Agent',
      instructions: usesObservationalMemory
        ? `You are a helpful assistant. Process and store conversation history.`
        : "You are a helpful assistant. Process and store conversation history. Only store working memory information if it's in the template. Other information is not relevant",
      model: usesObservationalMemory ? mockAgentModel : model,
      memory: usesObservationalMemory ? undefined : memory,
      // For OM, use processors instead of memory
      inputProcessors: usesObservationalMemory ? [observationalMemory!] : undefined,
      outputProcessors: usesObservationalMemory ? [messageHistory!, observationalMemory!] : undefined,
    });

    // Process all haystack sessions
    const resourceId = `resource_${question.question_id}`;

    // Sort sessions by date for chronological processing (important for working memory)
    const sessionsWithDates = question.haystack_sessions.map((session, index) => ({
      session,
      sessionId: question.haystack_session_ids[index],
      date: question.haystack_dates[index],
    }));

    // Sort by date (oldest first)
    sessionsWithDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Debug: Log first and last dates to confirm sorting
    if (sessionsWithDates.length > 0 && !isConcurrent) {
      // const firstDate = new Date(sessionsWithDates[0].date).toISOString().split('T')[0];
      // const lastDate = new Date(sessionsWithDates[sessionsWithDates.length - 1].date).toISOString().split('T')[0];
      // console.log(chalk.gray(`  Sessions sorted: ${firstDate} (oldest) → ${lastDate} (newest)`));
    }

    // Create output directory early to save progress
    const questionDir = join(
      options.outputDir || this.baseDir,
      options.dataset,
      options.memoryConfig,
      question.question_id,
    );
    await mkdir(questionDir, { recursive: true });

    // Initialize OM debug log file path now that questionDir is known
    if (usesObservationalMemory) {
      omDebugState.debugLogFile = join(questionDir, 'om-debug.jsonl');
      // Clear any existing debug log
      if (existsSync(omDebugState.debugLogFile)) {
        await unlink(omDebugState.debugLogFile);
      }
    }

    // Check if this question has partial progress saved
    const progressFile = join(questionDir, 'progress.json');
    let processedSessionIds: Set<string> = new Set();

    // Always try to load existing db.json if it exists (for resume scenarios)
    const dbPath = join(questionDir, 'db.json');
    const vectorPath = join(questionDir, 'vector.json');

    if (existsSync(dbPath)) {
      // console.log(chalk.gray('Loading existing database...'));
      await benchmarkStore.hydrate(dbPath);
    }

    if (
      existsSync(vectorPath) &&
      (options.memoryConfig === 'semantic-recall' || options.memoryConfig.includes('combined'))
    ) {
      // console.log(chalk.gray('Loading existing vector store...'));
      await benchmarkVectorStore.hydrate(vectorPath);
    }

    if (existsSync(progressFile)) {
      try {
        const progress = JSON.parse(await readFile(progressFile, 'utf-8'));
        processedSessionIds = new Set(progress.processedSessionIds || []);

        if (slotIndex !== undefined && activeQuestions) {
          activeQuestions.set(slotIndex, {
            questionId: question.question_id,
            status: `Resuming from session ${processedSessionIds.size}/${sessionsWithDates.length}`,
          });
        }
      } catch (e) {
        console.log(chalk.red(`Failed to load progress for ${question.question_id}:`));
        console.error(e);
        if (options.resumeFromMessageId) {
          console.log(chalk.red(`Cannot resume without valid progress data. Exiting.`));
          process.exit(1);
        }
        processedSessionIds = new Set();
      }
    }

    // Process sessions in batches to avoid overwhelming the system
    // Working memory and observational memory must run one at a time since each session builds on memory from previous sessions
    const BATCH_SIZE = usesWorkingMemory || usesObservationalMemory ? 1 : 50;
    let processedSessions = processedSessionIds.size;

    // Apply session offset if specified
    if (options.sessionOffset && !options.resumeFromMessageId) {
      const offsetIndex = options.sessionOffset - 1; // Convert to 0-based index
      if (offsetIndex >= 0 && offsetIndex < sessionsWithDates.length) {
        console.log(
          chalk.yellow(`\n⏭️  Starting from session ${options.sessionOffset} (skipping first ${offsetIndex} sessions)`),
        );

        // Mark all sessions before the offset as processed
        for (let i = 0; i < offsetIndex; i++) {
          processedSessionIds.add(sessionsWithDates[i].sessionId);
        }
        processedSessions = processedSessionIds.size;
      } else {
        console.log(
          chalk.red(`✗ Session offset ${options.sessionOffset} is out of range (1-${sessionsWithDates.length})`),
        );
        process.exit(1);
      }
    }

    // Apply session limit if specified
    // IMPORTANT: Always include evidence sessions (answer_session_ids) to ensure the benchmark can succeed
    let sessionsToProcess = sessionsWithDates;
    if (options.sessionLimit) {
      const startIndex = processedSessionIds.size;
      const endIndex = Math.min(startIndex + options.sessionLimit, sessionsWithDates.length);

      // Get evidence session IDs that contain the answer
      const evidenceSessionIds = new Set(question.answer_session_ids || []);

      // Find which evidence sessions are NOT in the limited range
      const sessionsInRange = sessionsWithDates.slice(0, endIndex);
      const sessionIdsInRange = new Set(sessionsInRange.map(s => s.sessionId));

      // Find evidence sessions that would be excluded
      const excludedEvidenceSessions = sessionsWithDates.filter(
        s => evidenceSessionIds.has(s.sessionId) && !sessionIdsInRange.has(s.sessionId),
      );

      if (excludedEvidenceSessions.length > 0) {
        // Include the excluded evidence sessions at the end
        sessionsToProcess = [...sessionsInRange, ...excludedEvidenceSessions];
        console.log(
          chalk.yellow(
            `\n📊 Processing ${sessionsToProcess.length} sessions (${options.sessionLimit} + ${excludedEvidenceSessions.length} evidence sessions)`,
          ),
        );
        console.log(
          chalk.gray(`   Evidence sessions included: ${excludedEvidenceSessions.map(s => s.sessionId).join(', ')}`),
        );
      } else {
        sessionsToProcess = sessionsInRange;
        console.log(
          chalk.yellow(
            `\n📊 Processing limited to ${options.sessionLimit} sessions (${startIndex + 1} to ${endIndex})`,
          ),
        );
      }
    }

    for (let i = 0; i < sessionsToProcess.length; i += BATCH_SIZE) {
      const sessionBatch = sessionsToProcess.slice(i, i + BATCH_SIZE);

      // Update progress
      if (slotIndex !== undefined && activeQuestions) {
        // Calculate current session index (1-based)
        const currentSessionIndex = processedSessions + 1;
        // Update active questions status
        activeQuestions.set(slotIndex, {
          questionId: question.question_id,
          status: `${chalk.green('->')} preparing ${chalk.blue(question.question_id)}[${chalk.green(currentSessionIndex)}] ${chalk.white(`${processedSessions}/${sessionsToProcess.length} `)}`,
          totalSessions: sessionsToProcess.length,
          processedSessions,
          questionType: question.question_type,
        });
      }

      // Process batch in parallel
      const batchPromises = sessionBatch.map(async ({ session, sessionId, date }) => {
        // Skip if already processed
        if (processedSessionIds.has(sessionId)) {
          return;
        }

        // Parse session date for message timestamps
        const sessionDate = new Date(date);

        // Convert session to messages with historical timestamps
        const messages: (CoreMessage & { createdAt?: Date })[] = [];
        for (let turnIdx = 0; turnIdx < session.length; turnIdx++) {
          const turn = session[turnIdx];
          if (!turn.content) continue;

          const role = turn.role === 'user' || turn.role === 'assistant' ? turn.role : 'user';
          // Add 5 seconds offset per message to maintain order
          const messageDate = new Date(sessionDate.getTime() + turnIdx * 5 * 1000);
          messages.push({
            role,
            content: turn.content,
            createdAt: messageDate,
          });
        }

        if (messages.length > 0) {
          // For OM: process each message one at a time so Observer has multiple chances to make observations
          // If we send all messages at once, Observer only gets one chance to observe
          if (usesObservationalMemory) {
            // Process message pairs (user + assistant) one at a time
            for (let i = 0; i < messages.length; i += 2) {
              const messagePair = messages.slice(i, Math.min(i + 2, messages.length));
              try {
                await agent.generate(messagePair, {
                  memory: {
                    thread: sessionId,
                    resource: resourceId,
                    options: memoryOptions.options,
                  },
                  modelSettings: {
                    temperature: 0,
                  },
                });
              } catch (error) {
                console.error(
                  `Error in agent.generate for ${question.question_id}, session ${sessionId}, message ${i}:`,
                  error,
                );
                throw error;
              }
            }
          } else {
            // For non-OM configs, process all messages at once (existing behavior)
            try {
              await agent.generate(messages, {
                memory: {
                  thread: sessionId, // Use haystack session ID as thread ID
                  resource: resourceId,
                  options: memoryOptions.options,
                },
                modelSettings: {
                  temperature: 0,
                },
              });
            } catch (error) {
              console.error(`Error in agent.generate for ${question.question_id}, session ${sessionId}:`, error);
              throw error;
            }
          }
        }

        // Mark as processed
        processedSessionIds.add(sessionId);

        // Save progress after each session if using working memory or observational memory
        if (usesWorkingMemory || usesObservationalMemory) {
          await writeFile(
            progressFile,
            JSON.stringify({
              processedSessionIds: Array.from(processedSessionIds),
              lastSavedDb: 'db.json',
              lastSavedVector: 'vector.json',
              lastSavedOm: usesObservationalMemory ? 'om.json' : undefined,
            }),
          );

          // Persist current state
          if (usesObservationalMemory && omStorage) {
            await omStorage.persist(join(questionDir, 'om.json'));
          } else {
            await benchmarkStore.persist(join(questionDir, 'db.json'));
          }
          if (options.memoryConfig === 'semantic-recall' || options.memoryConfig.includes('combined')) {
            await benchmarkVectorStore.persist(join(questionDir, 'vector.json'));
          }
        }
      });

      await Promise.all(batchPromises);

      // Fix dates for newly processed sessions (only needed for non-OM configs)
      // OM configs pass createdAt directly on messages, so dates are correct from the start
      if (!usesObservationalMemory) {
        const newlyProcessedSessions = sessionBatch.filter(s => processedSessionIds.has(s.sessionId));
        if (newlyProcessedSessions.length > 0) {
          await this.fixSessionDates(questionDir, newlyProcessedSessions, benchmarkStore as any);
        }
      }

      // Update processed count based on actual processed sessions
      processedSessions = processedSessionIds.size;

      // Update progress after batch completes
      if (slotIndex !== undefined && activeQuestions) {
        // Calculate current session index (1-based)
        const currentSessionIndex = processedSessions + 1;
        activeQuestions.set(slotIndex, {
          questionId: question.question_id,
          status: `session ${currentSessionIndex} (${processedSessions}/${sessionsToProcess.length} total)`,
        });
      }
    }

    // Update status to saving
    if (slotIndex !== undefined && activeQuestions) {
      activeQuestions.set(slotIndex, {
        questionId: question.question_id,
        status: 'Saving data...',
      });
    }

    // Persist storage
    if (usesObservationalMemory && omStorage) {
      await omStorage.persist(join(questionDir, 'om.json'));
    } else {
      await benchmarkStore.persist(join(questionDir, 'db.json'));
    }

    // Persist vector store if used
    if (options.memoryConfig === 'semantic-recall' || options.memoryConfig.includes('combined')) {
      await benchmarkVectorStore.persist(join(questionDir, 'vector.json'));
    }

    // Save metadata
    const metadata = {
      questionId: question.question_id,
      questionType: question.question_type,
      question: question.question,
      improvedQuestion: question.improved_question, // Clarified version for vague/ambiguous questions
      improvedAnswer: question.improved_answer, // Expected answer for improved question (if different)
      answer: question.answer,
      questionDate: question.question_date,
      resourceId,
      threadIds: question.haystack_session_ids,
      preparedAt: new Date().toISOString(),
      memoryConfig: options.memoryConfig,
      sessionCount: sessionsWithDates.length,
      evidenceSessionIds: question.answer_session_ids,
      note: 'Sessions were processed in chronological order (oldest first) for working memory',
      // Store OM config for reproducibility (actual values used, with defaults as fallback)
      ...(usesObservationalMemory && {
        observationalMemoryConfig: {
          scope: observationalMemoryConfig.scope,
          focus: observationalMemoryConfig.focus,
          // Use configured values if present, otherwise defaults
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
    };

    await writeFile(join(questionDir, 'meta.json'), JSON.stringify(metadata, null, 2));

    // Clean up progress file after successful completion
    if (existsSync(progressFile)) {
      await writeFile(
        progressFile,
        JSON.stringify({
          processedSessionIds: Array.from(processedSessionIds),
          completed: true,
          completedAt: new Date().toISOString(),
        }),
      );
    }
  }

  private async fixSessionDates(
    questionDir: string,
    sessionBatch: Array<{ session: any; sessionId: string; date: string }>,
    benchmarkStore: BenchmarkStore,
  ): Promise<void> {
    // Save current state to temp file
    const tempPath = join(questionDir, 'temp_db.json');
    await benchmarkStore.persist(tempPath);

    // Read and modify the data
    const data = JSON.parse(await readFile(tempPath, 'utf-8'));

    // Fix dates for each session in the batch
    for (const { sessionId, date } of sessionBatch) {
      const sessionDate = new Date(date);

      // Get messages for this session
      const sessionMessages: Array<[string, any]> = [];
      if (data.mastra_messages) {
        for (const [key, message] of data.mastra_messages) {
          if (message.threadId === sessionId) {
            sessionMessages.push([key, message]);
          }
        }
      }

      // Sort messages by their current createdAt to maintain order
      sessionMessages.sort((a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime());

      // Update each message's date
      sessionMessages.forEach(([_key, message], idx) => {
        // Add 5 minutes for each message in the conversation
        const messageDate = new Date(sessionDate.getTime() + idx * 5 * 60 * 1000);
        message.createdAt = messageDate.toISOString();
        message.updatedAt = messageDate.toISOString();
      });

      // Update thread dates
      if (data.mastra_threads) {
        for (const [threadId, thread] of data.mastra_threads) {
          if (threadId === sessionId) {
            thread.createdAt = sessionDate.toISOString();
            thread.updatedAt = sessionDate.toISOString();
          }
        }
      }
    }

    // Write back the modified data
    await writeFile(tempPath, JSON.stringify(data, null, 2));

    // Reload the modified data into the store
    await benchmarkStore.hydrate(tempPath);

    // Clean up temp file
    await unlink(tempPath);
  }
}
