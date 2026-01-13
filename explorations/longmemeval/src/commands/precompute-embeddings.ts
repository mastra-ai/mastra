/**
 * Precompute embeddings for all prepared questions
 * 
 * This command indexes all observations from prepared data and caches
 * the embeddings to disk. This makes subsequent benchmark runs much faster
 * since embeddings don't need to be computed at runtime.
 * 
 * Usage:
 *   pnpm precompute-embeddings -d longmemeval_s -c observational-memory
 *   pnpm precompute-embeddings -d longmemeval_s -c observational-memory --offset 100 --subset 50
 */

import { existsSync, readdirSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import xxhash from 'xxhash-wasm';
import { embedMany } from 'ai';
import { fastembed } from '@mastra/fastembed';
import { writeFileSync } from 'fs';

import type { DatasetType, MemoryConfigType } from '../data/types';
import { getMemoryConfig } from '../config';

export interface PrecomputeEmbeddingsOptions {
  dataset: DatasetType;
  memoryConfig: MemoryConfigType;
  preparedDataDir?: string;
  offset?: number;
  subset?: number;
  batchSize?: number;
  cooldown?: number; // Cooldown in ms between questions
}

interface ObservationalMemoryRecord {
  activeObservations?: string;
}

interface ObservationalMemoryData {
  // New format: observationalMemory is an array of [key, [record, ...]] tuples
  // The second element is itself an array containing the record object(s)
  observationalMemory?: Array<[string, ObservationalMemoryRecord[]]>;
  // Old format: direct record object
  record?: ObservationalMemoryRecord;
}

export class PrecomputeEmbeddingsCommand {
  private hasher = xxhash();

  async run(options: PrecomputeEmbeddingsOptions): Promise<void> {
    const spinner = ora('Loading prepared data...').start();

    const configDef = getMemoryConfig(options.memoryConfig);
    
    // Determine which config to read from (handle readOnlyConfig)
    const effectiveConfig = configDef.readOnlyConfig && configDef.baseConfig 
      ? configDef.baseConfig 
      : options.memoryConfig;

    const baseDir = options.preparedDataDir || join(process.cwd(), 'prepared-data');
    const preparedDir = join(baseDir, options.dataset, effectiveConfig);

    if (!existsSync(preparedDir)) {
      spinner.fail(`Prepared data directory not found: ${preparedDir}`);
      return;
    }

    // Find all question directories
    const questionDirs = readdirSync(preparedDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name);

    if (questionDirs.length === 0) {
      spinner.fail('No prepared questions found');
      return;
    }

    // Apply offset and subset
    let selectedQuestions = questionDirs;
    if (options.offset) {
      selectedQuestions = selectedQuestions.slice(options.offset);
    }
    if (options.subset) {
      selectedQuestions = selectedQuestions.slice(0, options.subset);
    }

    spinner.succeed(`Found ${questionDirs.length} questions, processing ${selectedQuestions.length}`);

    // Create shared cache directory
    const cacheDir = join(preparedDir, '..', '.embeddings-cache');
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    console.log(chalk.gray(`Cache directory: ${cacheDir}`));

    // Track stats
    let totalObservations = 0;
    let totalQuestions = 0;
    let cachedCount = 0;
    let newCount = 0;
    let questionsCached = 0;
    let questionsNew = 0;
    let errorCount = 0;

    const hasher = await this.hasher;
    const batchSize = options.batchSize || 100;

    // Process each question
    for (let i = 0; i < selectedQuestions.length; i++) {
      const questionId = selectedQuestions[i];
      const questionDir = join(preparedDir, questionId);
      const omJsonPath = join(questionDir, 'om.json');

      const progress = `[${i + 1}/${selectedQuestions.length}]`;
      spinner.start(`${progress} Processing ${questionId}...`);

      if (!existsSync(omJsonPath)) {
        spinner.warn(`${progress} ${questionId}: No om.json found, skipping`);
        continue;
      }

      try {
        // Load observations from om.json
        const omData: ObservationalMemoryData = JSON.parse(readFileSync(omJsonPath, 'utf-8'));
        
        // Extract observations - handle both new format (array of tuples) and old format
        let observations = '';
        if (omData.observationalMemory && Array.isArray(omData.observationalMemory)) {
          // New format: [[key, [record, ...]], ...] - get activeObservations from first record in first tuple
          // Structure: observationalMemory[0] = [id, [record_object, ...]]
          const recordArray = omData.observationalMemory[0]?.[1];
          const firstRecord = Array.isArray(recordArray) ? recordArray[0] : undefined;
          observations = firstRecord?.activeObservations || '';
        } else if (omData.record?.activeObservations) {
          // Old format: direct record object
          observations = omData.record.activeObservations;
        }

        if (!observations) {
          spinner.info(`${progress} ${questionId}: No observations found`);
          continue;
        }

        // Parse observation lines
        const lines = this.parseObservationLines(observations);
        totalObservations += lines.length;

        // Check which lines need embedding
        const uncachedLines: { line: string; hash: string }[] = [];
        
        for (const line of lines) {
          const hash = hasher.h32ToString(line);
          const cachePath = join(cacheDir, `${hash}.json`);
          
          if (existsSync(cachePath)) {
            cachedCount++;
          } else {
            uncachedLines.push({ line, hash });
          }
        }

        if (uncachedLines.length === 0) {
          spinner.succeed(`${progress} ${questionId}: ${lines.length} observations (all cached)`);
          continue;
        }

        // Embed in batches
        for (let b = 0; b < uncachedLines.length; b += batchSize) {
          const batch = uncachedLines.slice(b, b + batchSize);
          
          const { embeddings } = await embedMany({
            model: fastembed.small,
            values: batch.map(l => l.line),
          });

          // Save to cache
          for (let j = 0; j < batch.length; j++) {
            const { hash } = batch[j];
            const embedding = embeddings[j];
            const cachePath = join(cacheDir, `${hash}.json`);
            
            try {
              writeFileSync(cachePath, JSON.stringify(embedding));
              newCount++;
            } catch {
              errorCount++;
            }
          }
        }

        // Also embed the question(s) from meta.json
        const metaJsonPath = join(questionDir, 'meta.json');
        let questionStats = '';
        if (existsSync(metaJsonPath)) {
          const meta = JSON.parse(readFileSync(metaJsonPath, 'utf-8'));
          const questionsToEmbed: string[] = [];
          
          if (meta.question) {
            questionsToEmbed.push(meta.question);
          }
          if (meta.improvedQuestion) {
            questionsToEmbed.push(meta.improvedQuestion);
          }
          
          for (const q of questionsToEmbed) {
            totalQuestions++;
            const hash = hasher.h32ToString(q);
            const cachePath = join(cacheDir, `${hash}.json`);
            
            if (existsSync(cachePath)) {
              questionsCached++;
            } else {
              // Embed the question
              const { embeddings } = await embedMany({
                model: fastembed.small,
                values: [q],
              });
              try {
                writeFileSync(cachePath, JSON.stringify(embeddings[0]));
                questionsNew++;
              } catch {
                errorCount++;
              }
            }
          }
          
          questionStats = `, ${questionsToEmbed.length} questions`;
        }

        spinner.succeed(
          `${progress} ${questionId}: ${lines.length} obs ` +
          `(${uncachedLines.length} new, ${lines.length - uncachedLines.length} cached)${questionStats}`
        );

      } catch (err) {
        spinner.fail(`${progress} ${questionId}: Error - ${err}`);
        errorCount++;
      }

      // Cooldown between questions to prevent CPU overload
      const cooldown = options.cooldown ?? 1000; // Default 1 second
      if (cooldown > 0 && i < selectedQuestions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, cooldown));
      }
    }

    // Summary
    console.log('\n' + chalk.bold('Summary:'));
    console.log(`  Observations: ${totalObservations} total (${cachedCount} cached, ${newCount} new)`);
    console.log(`  Questions: ${totalQuestions} total (${questionsCached} cached, ${questionsNew} new)`);
    if (errorCount > 0) {
      console.log(chalk.red(`  Errors: ${errorCount}`));
    }
    console.log(`\nCache location: ${cacheDir}`);
  }

  /**
   * Parse observation lines from the observations block
   * (Simplified version - just extracts non-header lines)
   */
  private parseObservationLines(observations: string): string[] {
    const lines: string[] = [];
    
    for (const line of observations.split('\n')) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) continue;
      
      // Skip date headers
      if (/^##\s+\d{4}-\d{2}-\d{2}/.test(trimmed)) continue;
      if (/^Date:\s+/i.test(trimmed)) continue;
      
      // Skip thread XML tags
      if (/^<thread\s+id=/.test(trimmed)) continue;
      if (/^<\/thread>/.test(trimmed)) continue;
      if (/^<other-conversation\s+id=/.test(trimmed)) continue;
      if (/^<\/other-conversation>/.test(trimmed)) continue;
      
      // Skip pattern headers
      if (/^<patterns>/.test(trimmed)) continue;
      if (/^<\/patterns>/.test(trimmed)) continue;
      
      // This is an observation line
      lines.push(trimmed);
    }
    
    return lines;
  }
}
