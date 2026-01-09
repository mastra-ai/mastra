import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

import { DatasetLoader } from '../data/loader';
import type { DatasetType, LongMemEvalQuestion } from '../data/types';
import { TokenCounter } from '@mastra/memory/experiments';

export interface TokensOptions {
  dataset: DatasetType;
  questionId?: string;
  offset?: number;
  subset?: number;
  preparedDataDir?: string;
  showSessions?: boolean;
  topN?: number;
}

interface SessionStats {
  sessionId: string;
  isAnswerSession: boolean;
  tokens: number;
  messageCount: number;
  userTokens: number;
  assistantTokens: number;
}

interface QuestionStats {
  questionId: string;
  questionType: string;
  totalTokens: number;
  answerSessionTokens: number;
  messageCount: number;
  sessionCount: number;
  answerSessionCount: number;
  largestSession: { id: string; tokens: number };
  smallestSession: { id: string; tokens: number };
  avgTokensPerMessage: number;
  sessions: SessionStats[];
  // Prepared data comparison (if available)
  preparedObservationTokens?: number;
  compressionRatio?: number;
}

interface AggregateStats {
  totalQuestions: number;
  totalTokens: number;
  totalMessages: number;
  avgTokensPerQuestion: number;
  minTokens: number;
  maxTokens: number;
  medianTokens: number;
  p90Tokens: number;
  p95Tokens: number;
  distribution: { range: string; count: number }[];
  topQuestions: { questionId: string; tokens: number }[];
  estimatedCost: {
    gpt4o: number;
    gpt4oMini: number;
    claude35Sonnet: number;
  };
}

export class TokensCommand {
  private loader: DatasetLoader;
  private tokenCounter: TokenCounter;
  private preparedDataDir: string;

  constructor() {
    this.loader = new DatasetLoader();
    this.tokenCounter = new TokenCounter();
    this.preparedDataDir = './prepared-data';
  }

  async run(options: TokensOptions): Promise<void> {
    const spinner = ora('Loading dataset...').start();

    try {
      // Load dataset
      const questions = await this.loader.loadDataset(options.dataset);
      spinner.succeed(`Loaded ${questions.length} questions`);

      // Filter questions based on options
      let selectedQuestions: LongMemEvalQuestion[];

      if (options.questionId) {
        const question = questions.find(q => q.question_id === options.questionId);
        if (!question) {
          console.log(chalk.red(`Question ${options.questionId} not found`));
          return;
        }
        selectedQuestions = [question];
      } else {
        const offset = options.offset || 0;
        selectedQuestions = questions.slice(offset);
        if (options.subset) {
          selectedQuestions = selectedQuestions.slice(0, options.subset);
        }
      }

      console.log(chalk.blue(`\n📊 Token Estimate for ${selectedQuestions.length} question(s)\n`));

      // Calculate stats for each question
      const questionStats: QuestionStats[] = [];
      const statsSpinner = ora('Calculating token counts...').start();

      for (let i = 0; i < selectedQuestions.length; i++) {
        const question = selectedQuestions[i];
        statsSpinner.text = `Calculating token counts... ${i + 1}/${selectedQuestions.length}`;

        const stats = await this.calculateQuestionStats(question, options);
        questionStats.push(stats);
      }

      statsSpinner.succeed('Token counts calculated');

      // Display results
      if (selectedQuestions.length === 1) {
        this.displaySingleQuestion(questionStats[0], options.showSessions);
      } else {
        const aggregate = this.calculateAggregateStats(questionStats, options.topN || 10);
        this.displayAggregateStats(aggregate, questionStats, options.showSessions);
      }
    } catch (error) {
      spinner.fail('Error loading dataset');
      throw error;
    }
  }

