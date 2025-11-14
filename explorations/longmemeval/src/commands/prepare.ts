import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { MockLanguageModelV1 } from '../test-utils/mock-model';
import { openai } from '@ai-sdk/openai';
import { cachedOpenAI } from '../embeddings/cached-openai-provider';
import { embeddingCacheStats } from '../embeddings';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';

import { DatasetLoader } from '../data/loader';
import { BenchmarkStore, BenchmarkVectorStore } from '../storage';
import type { LongMemEvalQuestion, MemoryConfigOptions, MemoryConfigType } from '../data/types';
import type { CoreMessage } from 'ai';

import { getMemoryOptions } from '../config';
import { makeRetryModel } from '../retry-model';

const retry4o = makeRetryModel(openai('gpt-4o'));

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

    // Use real model for working memory, mock for others
    const needsRealModel =
      options.memoryConfig === 'working-memory' ||
      options.memoryConfig === 'working-memory-tailored' ||
      options.memoryConfig === 'combined' ||
      options.memoryConfig === 'combined-tailored';

    if (needsRealModel && !process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for working memory preparation');
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
    const benchmarkStore = new BenchmarkStore();
    const benchmarkVectorStore = new BenchmarkVectorStore();

    // Initialize stores
    await benchmarkStore.init();

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
    const usesTailoredTemplate =
      options.memoryConfig === 'working-memory-tailored' || options.memoryConfig === 'combined-tailored';

    // Working memory must run one session (thread) at a time, in order
    // otherwise the data will not be accurate as working memory is meant
    // to build up over time, using the previous working memory state to create the next.
    if (usesWorkingMemory) isConcurrent = false;

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
    const memory = new Memory({
      storage: benchmarkStore,
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

    // Create agent with appropriate model
    const agent = new Agent({
      id: 'prep-agent',
      name: 'Prep Agent',
      instructions:
        "You are a helpful assistant. Process and store conversation history. Only store working memory information if it's in the template. Other information is not relevant",
      model: model,
      memory: memory,
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
    const BATCH_SIZE = usesWorkingMemory ? 1 : 50; // Process x sessions at a time. working memory must run one at a time since each conversation will use resource working memory from the last conversation and build on it.
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
    let sessionsToProcess = sessionsWithDates;
    if (options.sessionLimit) {
      const startIndex = processedSessionIds.size;
      const endIndex = Math.min(startIndex + options.sessionLimit, sessionsWithDates.length);
      sessionsToProcess = sessionsWithDates.slice(0, endIndex);
      console.log(
        chalk.yellow(`\n📊 Processing limited to ${options.sessionLimit} sessions (${startIndex + 1} to ${endIndex})`),
      );
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
      const batchPromises = sessionBatch.map(async ({ session, sessionId }) => {
        // Skip if already processed
        if (processedSessionIds.has(sessionId)) {
          return;
        }

        // Convert session to messages
        const messages: CoreMessage[] = [];
        for (const turn of session) {
          if (!turn.content) continue;

          const role = turn.role === 'user' || turn.role === 'assistant' ? turn.role : 'user';
          messages.push({
            role,
            content: turn.content,
          });
        }

        if (messages.length > 0) {
          // Process through agent to save to memory
          try {
            await agent.generate(messages, {
              threadId: sessionId, // Use haystack session ID as thread ID
              resourceId,
              memoryOptions: memoryOptions.options,
              temperature: 0.3,
              frequencyPenalty: 0.3,
            });
          } catch (error) {
            console.error(`Error in agent.generate for ${question.question_id}, session ${sessionId}:`, error);
            throw error;
          }
        }

        // Mark as processed
        processedSessionIds.add(sessionId);

        // Save progress after each session if using working memory
        if (usesWorkingMemory) {
          await writeFile(
            progressFile,
            JSON.stringify({
              processedSessionIds: Array.from(processedSessionIds),
              lastSavedDb: 'db.json',
              lastSavedVector: 'vector.json',
            }),
          );

          // Persist current state
          await benchmarkStore.persist(join(questionDir, 'db.json'));
          if (options.memoryConfig === 'semantic-recall' || options.memoryConfig.includes('combined')) {
            await benchmarkVectorStore.persist(join(questionDir, 'vector.json'));
          }
        }
      });

      await Promise.all(batchPromises);

      // Fix dates for newly processed sessions
      const newlyProcessedSessions = sessionBatch.filter(s => processedSessionIds.has(s.sessionId));
      if (newlyProcessedSessions.length > 0) {
        await this.fixSessionDates(questionDir, newlyProcessedSessions, benchmarkStore);
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
    await benchmarkStore.persist(join(questionDir, 'db.json'));

    // Persist vector store if used
    if (options.memoryConfig === 'semantic-recall' || options.memoryConfig.includes('combined')) {
      await benchmarkVectorStore.persist(join(questionDir, 'vector.json'));
    }

    // Save metadata
    const metadata = {
      questionId: question.question_id,
      questionType: question.question_type,
      question: question.question,
      answer: question.answer,
      questionDate: question.question_date,
      resourceId,
      threadIds: question.haystack_session_ids,
      preparedAt: new Date().toISOString(),
      memoryConfig: options.memoryConfig,
      sessionCount: sessionsWithDates.length,
      evidenceSessionIds: question.answer_session_ids,
      note: 'Sessions were processed in chronological order (oldest first) for working memory',
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
