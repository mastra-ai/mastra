import * as p from '@clack/prompts';
import { DepsService } from '../../services/service.deps';
import { toCamelCase } from '../../utils/string';
import { AVAILABLE_SCORERS } from './available-scorers';
import { writeScorer } from './file-utils';
import type { ScorerTemplate } from './types';
import pc from 'picocolors';

export async function selectScorer(): Promise<ScorerTemplate | null> {
  const options = [];

  for (const scorer of AVAILABLE_SCORERS) {
    options.push({
      value: scorer.id,
      label: `${scorer.name}`,
      hint: `${scorer.description}`,
    });
  }

  const selectedId = await p.select({
    message: 'Choose a scorer to add:',
    options,
  });

  if (p.isCancel(selectedId) || typeof selectedId !== 'string') {
    p.log.info('Scorer selection cancelled.');
    return null;
  }

  const selectedScorer = AVAILABLE_SCORERS.find(scorer => scorer.id === selectedId);
  return selectedScorer || null;
}

export const addNewScorer = async (scorerId?: string) => {
  const depServce = new DepsService();
  const needsEvals = (await depServce.checkDependencies(['@mastra/evals'])) !== `ok`;

  if (needsEvals) {
    await depServce.installPackages(['@mastra/evals']);
  }

  if (!scorerId) {
    let selectedScorer = await selectScorer();
    if (!selectedScorer) {
      return;
    }

    const useCustomDir = await p.confirm({
      message: 'Would you like to use a custom directory?',
      initialValue: false,
    });

    if (p.isCancel(useCustomDir)) {
      p.log.info('Operation cancelled.');
      return;
    }

    let customPath: string | undefined;
    if (useCustomDir) {
      const dirPath = await p.text({
        message: 'Enter the directory path (relative to project root):',
        placeholder: 'src/scorers',
      });

      if (p.isCancel(dirPath)) {
        p.log.info('Operation cancelled.');
        return;
      }
      customPath = dirPath as string;

      const { id, filename } = selectedScorer;
      await initializeScorer(id, filename, customPath);
    }

    const foundScorer = AVAILABLE_SCORERS.find(scorer => scorer.id === selectedScorer.id);
    if (!foundScorer) {
      p.log.error(`Scorer with id ${selectedScorer.id} not found`);
      return;
    }

    await initializeScorer(selectedScorer.id, selectedScorer.filename);
    return;
  }

  const foundScorer = AVAILABLE_SCORERS.find(scorer => scorer.id === scorerId);
  if (!foundScorer) {
    p.log.error(`Scorer with id ${scorerId} not found`);
    return;
  }

  const { id, filename } = foundScorer;

  await initializeScorer(id, filename);
};

async function initializeScorer(scorerId: string, filename: string, customPath?: string) {
  try {
    const templateModule = await import(`../../templates/scorers/${filename}`);
    const key = `${toCamelCase(scorerId)}Scorer`;
    const templateContent = templateModule[key];
    writeScorer(filename, templateContent, customPath);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    p.log.error(`Failed to add scorer: ${errorMessage}`);
  }
}