  private async calculateQuestionStats(
    question: LongMemEvalQuestion,
    options: TokensOptions,
  ): Promise<QuestionStats> {
    const sessions: SessionStats[] = [];
    const answerSessionIdSet = new Set(question.answer_session_ids || []);

    // haystack_sessions is Turn[][] and haystack_session_ids is string[]
    // They are parallel arrays
    for (let i = 0; i < question.haystack_sessions.length; i++) {
      const sessionId = question.haystack_session_ids[i];
      const messages = question.haystack_sessions[i];
      const isAnswerSession = answerSessionIdSet.has(sessionId);

      // Count tokens in messages
      let tokens = 0;
      let userTokens = 0;
      let assistantTokens = 0;
      let messageCount = 0;

      for (const msg of messages) {
        // Count tokens directly from the string content
        // Add role overhead (~4 tokens) to match TokenCounter.countMessage behavior
        const contentTokens = this.tokenCounter.countString(msg.content);
        const roleTokens = this.tokenCounter.countString(msg.role);
        const msgTokens = contentTokens + roleTokens + 4; // ~4 tokens overhead per message

        tokens += msgTokens;
        messageCount++;

        if (msg.role === 'user') {
          userTokens += msgTokens;
        } else {
          assistantTokens += msgTokens;
        }
      }

      sessions.push({
        sessionId,
        isAnswerSession,
        tokens,
        messageCount,
        userTokens,
        assistantTokens,
      });
    }

    // Calculate aggregates
    const totalTokens = sessions.reduce((sum, s) => sum + s.tokens, 0);
    const answerSessionTokens = sessions.filter(s => s.isAnswerSession).reduce((sum, s) => sum + s.tokens, 0);
    const messageCount = sessions.reduce((sum, s) => sum + s.messageCount, 0);

    const sortedByTokens = [...sessions].sort((a, b) => b.tokens - a.tokens);
    const largestSession = sortedByTokens[0] || { id: '', tokens: 0 };
    const smallestSession = sortedByTokens[sortedByTokens.length - 1] || { id: '', tokens: 0 };

    // Check for prepared data
    let preparedObservationTokens: number | undefined;
    let compressionRatio: number | undefined;

    const preparedDir = options.preparedDataDir || this.preparedDataDir;
    // Check both observational-memory and observational-memory-shortcut directories
    let omJsonPath = join(preparedDir, options.dataset, 'observational-memory', question.question_id, 'om.json');
    if (!existsSync(omJsonPath)) {
      omJsonPath = join(
        preparedDir,
        options.dataset,
        'observational-memory-shortcut',
        question.question_id,
        'om.json',
      );
    }

    if (existsSync(omJsonPath)) {
      try {
        const omData = JSON.parse(await readFile(omJsonPath, 'utf-8'));
        // The structure is: observationalMemory[0] = [resourceKey, [records...]]
        // Sum activeObservations across ALL records (each reflection creates a new record)
        let totalObservationTokens = 0;

        if (Array.isArray(omData.observationalMemory) && omData.observationalMemory[0]) {
          const [, records] = omData.observationalMemory[0];
          if (Array.isArray(records)) {
            for (const record of records) {
              if (record?.activeObservations) {
                totalObservationTokens += this.tokenCounter.countString(record.activeObservations);
              }
            }
          }
        } else if (omData.record?.activeObservations) {
          // Fallback for old structure
          totalObservationTokens = this.tokenCounter.countString(omData.record.activeObservations);
        }

        if (totalObservationTokens > 0) {
          preparedObservationTokens = totalObservationTokens;
          if (totalTokens > 0) {
            compressionRatio = totalTokens / preparedObservationTokens;
          }
        }
      } catch {
        // Ignore errors reading prepared data
      }
    }

    return {
      questionId: question.question_id,
      questionType: question.question_type,
      totalTokens,
      answerSessionTokens,
      messageCount,
      sessionCount: sessions.length,
      answerSessionCount: sessions.filter(s => s.isAnswerSession).length,
      largestSession: { id: largestSession.sessionId, tokens: largestSession.tokens },
      smallestSession: { id: smallestSession.sessionId, tokens: smallestSession.tokens },
      avgTokensPerMessage: messageCount > 0 ? Math.round(totalTokens / messageCount) : 0,
      sessions,
      preparedObservationTokens,
      compressionRatio,
    };
  }

