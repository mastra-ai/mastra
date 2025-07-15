import { readFile } from 'fs/promises';
import { join } from 'path';
import type { LongMemEvalQuestion } from './types';

export class DatasetLoader {
  private dataDir: string;

  constructor(dataDir?: string) {
    // Default to data directory relative to where the command is run
    this.dataDir = dataDir || join(process.cwd(), 'data');
  }

  /**
   * Load a LongMemEval dataset from JSON file
   */
  async loadDataset(
    dataset: 'longmemeval_s' | 'longmemeval_m' | 'longmemeval_oracle' | 'sample_data',
  ): Promise<LongMemEvalQuestion[]> {
    const filePath = join(this.dataDir, `${dataset}.json`);

    try {
      const fileContent = await readFile(filePath, 'utf-8');
      const data = JSON.parse(fileContent) as LongMemEvalQuestion[];

      // Validate the data structure
      this.validateDataset(data);

      return data;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(
          `Dataset file not found: ${filePath}\n` +
            `Please download the LongMemEval dataset from https://drive.google.com/file/d/1zJgtYRFhOh5zDQzzatiddfjYhFSnyQ80/view ` +
            `and extract it to ${this.dataDir}`,
        );
      }
      throw error;
    }
  }

  /**
   * Load a subset of questions for testing
   */
  async loadSubset(
    dataset: 'longmemeval_s' | 'longmemeval_m' | 'longmemeval_oracle' | 'sample_data',
    limit: number,
  ): Promise<LongMemEvalQuestion[]> {
    const fullDataset = await this.loadDataset(dataset);
    return fullDataset.slice(0, limit);
  }

  /**
   * Load questions of a specific type
   */
  async loadByType(
    dataset: 'longmemeval_s' | 'longmemeval_m' | 'longmemeval_oracle' | 'sample_data',
    questionType: string,
  ): Promise<LongMemEvalQuestion[]> {
    const fullDataset = await this.loadDataset(dataset);
    return fullDataset.filter(q => q.question_type === questionType);
  }

  /**
   * Get dataset statistics
   */
  async getDatasetStats(dataset: 'longmemeval_s' | 'longmemeval_m' | 'longmemeval_oracle' | 'sample_data') {
    const data = await this.loadDataset(dataset);

    const stats = {
      totalQuestions: data.length,
      questionsByType: {} as Record<string, number>,
      abstentionQuestions: 0,
      avgSessionsPerQuestion: 0,
      avgTurnsPerSession: 0,
      totalTokensEstimate: 0,
    };

    // Count questions by type
    for (const question of data) {
      const type = question.question_type;
      stats.questionsByType[type] = (stats.questionsByType[type] || 0) + 1;

      if (question.question_id.endsWith('_abs')) {
        stats.abstentionQuestions++;
      }
    }

    // Calculate average sessions and turns
    const totalSessions = data.reduce((sum, q) => sum + q.haystack_sessions.length, 0);
    stats.avgSessionsPerQuestion = totalSessions / data.length;

    let totalTurns = 0;
    for (const question of data) {
      for (const session of question.haystack_sessions) {
        totalTurns += session.length;
      }
    }
    stats.avgTurnsPerSession = totalTurns / totalSessions;

    // Rough token estimate (assuming ~4 chars per token)
    for (const question of data) {
      for (const session of question.haystack_sessions) {
        for (const turn of session) {
          stats.totalTokensEstimate += Math.ceil(turn.content.length / 4);
        }
      }
    }

    return stats;
  }

  /**
   * Validate dataset structure
   */
  private validateDataset(data: any[]): void {
    if (!Array.isArray(data)) {
      throw new Error('Dataset must be an array of questions');
    }

    if (data.length === 0) {
      throw new Error('Dataset is empty');
    }

    // Validate first question structure as sample
    const sample = data[0];
    const requiredFields = [
      'question_id',
      'question_type',
      'question',
      'answer',
      'question_date',
      'haystack_session_ids',
      'haystack_dates',
      'haystack_sessions',
      'answer_session_ids',
    ];

    for (const field of requiredFields) {
      if (!(field in sample)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate haystack_sessions structure
    if (!Array.isArray(sample.haystack_sessions)) {
      throw new Error('haystack_sessions must be an array');
    }

    if (sample.haystack_sessions.length > 0) {
      const firstSession = sample.haystack_sessions[0];
      if (!Array.isArray(firstSession)) {
        throw new Error('Each session must be an array of turns');
      }

      if (firstSession.length > 0) {
        const firstTurn = firstSession[0];
        if (!firstTurn.role || !firstTurn.content) {
          throw new Error('Each turn must have role and content fields');
        }
      }
    }
  }
}
