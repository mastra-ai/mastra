import { z } from 'zod';

import { Extractor, validateExtractorList } from './extractor';
import type { ContinuationHintsConfig, ObservationConfig, ReflectionConfig, ResolvedObservationConfig } from './types';

const currentTaskInstructions = `State the current task(s) explicitly. Can be single or multiple:
- Primary: What the agent is currently working on
- Secondary: Other pending tasks (mark as "waiting for user" if appropriate)

If the agent started doing something without user approval, note that it's off-task.`;

const suggestedResponseInstructions = `Hint for the agent's immediate next message. Examples:
- "I've updated the navigation model. Let me walk you through the changes..."
- "The assistant should wait for the user to respond before continuing."
- Call the view tool on src/example.ts to continue debugging.`;

const threadTitleInstructions = `A short, noun-phrase title for this conversation (2-5 words). Examples:
- "Auth bug fix" — not "Fixing the auth bug"
- "Dark mode toggle" — not "User wants dark mode toggle added"
- "Deployment pipeline setup" — not "Setting up deployment pipeline for project"
Only update when the topic meaningfully changes.`;

export const ARCHIVE_SUMMARY_EXTRACTOR_SLUG = 'archive-catalog-summary';

const archiveSummaryInstructions = `Write one concise sentence that helps the agent decide whether to recall this observation group later. Include the specific people, projects, decisions, or outcomes that distinguish it. Do not mention memory, observations, archives, or this instruction.`;

export function createCurrentTaskExtractor(): Extractor<string> {
  return new Extractor(
    {
      name: 'current-task',
      instructions: currentTaskInstructions,
      schema: z.string(),
      metadataKeyPath: 'currentTask',
    },
    true,
  );
}

export function createSuggestedResponseExtractor(): Extractor<string> {
  return new Extractor(
    {
      name: 'suggested-response',
      instructions: suggestedResponseInstructions,
      schema: z.string(),
      metadataKeyPath: 'suggestedResponse',
    },
    true,
  );
}

export function createThreadTitleExtractor(): Extractor<string> {
  return new Extractor(
    {
      name: 'thread-title',
      instructions: threadTitleInstructions,
      schema: z.string(),
      metadataKeyPath: 'threadTitle',
    },
    true,
  );
}

export function createArchiveSummaryExtractor(): Extractor<string> {
  return new Extractor(
    {
      name: ARCHIVE_SUMMARY_EXTRACTOR_SLUG,
      instructions: archiveSummaryInstructions,
      includePreviousExtraction: false,
      metadataKeyPath: false,
    },
    true,
  );
}

export interface ResolvedContinuationHints {
  currentTask: boolean;
  suggestedResponse: boolean;
}

/**
 * Normalize the user-facing `continuationHints` config into explicit per-section flags.
 * Both sections stay enabled unless the caller opts out, so omitting the config is a no-op.
 */
export function resolveContinuationHints(config: ContinuationHintsConfig | undefined): ResolvedContinuationHints {
  if (config === undefined || config === true) {
    return { currentTask: true, suggestedResponse: true };
  }
  if (config === false) {
    return { currentTask: false, suggestedResponse: false };
  }
  return {
    currentTask: config.currentTask ?? true,
    suggestedResponse: config.suggestedResponse ?? true,
  };
}

interface ComposeExtractorOptions {
  continuationHints?: ContinuationHintsConfig;
  includeThreadTitle?: boolean;
  includeArchiveSummary?: boolean;
  userExtractors?: readonly Extractor<any>[];
}

export function composeExtractors(options: ComposeExtractorOptions): Extractor<any>[] {
  const continuationHints = resolveContinuationHints(options.continuationHints);
  const extractors: Extractor<any>[] = [];
  if (continuationHints.currentTask) {
    extractors.push(createCurrentTaskExtractor());
  }
  if (continuationHints.suggestedResponse) {
    extractors.push(createSuggestedResponseExtractor());
  }
  if (options.includeThreadTitle) {
    extractors.push(createThreadTitleExtractor());
  }
  if (options.includeArchiveSummary) {
    extractors.push(createArchiveSummaryExtractor());
  }
  extractors.push(...(options.userExtractors ?? []));
  return validateExtractorList(extractors);
}

export function composeObservationExtractors(
  config: Pick<ResolvedObservationConfig, 'threadTitle' | 'archive'> &
    Pick<ObservationConfig, 'extract' | 'continuationHints'>,
): Extractor[] {
  return composeExtractors({
    continuationHints: config.continuationHints,
    includeThreadTitle: config.threadTitle,
    includeArchiveSummary: Boolean(config.archive),
    userExtractors: config.extract,
  });
}

export function composeReflectionExtractors(
  config: Pick<ReflectionConfig, 'extract' | 'continuationHints'>,
): Extractor[] {
  return composeExtractors({
    continuationHints: config.continuationHints,
    userExtractors: config.extract,
  });
}