  private calculateAggregateStats(questionStats: QuestionStats[], topN: number): AggregateStats {
    const tokenCounts = questionStats.map(q => q.totalTokens).sort((a, b) => a - b);
    const totalTokens = tokenCounts.reduce((sum, t) => sum + t, 0);
    const totalMessages = questionStats.reduce((sum, q) => sum + q.messageCount, 0);

    // Percentiles
    const percentile = (arr: number[], p: number) => {
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    };

    // Distribution buckets
    const buckets = [
      { min: 0, max: 10000, label: '0-10k' },
      { min: 10000, max: 25000, label: '10k-25k' },
      { min: 25000, max: 50000, label: '25k-50k' },
      { min: 50000, max: 100000, label: '50k-100k' },
      { min: 100000, max: 250000, label: '100k-250k' },
      { min: 250000, max: Infinity, label: '250k+' },
    ];

    const distribution = buckets.map(bucket => ({
      range: bucket.label,
      count: questionStats.filter(q => q.totalTokens >= bucket.min && q.totalTokens < bucket.max).length,
    }));

    // Top N largest questions
    const topQuestions = [...questionStats]
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, topN)
      .map(q => ({ questionId: q.questionId, tokens: q.totalTokens }));

    // Cost estimates (per 1M tokens)
    const gpt4oInputPrice = 2.5; // $2.50 per 1M input tokens
    const gpt4oMiniInputPrice = 0.15; // $0.15 per 1M input tokens
    const claude35SonnetInputPrice = 3.0; // $3.00 per 1M input tokens

