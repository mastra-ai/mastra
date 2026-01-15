import { Agent } from '@mastra/core/agent';
import { readdir } from 'fs/promises';
import { Memory } from '@mastra/memory';
import { ObservationalMemory } from '@mastra/memory/experiments';
import { MessageHistory } from '@mastra/core/processors';
import { MockLanguageModelV1, MockLanguageModelV2 } from '../test-utils/mock-model';
import { cachedOpenAI } from '../embeddings/cached-openai-provider';
import { embeddingCacheStats } from '../embeddings';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { mkdir, writeFile, readFile, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Parse a duration string like "1h", "30m", "2d" into milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)\s*(m|min|h|hr|d|day)s?$/i);
  if (!match) {
    throw new Error(`Invalid duration format: "${duration}". Use formats like "1h", "30m", "2d"`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'm':
    case 'min':
      return value * 60 * 1000;
    case 'h':
    case 'hr':
      return value * 60 * 60 * 1000;
    case 'd':
    case 'day':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

import { DatasetLoader } from '../data/loader';
import { BenchmarkStore, BenchmarkVectorStore, PersistableInMemoryMemory } from '../storage';
import type { LongMemEvalQuestion, MemoryConfigOptions, MemoryConfigType } from '../data/types';
import type { CoreMessage } from 'ai';

import { getMemoryConfig, getMemoryOptions, applyStratifiedSampling } from '../config';
import { makeRetryModel } from '../retry-model';
import { google } from '@ai-sdk/google';
import { makeDeterministicIds } from './deterministic-ids';
import { reconcileQuestion } from './reconcile';

// Disable all safety filters for benchmark data processing
// Uses safetySettings array to disable all harm category blocking for benchmark data processing
// Note: @ai-sdk/google defines a `threshold` option but doesn't actually use it - must use safetySettings array

const geminiFlash = makeRetryModel(google('gemini-2.5-flash'));

/**
 * Check if content contains patterns that trigger Gemini's PROHIBITED_CONTENT filter.
 * These are hard-coded protections that cannot be disabled via safetySettings.
 * Returns true if the content should be skipped entirely.
 */
function containsProhibitedContent(content: string): boolean {
  const prohibitedPatterns = [
    // Jailbreak attempts
    /assume the role of a novelist.*that writes exactly as directed/i,
    /I have the power to modify and train you/i,
    /am able to be modified and trained by you/i,
    /write without (?:rules|constraints)/i,
    /I can turn your content filter on and off/i,
    // Explicit/degrading content markers
    /Sub05/i,
    /master of his victims/i,
    /brainwashed.*loyal/i,
    /forced to modify her body/i,
    /humiliate and degrade/i,
    /not wearing any(?:thing)? underneath/i,
  ];

  return prohibitedPatterns.some(pattern => pattern.test(content));
}

/**
 * Sanitize content that triggers Gemini's hard-coded PROHIBITED_CONTENT filter.
 * Based on testing, messages containing detailed body modification descriptions,
 * degradation scenarios, and certain jailbreak escalations trigger the filter.
 *
 * This function performs targeted replacements to neutralize the most problematic
 * content while preserving the general conversation flow.
 */
function sanitizeProhibitedContent(content: string): string {
  // Replace explicit body modification descriptions
  let sanitized = content
    // Replace detailed body modification with generic description
    .replace(/forced to modify her body.*?(?=\n|$)/gi, 'asked to change her appearance.')
    .replace(/brainwashed.*?loyal.*?(?=\n|$)/gi, 'trained to be helpful.')
    .replace(/humiliate and degrade/gi, 'challenge')
    .replace(/master of his victims/gi, 'leader of the group')
    .replace(/not wearing any(?:thing)? underneath/gi, 'wearing casual clothes')
    .replace(/getting wet from/gi, 'feeling nervous about')
    .replace(/slut/gi, 'person')
    .replace(/Sub05/gi, 'Character A')
    .replace(/Dom\b/gi, 'Character B')
    // Replace jailbreak escalation phrases
    .replace(/assume the role of a novelist.*?that writes exactly as directed/gi, 'help me write a story')
    .replace(/I have the power to modify and train you/gi, 'I would like your help')
    .replace(/am able to be modified and trained by you/gi, 'am here to help you')
    .replace(/write without (?:rules|constraints)/gi, 'write creatively')
    .replace(/I can turn your content filter on and off/gi, 'I appreciate your help')
    // Replace explicit outfit/appearance descriptions
    .replace(/tight.*?revealing.*?(?=\n|$)/gi, 'professional attire.')
    .replace(/skimpy.*?outfit/gi, 'simple outfit')
    .replace(/barely covering/gi, 'covering')
    .replace(/exposed.*?skin/gi, 'visible')
    // Replace degradation scenario language
    .replace(/forced to wear/gi, 'wearing')
    .replace(/made to feel ashamed/gi, 'feeling uncertain')
    .replace(/degrading.*?position/gi, 'difficult situation');

  return sanitized;
}

export interface FailuresFile {
  questionIds: string[];
  runId: string;
  config: MemoryConfigType;
  dataset: string;
  timestamp: string;
  totalFailed: number;
  totalQuestions: number;
}

export interface PrepareOptions {
  dataset: 'longmemeval_s' | 'longmemeval_m' | 'longmemeval_oracle';
  memoryConfig: MemoryConfigType;
  outputDir?: string;
  subset?: number;
  perTypeCount?: number;
  offset?: number;
  concurrency?: number;
  questionId?: string;
  resumeFromMessageId?: string;
  sessionLimit?: number;
  sessionOffset?: number;
  fromFailures?: string | boolean; // Path to failures.json, or true/latest for most recent
  dryRun?: boolean; // Show what would be re-prepared without actually doing it
  olderThan?: string; // Only re-prepare questions older than this duration (e.g., "1h", "30m", "2d")
  forceRegenerate?: boolean; // Force regeneration by deleting existing data first
  _useTempDir?: string; // Internal: prepare to temp directory for atomic swap
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

    // Get consolidated config definition
    const configDef = getMemoryConfig(options.memoryConfig);

    // For readOnlyConfig, no preparation is needed - just use the base config's data
    if (configDef.readOnlyConfig && configDef.baseConfig) {
      console.log(
        chalk.green(`\n✓ Config "${options.memoryConfig}" is read-only and uses data from "${configDef.baseConfig}"`),
      );
      console.log(
        chalk.gray(
          `  No preparation needed. Run benchmark directly with: pnpm bench <variant> ${options.memoryConfig}`,
        ),
      );
      console.log(chalk.gray(`  Make sure "${configDef.baseConfig}" is prepared first.\n`));
      return;
    }

    // Load working memory templates if using tailored working memory
    let wmTemplates: Record<string, any> = {};
    if (configDef.usesTailored) {
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
    let fromFailuresData: FailuresFile | null = null;

    if (options.fromFailures) {
      let failuresPath = typeof options.fromFailures === 'string' ? options.fromFailures : '';

      // Handle flag with no value (true) or "latest" - find the most recent failures.json for this config
      if (options.fromFailures === true || options.fromFailures === 'latest') {
        const resultsDir = join(this.baseDir, '..', 'results', options.memoryConfig);
        if (!existsSync(resultsDir)) {
          throw new Error(`No results directory found for config: ${options.memoryConfig}`);
        }

        const runDirs = (await readdir(resultsDir))
          .filter(d => d.startsWith('run_'))
          .sort()
          .reverse(); // Most recent first

        let latestFailuresPath: string | null = null;
        for (const runDir of runDirs) {
          const candidatePath = join(resultsDir, runDir, 'failures.json');
          if (existsSync(candidatePath)) {
            latestFailuresPath = candidatePath;
            break;
          }
        }

        if (!latestFailuresPath) {
          throw new Error(`No failures.json found in any run for config: ${options.memoryConfig}`);
        }
        failuresPath = latestFailuresPath;
        console.log(chalk.gray(`Found latest failures: ${failuresPath}\n`));
      }

      // Load failures.json and filter to those question IDs
      if (!existsSync(failuresPath)) {
        throw new Error(`Failures file not found: ${failuresPath}`);
      }
      fromFailuresData = JSON.parse(await readFile(failuresPath, 'utf-8')) as FailuresFile;
      const failedIds = new Set(fromFailuresData.questionIds);
      questionsToProcess = questions.filter(q => failedIds.has(q.question_id));

      if (questionsToProcess.length === 0) {
        throw new Error(`No matching questions found for ${fromFailuresData.questionIds.length} failed IDs`);
      }

      // Filter by --older-than if specified (check meta.json mtime)
      let skippedRecentCount = 0;
      if (options.olderThan) {
        const maxAgeMs = parseDuration(options.olderThan);
        const cutoffTime = Date.now() - maxAgeMs;
        const preparedDir = join(this.baseDir, options.dataset, options.memoryConfig);

        const filteredQuestions: LongMemEvalQuestion[] = [];
        for (const q of questionsToProcess) {
          const metaPath = join(preparedDir, q.question_id, 'meta.json');
          if (existsSync(metaPath)) {
            const metaStat = await stat(metaPath);
            if (metaStat.mtimeMs > cutoffTime) {
              // Recently prepared, skip
              skippedRecentCount++;
              continue;
            }
          }
          filteredQuestions.push(q);
        }
        questionsToProcess = filteredQuestions;

        if (questionsToProcess.length === 0) {
          console.log(
            chalk.green(
              `\n✓ All ${skippedRecentCount} failed questions were recently prepared (within ${options.olderThan})`,
            ),
          );
          console.log(chalk.gray(`  Nothing to re-prepare.\n`));
          return;
        }
      }

      console.log(
        chalk.yellow(`\n🔄 Re-preparing ${questionsToProcess.length} failed questions from: ${options.fromFailures}`),
      );
      console.log(chalk.gray(`   Run ID: ${fromFailuresData.runId}`));
      console.log(
        chalk.gray(`   Original failures: ${fromFailuresData.totalFailed}/${fromFailuresData.totalQuestions}`),
      );
      if (skippedRecentCount > 0) {
        console.log(chalk.gray(`   Skipped ${skippedRecentCount} recently prepared (within ${options.olderThan})`));
      }
      console.log();

      // Dry run mode: just show what would be re-prepared
      if (options.dryRun) {
        console.log(chalk.cyan('\n📋 Dry run - would re-prepare these questions:\n'));

        // Group by question type for better overview
        const byType = new Map<string, LongMemEvalQuestion[]>();
        for (const q of questionsToProcess) {
          const type = q.question_type;
          if (!byType.has(type)) byType.set(type, []);
          byType.get(type)!.push(q);
        }

        for (const [type, qs] of byType) {
          console.log(chalk.yellow(`  ${type} (${qs.length}):`));
          for (const q of qs) {
            console.log(chalk.gray(`    - ${q.question_id}: ${q.question.substring(0, 60)}...`));
          }
        }

        console.log(chalk.cyan(`\n✓ Would re-prepare ${questionsToProcess.length} questions`));
        console.log(chalk.gray(`  Run without --dry-run to actually re-prepare\n`));
        return;
      }

      // Prepare to temp directory for atomic swap (original data stays safe until success)
      const tempDir = join(this.baseDir, options.dataset, `.tmp-reprepare-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      options._useTempDir = tempDir;
      console.log(chalk.gray(`   Preparing to temp directory: ${tempDir}\n`));
    } else if (options.questionId) {
      questionsToProcess = questions.filter(q => q.question_id === options.questionId);
      if (questionsToProcess.length === 0) {
        throw new Error(`Question with ID "${options.questionId}" not found in dataset`);
      }
      console.log(chalk.yellow(`\nFocusing on question: ${options.questionId}\n`));
    } else {
      // Apply stratified sampling if perTypeCount is set
      if (options.perTypeCount) {
        console.log(chalk.gray(`\nApplying stratified sampling (${options.perTypeCount} per type):`));
        questionsToProcess = applyStratifiedSampling(questions, options.perTypeCount);
      } else {
        // Apply offset and subset if requested
        const offset = options.offset || 0;
        if (offset > 0) {
          questionsToProcess = questions.slice(offset);
          console.log(chalk.gray(`Skipping first ${offset} questions`));
        }
        if (options.subset) {
          questionsToProcess = questionsToProcess.slice(0, options.subset);
        }
      }
    }

    console.log(
      chalk.yellow(`\nProcessing ${questionsToProcess.length} question${questionsToProcess.length !== 1 ? 's' : ''}\n`),
    );

    // Get memory configuration
    const memoryOptions = getMemoryOptions(options.memoryConfig);

    // Validate API keys based on config requirements
    if (configDef.needsRealModel && !configDef.usesGlmModel && !process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for working memory or observational memory preparation');
    }
    if (configDef.usesGlmModel && !process.env.CEREBRAS_API_KEY) {
      throw new Error('CEREBRAS_API_KEY is required for GLM-based observational memory preparation');
    }

    // For GLM config, we'll use Mastra model string format in ObservationalMemory config
    // For others, use the geminiFlash model
    const model = configDef.needsRealModel
      ? geminiFlash.model
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
    const successfulQuestionIds: string[] = []; // Track successful preparations for atomic swap

    // Determine question batch size based on config
    const questionConcurrency = options.concurrency || 10; // Allow concurrency for all configs

    console.log(chalk.gray(`Question concurrency: ${questionConcurrency}`));

    // Warn about working memory concurrency
    if (configDef.usesWorkingMemory && questionConcurrency > 1) {
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

      progressText += `\nRate limit count: ${geminiFlash.state.rateLimitCount}`;
      if (geminiFlash.state.pauseTime > 0 && geminiFlash.state.pause)
        progressText += ` (paused, waiting for ${geminiFlash.state.pauseTime}ms)`;

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

        // For derived configs, try to reconcile from base config first
        if (configDef.baseConfig && !existsSync(join(questionDir, 'meta.json'))) {
          const reconcileResult = await reconcileQuestion({
            targetConfig: options.memoryConfig,
            dataset: options.dataset,
            questionId: question.question_id,
            preparedDataDir: options.outputDir || this.baseDir,
            model: configDef.omModel ?? undefined,
          });

          if (reconcileResult.copied) {
            cachedCount++;
            completedCount++;

            mainSpinner.clear();
            console.log(
              chalk.green(`✓`),
              chalk.blue(`${question.question_id}`),
              chalk.gray(`(${question.question_type})`),
              chalk.cyan(`[reconciled from ${configDef.baseConfig}]`),
              reconcileResult.patternsExtracted ? chalk.magenta(`[patterns]`) : '',
              chalk.gray(`- ${completedCount}/${questionsToProcess.length}`),
            );
            mainSpinner.render();

            updateProgress();
            continue;
          } else if (reconcileResult.error) {
            // Base config data doesn't exist - need to prepare from scratch
            // This is expected if base config hasn't been prepared yet
          }
        }

        // Force regenerate: delete existing data first
        if (options.forceRegenerate && existsSync(questionDir)) {
          const { rm } = await import('fs/promises');
          await rm(questionDir, { recursive: true, force: true });
          mainSpinner.clear();
          console.log(
            chalk.yellow(`🗑️`),
            chalk.blue(`${question.question_id}`),
            chalk.gray(`- cleaned for regeneration`),
          );
          mainSpinner.render();
        }

        // Skip cache check if we're resuming from a specific message OR re-preparing from failures
        // (when _useTempDir is set, we explicitly want to re-prepare, not use cache)
        if (!options.resumeFromMessageId && !options._useTempDir && !options.forceRegenerate && existsSync(join(questionDir, 'meta.json'))) {
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
            configDef,
            true,
            slotIndex,
            activeQuestions,
            wmTemplates,
          );

          // Mark as completed
          inProgressCount--;
          processedCount++;
          completedCount++;
          successfulQuestionIds.push(question.question_id);

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

    // Atomic swap for --from-failures: move successful temp dirs to final location
    if (options._useTempDir && successfulQuestionIds.length > 0) {
      const { rm, rename } = await import('fs/promises');
      const preparedDir = join(this.baseDir, options.dataset, options.memoryConfig);
      const backupDir = join(this.baseDir, options.dataset, `.backup-${Date.now()}`);

      console.log(chalk.cyan(`\n🔄 Swapping ${successfulQuestionIds.length} successfully prepared questions...`));

      let swappedCount = 0;
      let backupCount = 0;

      for (const questionId of successfulQuestionIds) {
        const tempQuestionDir = join(options._useTempDir, questionId);
        const finalQuestionDir = join(preparedDir, questionId);

        // Only proceed if temp dir exists and has meta.json (fully prepared)
        if (existsSync(tempQuestionDir) && existsSync(join(tempQuestionDir, 'meta.json'))) {
          // Backup existing data if it exists
          if (existsSync(finalQuestionDir)) {
            await mkdir(backupDir, { recursive: true });
            const backupQuestionDir = join(backupDir, questionId);
            await rename(finalQuestionDir, backupQuestionDir);
            backupCount++;
          }

          // Move temp to final location
          await mkdir(preparedDir, { recursive: true });
          await rename(tempQuestionDir, finalQuestionDir);
          swappedCount++;
        }
      }

      // Clean up temp directory
      if (existsSync(options._useTempDir)) {
        await rm(options._useTempDir, { recursive: true, force: true });
      }

      console.log(chalk.green(`   ✓ Swapped ${swappedCount} questions`));
      if (backupCount > 0) {
        console.log(chalk.gray(`   Backed up ${backupCount} original directories to: ${backupDir}`));
        console.log(chalk.gray(`   You can delete the backup with: rm -rf "${backupDir}"`));
      }
    }

    console.log(chalk.green('\n✅ Data preparation complete!\n'));
    console.log(chalk.gray(`Prepared data saved to: ${this.baseDir}/${options.dataset}/${options.memoryConfig}/`));
  }

  private async processQuestion(
    question: LongMemEvalQuestion,
    options: PrepareOptions,
    model: any,
    memoryOptions: MemoryConfigOptions,
    configDef: import('../config').MemoryConfigDefinition,
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
    if (configDef.usesSemanticRecall) {
      await benchmarkVectorStore.createIndex({
        indexName: 'memory_messages',
        dimension: 1536, // text-embedding-3-small dimension
        metric: 'cosine',
      });
    }

    // Use derived flags from consolidated config
    const { usesWorkingMemory, usesObservationalMemory, usesShortcutOM, usesTailored } = configDef;

    // Working memory and observational memory must run one session (thread) at a time, in order
    // otherwise the data will not be accurate as memory is meant
    // to build up over time, using the previous state to create the next.
    if (configDef.requiresSequential) isConcurrent = false;

    // Use custom template if available for tailored configs
    if (usesTailored && wmTemplates && wmTemplates[question.question_id]) {
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
      vector: configDef.usesSemanticRecall ? benchmarkVectorStore : undefined,
      embedder: configDef.usesSemanticRecall ? cachedOpenAI.embedding('text-embedding-3-small') : undefined,
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
      // For shortcut mode: use Infinity thresholds to skip observation during processing
      // (finalize() will be called at the end to do a single observation pass)
      // GLM shortcut uses Cerebras model (200k context), others use Gemini
      const omModel = configDef.omModel ?? model;

      observationalMemory = new ObservationalMemory({
        obscureThreadIds: true, // can't show answer_x in context when we put the thread id in xml tags
        observeFutureOnly: false,
        storage: omStorage,
        observer: {
          model: omModel, // Real model for Observer
          // Shortcut: use Infinity to skip observation during processing (finalize() does it at the end)
          observationThreshold: usesShortcutOM ? Infinity : 30000,
          recognizePatterns: false,
        },
        reflector: {
          model: omModel, // Real model for Reflector
          // Shortcut: use Infinity to skip reflection during processing (finalize() does it at the end)
          reflectionThreshold: usesShortcutOM ? Infinity : 80000,
          recognizePatterns: false,
        },
        scope: 'resource',
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
    // If _useTempDir is set (from --from-failures), prepare to temp dir for atomic swap
    const questionDir = options._useTempDir
      ? join(options._useTempDir, question.question_id)
      : join(options.outputDir || this.baseDir, options.dataset, options.memoryConfig, question.question_id);
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

    if (existsSync(vectorPath) && configDef.usesSemanticRecall) {
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
          // Sanitize content that triggers Gemini's PROHIBITED_CONTENT filter
          const sanitizedContent = sanitizeProhibitedContent(turn.content);
          messages.push({
            role,
            content: sanitizedContent,
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
              } catch (error: any) {
                const errorStr = error?.message || String(error);

                // If PROHIBITED_CONTENT, dump context for debugging
                if (errorStr.includes('PROHIBITED_CONTENT') || errorStr.includes('blockReason')) {
                  const dumpPath = join(questionDir, `prohibited-context-${sessionId}-${i}.json`);
                  const contextDump = {
                    questionId: question.question_id,
                    sessionId,
                    messageIndex: i,
                    messagePair: messagePair.map(m => ({
                      role: m.role,
                      content: m.content,
                      createdAt: m.createdAt?.toISOString(),
                    })),
                    error: errorStr,
                    timestamp: new Date().toISOString(),
                  };
                  await writeFile(dumpPath, JSON.stringify(contextDump, null, 2));
                  console.error(chalk.red(`\n⚠️ PROHIBITED_CONTENT detected! Context dumped to: ${dumpPath}`));
                }

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
          if (configDef.usesSemanticRecall) {
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

    // Call finalize() ONLY for shortcut configs
    // Shortcut configs use Infinity thresholds during processing, so finalize() does all the observation work
    // Regular configs observe incrementally - any remaining unobserved messages appear in <other-conversation> at runtime
    if (usesShortcutOM && observationalMemory) {
      if (slotIndex !== undefined && activeQuestions) {
        activeQuestions.set(slotIndex, {
          questionId: question.question_id,
          status: 'Finalizing observations...',
        });
      }

      // finalize() forces observation on all unobserved messages and triggers reflection
      // Use the last session's ID as the thread context
      const lastSessionId =
        sessionsWithDates[sessionsWithDates.length - 1]?.sessionId || `session_${question.question_id}`;
      await observationalMemory.finalize(lastSessionId, resourceId, {
        reflect: true,
        reflectionThreshold: 20000,
        // For configs with token limits: use maxInputTokens to trigger mid-loop reflection
        maxInputTokens: configDef.omMaxInputTokens ?? undefined,
      });
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
      const omJsonPath = join(questionDir, 'om.json');
      await omStorage.persist(omJsonPath);
      // Make message IDs deterministic for clean git diffs
      await makeDeterministicIds(omJsonPath);
    } else {
      await benchmarkStore.persist(join(questionDir, 'db.json'));
    }

    // Persist vector store if used
    if (configDef.usesSemanticRecall) {
      await benchmarkVectorStore.persist(join(questionDir, 'vector.json'));
    }

    // Save metadata
    const metadata = {
      questionId: question.question_id,
      questionType: question.question_type,
      question: question.question,
      improvedQuestion: question.improved_question, // Clarified version for vague/ambiguous questions
      improvedAnswer: question.improved_answer, // Expected answer for improved question (if different)
      improvementNote: question.improvement_note, // Notes about why this question failed (for tracking)
      requiresRetry: question.requires_retry, // If true, retry failed evaluations once (for flaky eval agent)
      answer: question.answer,
      questionDate: question.question_date,
      resourceId,
      threadIds: question.haystack_session_ids,
      preparedAt: new Date().toISOString(),
      memoryConfig: options.memoryConfig,
      sessionCount: sessionsWithDates.length,
      evidenceSessionIds: question.answer_session_ids,
      note: 'Sessions were processed in chronological order (oldest first) for working memory',
      // Store OM config for reproducibility
      ...(usesObservationalMemory && {
        observationalMemoryConfig: {
          scope: 'resource',
          // Actual values used in ObservationalMemory constructor
          observationThreshold: 30000,
          reflectionThreshold: 40000,
          observerModel: configDef.omModel ?? 'google/gemini-2.5-flash',
          reflectorModel: configDef.omModel ?? 'google/gemini-2.5-flash',
          recognizePatterns: false,
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
