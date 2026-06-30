import { z } from 'zod';

import { Extractor, validateExtractorList } from './extractor';
import type { ObservationConfig, ReflectionConfig, ResolvedObservationConfig } from './types';

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

interface ComposeExtractorOptions {
  includeContinuationHints?: boolean;
  includeThreadTitle?: boolean;
  userExtractors?: readonly Extractor<any>[];
}

export function composeExtractors(options: ComposeExtractorOptions): Extractor<any>[] {
  const extractors: Extractor<any>[] = [];
  if (options.includeContinuationHints) {
    extractors.push(createCurrentTaskExtractor(), createSuggestedResponseExtractor());
  }
  if (options.includeThreadTitle) {
    extractors.push(createThreadTitleExtractor());
  }
  extractors.push(...(options.userExtractors ?? []));
  return validateExtractorList(extractors);
}

export function composeObservationExtractors(
  config: Pick<ResolvedObservationConfig, 'threadTitle'> & Pick<ObservationConfig, 'extract'>,
): Extractor[] {
  return composeExtractors({
    includeContinuationHints: true,
    includeThreadTitle: config.threadTitle,
    userExtractors: config.extract,
  });
}

export function composeReflectionExtractors(config: Pick<ReflectionConfig, 'extract'>): Extractor[] {
  return composeExtractors({
    includeContinuationHints: true,
    userExtractors: config.extract,
  });
}
