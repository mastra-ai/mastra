import * as p from '@clack/prompts';
import { AVAILABLE_SCORERS } from './available-scorers';
import type { ScorerTemplate } from './types';

export async function selectScorer(): Promise<ScorerTemplate | null> {
  const options = [];

  for (const scorer of AVAILABLE_SCORERS) {
    options.push({
      value: scorer.id,
      label: `${scorer.name}`,
      hint: `
        ${scorer.description}`,
    });
  }

  const selectedId = await p.select({
    message: 'Choose a scorer to add:',
    options,
  });

  if (p.isCancel(selectedId) || typeof selectedId !== 'string' || selectedId.toString().startsWith('category-')) {
    p.log.info('Scorer selection cancelled.');
    return null;
  }

  const selectedScorer = AVAILABLE_SCORERS.find(scorer => scorer.id === selectedId);
  return selectedScorer || null;
}

export const addNewScorer = async (scorerName?: string) => {
  if (!scorerName) {
    const selectedTemplate = await selectScorer();
    if (!selectedTemplate) {
      return;
    }

    const defaultName = selectedTemplate.name;
    const selectedScorer = AVAILABLE_SCORERS.find(scorer => scorer.name === defaultName);
    if (!selectedScorer) {
      p.log.error(`Scorer with name ${defaultName} not found`);
      return;
    }

    console.log({ selectedScorer });
    return;
  }

  const selectedScorer = AVAILABLE_SCORERS.find(scorer => scorer.id === scorerName);
  if (!selectedScorer) {
    p.log.error(`Scorer with id ${scorerName} not found`);
    return;
  }

  console.log({ selectedScorer });
};
