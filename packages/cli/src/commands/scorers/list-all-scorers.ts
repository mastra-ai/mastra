import * as p from '@clack/prompts';
import color from 'picocolors';
import { AVAILABLE_SCORERS } from './available-scorers';
import type { ScorerTemplate } from './types';

export function listAllScorers(): void {
  p.intro(color.inverse(' Available Scorers '));

  const groupedScorers = AVAILABLE_SCORERS.reduce(
    (acc, scorer) => {
      if (!acc[scorer.category]) {
        acc[scorer.category] = [];
      }
      acc[scorer.category]!.push(scorer);
      return acc;
    },
    {} as Record<string, ScorerTemplate[]>,
  );

  for (const [category, scorers] of Object.entries(groupedScorers)) {
    const categoryLabel = category === 'accuracy-and-reliability' ? 'Accuracy and Reliability' : 'Output Quality';

    p.log.info(`${color.bold(color.cyan(categoryLabel))} Scorers:`);

    for (const scorer of scorers) {
      p.log.message(`  ${color.bold(scorer.name)} ${color.dim(`(${scorer.id})`)}
    ${color.dim(scorer.description)}
    `);
    }
  }
}
