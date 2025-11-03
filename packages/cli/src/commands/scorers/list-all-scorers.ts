import * as p from '@clack/prompts';
import color from 'picocolors';
import { AVAILABLE_SCORERS } from './available-scorers';
import type { ScorerTemplate } from './types';

function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTable(scorers: ScorerTemplate[]): string {
  if (scorers.length === 0) return '';

  // Calculate column widths
  const nameWidth = Math.max(4, Math.max(...scorers.map(s => s.name.length)));
  const idWidth = Math.max(2, Math.max(...scorers.map(s => s.id.length)));
  const typeWidth = Math.max(4, Math.max(...scorers.map(s => s.type.length)));
  const descWidth = Math.max(11, Math.max(...scorers.map(s => s.description.length)));

  // Create header
  const header = `${color.bold('Name'.padEnd(nameWidth))} │ ${color.bold('ID'.padEnd(idWidth))} │ ${color.bold('Type'.padEnd(typeWidth))} │ ${color.bold('Description'.padEnd(descWidth))}`;
  const separator =
    '─'.repeat(nameWidth) +
    '─┼─' +
    '─'.repeat(idWidth) +
    '─┼─' +
    '─'.repeat(typeWidth) +
    '─┼─' +
    '─'.repeat(descWidth) +
    '─';

  // Create rows
  const rows = scorers.map(
    scorer =>
      `${(scorer?.name ?? scorer?.id).padEnd(nameWidth)} │ ${color.dim(scorer.id.padEnd(idWidth))} │ ${scorer.type.padEnd(typeWidth)} │ ${color.dim(scorer.description.padEnd(descWidth))}`,
  );

  return [header, separator, ...rows].join('\n');
}

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
    p.log.info(`${color.bold(color.cyan(formatCategoryName(category)))} Scorers:`);
    p.log.message(formatTable(scorers));
  }
}
