/**
 * Reconciliation logic for derived configs that inherit from a base config.
 *
 * When a config has a `baseConfig`, we need to:
 * 1. Check if the target config's data exists for each question
 * 2. If not, copy from the base config
 * 3. Apply any enhancements (e.g., pattern extraction for om-patterns-observed)
 */

import { existsSync } from 'fs';
import { readFile, writeFile, mkdir, cp } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { Agent } from '@mastra/core/agent';

import { getMemoryConfig } from '../config';
import type { MemoryConfigType } from '../data/types';
import {
  buildObserverSystemPrompt,
  PATTERN_INSTRUCTIONS,
} from '@mastra/memory/experiments';

export interface ReconcileOptions {
  /** The target config we're reconciling for */
  targetConfig: MemoryConfigType;
  /** Dataset being used */
  dataset: string;
  /** Question ID to reconcile (if specific) */
  questionId?: string;
  /** Base directory for prepared data */
  preparedDataDir: string;
  /** Model to use for pattern extraction */
  model?: string;
}

export interface ReconcileResult {
  /** Whether reconciliation was needed */
  needed: boolean;
  /** Whether data was copied from base */
  copied: boolean;
  /** Whether patterns were extracted */
  patternsExtracted: boolean;
  /** Error if any */
  error?: string;
}

/**
 * Get the prepared data directory for a specific config and question.
 */
function getQuestionDir(preparedDataDir: string, dataset: string, config: string, questionId: string): string {
  return join(preparedDataDir, dataset, config, questionId);
}

/**
 * Check if a question's data exists for a given config.
 */
function questionDataExists(preparedDataDir: string, dataset: string, config: string, questionId: string): boolean {
  const questionDir = getQuestionDir(preparedDataDir, dataset, config, questionId);
  const metaPath = join(questionDir, 'meta.json');
  return existsSync(metaPath);
}

/**
 * Copy question data from base config to target config.
 */
async function copyQuestionData(
  preparedDataDir: string,
  dataset: string,
  baseConfig: string,
  targetConfig: string,
  questionId: string,
): Promise<void> {
  const sourceDir = getQuestionDir(preparedDataDir, dataset, baseConfig, questionId);
  const targetDir = getQuestionDir(preparedDataDir, dataset, targetConfig, questionId);

  // Ensure target directory exists
  await mkdir(targetDir, { recursive: true });

  // Copy all files from source to target
  await cp(sourceDir, targetDir, { recursive: true });

  // Update meta.json to track the base config
  const metaPath = join(targetDir, 'meta.json');
  if (existsSync(metaPath)) {
    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
    meta.baseConfig = baseConfig;
    meta.reconciledAt = new Date().toISOString();
    await writeFile(metaPath, JSON.stringify(meta, null, 2));
  }
}

/**
 * Build a prompt specifically for pattern extraction from existing observations.
 */
function buildPatternExtractionPrompt(existingObservations: string): string {
  return `## Existing Observations

${existingObservations}

---

## Your Task

Analyze the observations above and extract patterns - recurring themes that can be grouped together.

${PATTERN_INSTRUCTIONS}

Output ONLY the <patterns> section with your extracted patterns. Do not output <observations>, <current-task>, or <suggested-response> - those already exist.

Example output:
<patterns>
<trips>
* visited Hawaii (May 10, 2025)
* road trip to mountains (June 5, 2025)
</trips>
<purchases>
* bought new laptop (May 15, 2025)
* ordered books online (May 20, 2025)
</purchases>
</patterns>

If there are no patterns to extract (fewer than 2 related items), output:
<patterns>
</patterns>`;
}

/**
 * Parse pattern-only output from the LLM.
 */