    return {
      totalQuestions: questionStats.length,
      totalTokens,
      totalMessages,
      avgTokensPerQuestion: Math.round(totalTokens / questionStats.length),
      minTokens: tokenCounts[0] || 0,
      maxTokens: tokenCounts[tokenCounts.length - 1] || 0,
      medianTokens: percentile(tokenCounts, 50),
      p90Tokens: percentile(tokenCounts, 90),
      p95Tokens: percentile(tokenCounts, 95),
      distribution,
      topQuestions,
      estimatedCost: {
        gpt4o: (totalTokens / 1_000_000) * gpt4oInputPrice,
        gpt4oMini: (totalTokens / 1_000_000) * gpt4oMiniInputPrice,
        claude35Sonnet: (totalTokens / 1_000_000) * claude35SonnetInputPrice,
      },
    };
  }

  private displaySingleQuestion(stats: QuestionStats, showSessions?: boolean): void {
    console.log(chalk.bold(`Question: ${stats.questionId}`));
    console.log(chalk.gray(`Type: ${stats.questionType}`));
    console.log();

    if (showSessions) {
      console.log(chalk.bold(`Sessions (${stats.sessionCount} total):\n`));

      // Sort sessions by tokens descending
      const sortedSessions = [...stats.sessions].sort((a, b) => b.tokens - a.tokens);

      for (const session of sortedSessions) {
        const answerTag = session.isAnswerSession ? chalk.green(' (answer)') : '';
        const tokens = this.formatTokens(session.tokens);
        const breakdown = chalk.gray(`(${session.messageCount} msgs, U:${this.formatTokens(session.userTokens)} A:${this.formatTokens(session.assistantTokens)})`);

        console.log(`  ${session.sessionId}${answerTag}`);
        console.log(`    ${tokens} ${breakdown}`);
      }
      console.log();
    }

    console.log(chalk.bold('Summary:'));
    console.log(`  Total tokens:         ${this.formatTokens(stats.totalTokens)}`);
    console.log(`  Answer session tokens: ${this.formatTokens(stats.answerSessionTokens)} ${chalk.gray(`(${stats.answerSessionCount} sessions)`)}`);
    console.log(`  Total messages:       ${stats.messageCount}`);
    console.log(`  Avg tokens/message:   ${stats.avgTokensPerMessage}`);
    console.log(`  Largest session:      ${stats.largestSession.id} (${this.formatTokens(stats.largestSession.tokens)})`);
    console.log(`  Smallest session:     ${stats.smallestSession.id} (${this.formatTokens(stats.smallestSession.tokens)})`);

    if (stats.preparedObservationTokens !== undefined) {
      console.log();
      console.log(chalk.bold('Prepared Data (OM):'));
      console.log(`  Observation tokens:   ${this.formatTokens(stats.preparedObservationTokens)}`);
      if (stats.compressionRatio !== undefined) {
        console.log(`  Compression ratio:    ${stats.compressionRatio.toFixed(1)}x`);
      }
    }

    console.log();
  }

  private displayAggregateStats(
    aggregate: AggregateStats,
    questionStats: QuestionStats[],
    showSessions?: boolean,
  ): void {
    // Summary
    console.log(chalk.bold('Summary:'));
    console.log(`  Questions:            ${aggregate.totalQuestions}`);
    console.log(`  Total tokens:         ${this.formatTokens(aggregate.totalTokens)}`);
    console.log(`  Total messages:       ${aggregate.totalMessages.toLocaleString()}`);
    console.log(`  Avg tokens/question:  ${this.formatTokens(aggregate.avgTokensPerQuestion)}`);
    console.log();

    // Distribution
    console.log(chalk.bold('Token Distribution:'));
    console.log(`  Min:                  ${this.formatTokens(aggregate.minTokens)}`);
    console.log(`  Median:               ${this.formatTokens(aggregate.medianTokens)}`);
    console.log(`  P90:                  ${this.formatTokens(aggregate.p90Tokens)}`);
    console.log(`  P95:                  ${this.formatTokens(aggregate.p95Tokens)}`);
    console.log(`  Max:                  ${this.formatTokens(aggregate.maxTokens)}`);
    console.log();

    // Histogram
    console.log(chalk.bold('Distribution by Range:'));
    const maxCount = Math.max(...aggregate.distribution.map(d => d.count));
    const barWidth = 30;

    for (const bucket of aggregate.distribution) {
      if (bucket.count === 0) continue;
      const barLength = Math.round((bucket.count / maxCount) * barWidth);
      const bar = '█'.repeat(barLength);
      const pct = ((bucket.count / aggregate.totalQuestions) * 100).toFixed(0);
      console.log(`  ${bucket.range.padEnd(10)} ${bar} ${bucket.count} (${pct}%)`);
    }
    console.log();

    // Top N largest
    console.log(chalk.bold(`Top ${aggregate.topQuestions.length} Largest Questions:`));
    for (let i = 0; i < aggregate.topQuestions.length; i++) {
      const q = aggregate.topQuestions[i];
      console.log(`  ${(i + 1).toString().padStart(2)}. ${q.questionId}  ${this.formatTokens(q.tokens)}`);
    }
    console.log();

    // Cost estimates
    console.log(chalk.bold('Estimated Input Costs:'));
    console.log(`  GPT-4o:               $${aggregate.estimatedCost.gpt4o.toFixed(2)}`);
    console.log(`  GPT-4o-mini:          $${aggregate.estimatedCost.gpt4oMini.toFixed(2)}`);
    console.log(`  Claude 3.5 Sonnet:    $${aggregate.estimatedCost.claude35Sonnet.toFixed(2)}`);
    console.log(chalk.gray('  (Input tokens only, excludes output/observation costs)'));
    console.log();

    // Compression stats if any have prepared data
    const withPrepared = questionStats.filter(q => q.preparedObservationTokens !== undefined);
    if (withPrepared.length > 0) {
      const totalPreparedTokens = withPrepared.reduce((sum, q) => sum + (q.preparedObservationTokens || 0), 0);
      const totalOriginalTokens = withPrepared.reduce((sum, q) => sum + q.totalTokens, 0);
      const avgCompression = totalOriginalTokens / totalPreparedTokens;

      console.log(chalk.bold('Prepared Data (OM):'));
      console.log(`  Questions with OM:    ${withPrepared.length}`);
      console.log(`  Total OM tokens:      ${this.formatTokens(totalPreparedTokens)}`);
      console.log(`  Avg compression:      ${avgCompression.toFixed(1)}x`);
      console.log();
    }

    // Show per-question details if requested
    if (showSessions) {
      console.log(chalk.bold('Per-Question Details:\n'));
      for (const stats of questionStats) {
        const compression = stats.compressionRatio ? chalk.green(` (${stats.compressionRatio.toFixed(1)}x compression)`) : '';
        console.log(`  ${stats.questionId} - ${this.formatTokens(stats.totalTokens)} (${stats.sessionCount} sessions, ${stats.messageCount} msgs)${compression}`);
      }
      console.log();
    }
  }

  private formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(2)}M`;
    } else if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}k`;
    }
    return tokens.toString();
  }
}