function parsePatternOutput(output: string): Record<string, string[]> {
  const patterns: Record<string, string[]> = {};
  
  // Extract <patterns> content
  const patternsMatch = output.match(/^[ \t]*<patterns>([\s\S]*?)^[ \t]*<\/patterns>/im);
  if (!patternsMatch?.[1]) {
    return patterns;
  }
  
  const patternsContent = patternsMatch[1];
  // Find all named pattern tags
  const patternTagRegex = /<([a-z][a-z0-9_-]*)>([\s\S]*?)<\/\1>/gi;
  let patternMatch;
  while ((patternMatch = patternTagRegex.exec(patternsContent)) !== null) {
    const patternName = patternMatch[1];
    const patternItemsRaw = patternMatch[2];
    if (!patternName || !patternItemsRaw) continue;
    // Extract list items (lines starting with - or *)
    const items = patternItemsRaw
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-') || line.startsWith('*'))
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
    if (items.length > 0) {
      patterns[patternName] = items;
    }
  }
  
  return patterns;
}

/**
 * Extract patterns from observations for a question.
 * Uses the Observer agent to analyze existing observations and extract patterns.
 */
async function extractPatternsForQuestion(
  preparedDataDir: string,
  dataset: string,
  targetConfig: string,
  questionId: string,
  model: string,
): Promise<boolean> {
  const questionDir = getQuestionDir(preparedDataDir, dataset, targetConfig, questionId);
  const omJsonPath = join(questionDir, 'om.json');

  if (!existsSync(omJsonPath)) {
    console.warn(chalk.yellow(`No om.json found for question ${questionId}`));
    return false;
  }

  // Load the OM data
  const omData = JSON.parse(await readFile(omJsonPath, 'utf-8'));

  // Get the OM record (handle both old and new structure)
  const records = omData.observationalMemory?.records || omData.records || [];
  if (records.length === 0) {
    console.warn(chalk.yellow(`No OM records found for question ${questionId}`));
    return false;
  }

  // Get the most recent record
  const record = records[records.length - 1];
  const activeObservations = record.activeObservations || '';

  if (!activeObservations) {
    console.warn(chalk.yellow(`No active observations for question ${questionId}`));
    return false;
  }

  // Create an agent for pattern extraction
  const patternAgent = new Agent({
    id: 'pattern-extractor',
    name: 'pattern-extractor',
    model: model as `${string}/${string}`,
    instructions: buildObserverSystemPrompt(true), // Include pattern instructions
  });

  // Build the pattern extraction prompt
  const prompt = buildPatternExtractionPrompt(activeObservations);

  try {
    // Call the agent to extract patterns
    const result = await patternAgent.generate(prompt);
    const patterns = parsePatternOutput(result.text);

    // If no patterns found, that's okay - not all questions have patterns
    if (Object.keys(patterns).length === 0) {
      return false;
    }

    // Merge new patterns with any existing patterns on the record
    const existingPatterns = record.patterns || {};
    const mergedPatterns: Record<string, string[]> = { ...existingPatterns };
    
    for (const [patternName, items] of Object.entries(patterns)) {
      if (mergedPatterns[patternName]) {
        // Merge and deduplicate
        const existingItems = new Set(mergedPatterns[patternName]);
        for (const item of items) {
          existingItems.add(item);
        }
        mergedPatterns[patternName] = Array.from(existingItems);
      } else {
        mergedPatterns[patternName] = items;
      }
    }

    // Update the record with patterns
    record.patterns = mergedPatterns;

    // Save the updated OM data
    await writeFile(omJsonPath, JSON.stringify(omData, null, 2));

    return true;
  } catch (error) {
    console.error(chalk.red(`Error extracting patterns for ${questionId}:`), error);
    return false;
  }
}

/**
 * Reconcile a single question's data from base config to target config.
 */
export async function reconcileQuestion(
  options: ReconcileOptions & { questionId: string },
): Promise<ReconcileResult> {
  const configDef = getMemoryConfig(options.targetConfig);

  // If no base config, nothing to reconcile
  if (!configDef.baseConfig) {
    return { needed: false, copied: false, patternsExtracted: false };
  }

  const { preparedDataDir, dataset, targetConfig, questionId } = options;
  const baseConfig = configDef.baseConfig;

  // Check if target data already exists
  if (questionDataExists(preparedDataDir, dataset, targetConfig, questionId)) {
    return { needed: false, copied: false, patternsExtracted: false };
  }

  // Check if base data exists
  if (!questionDataExists(preparedDataDir, dataset, baseConfig, questionId)) {
    return {
      needed: true,
      copied: false,
      patternsExtracted: false,
      error: `Base config data not found for question ${questionId}`,
    };
  }

  // Copy data from base config
  await copyQuestionData(preparedDataDir, dataset, baseConfig, targetConfig, questionId);

  let patternsExtracted = false;

  // If this config needs pattern extraction, do it
  if (configDef.recognizePatterns) {
    const model = options.model || configDef.omModel || 'openai/gpt-4o';
    patternsExtracted = await extractPatternsForQuestion(
      preparedDataDir,
      dataset,
      targetConfig,
      questionId,
      model,
    );
  }

  return { needed: true, copied: true, patternsExtracted };
}

/**
 * Reconcile all questions for a derived config.
 * This is called before prepare/run to ensure data is available.
 */
export async function reconcileFromBaseConfig(options: ReconcileOptions): Promise<{
  total: number;
  copied: number;
  patternsExtracted: number;
  errors: string[];
}> {
  const configDef = getMemoryConfig(options.targetConfig);

  // If no base config, nothing to reconcile
  if (!configDef.baseConfig) {
    return { total: 0, copied: 0, patternsExtracted: 0, errors: [] };
  }

  const { preparedDataDir, dataset, targetConfig, questionId } = options;
  const baseConfig = configDef.baseConfig;

  // If specific question, just reconcile that one
  if (questionId) {
    const spinner = ora(`Reconciling ${questionId} from ${baseConfig}...`).start();
    const result = await reconcileQuestion({ ...options, questionId });

    if (result.error) {
      spinner.fail(result.error);
      return { total: 1, copied: 0, patternsExtracted: 0, errors: [result.error] };
    }

    if (result.copied) {
      spinner.succeed(`Reconciled ${questionId} from ${baseConfig}${result.patternsExtracted ? ' (patterns extracted)' : ''}`);
      return { total: 1, copied: 1, patternsExtracted: result.patternsExtracted ? 1 : 0, errors: [] };
    }

    spinner.info(`${questionId} already exists`);
    return { total: 1, copied: 0, patternsExtracted: 0, errors: [] };
  }

  // Get all questions from base config
  const baseDir = join(preparedDataDir, dataset, baseConfig);
  if (!existsSync(baseDir)) {
    console.log(chalk.yellow(`Base config directory not found: ${baseDir}`));
    return { total: 0, copied: 0, patternsExtracted: 0, errors: [] };
  }

  const { readdir } = await import('fs/promises');
  const questionDirs = await readdir(baseDir);
  const questionIds = questionDirs.filter(d => {
    const metaPath = join(baseDir, d, 'meta.json');
    return existsSync(metaPath);
  });

  if (questionIds.length === 0) {
    console.log(chalk.yellow(`No prepared questions found in base config: ${baseConfig}`));
    return { total: 0, copied: 0, patternsExtracted: 0, errors: [] };
  }

  console.log(chalk.blue(`\n📦 Reconciling ${questionIds.length} questions from ${baseConfig} to ${targetConfig}...\n`));

  let copied = 0;
  let patternsExtracted = 0;
  const errors: string[] = [];

  for (const qId of questionIds) {
    const result = await reconcileQuestion({ ...options, questionId: qId });

    if (result.error) {
      errors.push(result.error);
    } else if (result.copied) {
      copied++;
      if (result.patternsExtracted) {
        patternsExtracted++;
      }
    }
  }

  console.log(chalk.green(`\n✓ Reconciliation complete: ${copied} copied, ${patternsExtracted} patterns extracted, ${errors.length} errors\n`));

  return { total: questionIds.length, copied, patternsExtracted, errors };
}
