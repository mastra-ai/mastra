import * as p from '@clack/prompts';
import pc from 'picocolors';
import { DepsService } from '../../services/service.deps';
import { AVAILABLE_SCORERS } from './available-scorers';
import { writeScorer } from './file-utils';
import type { ScorerTemplate } from './types';

export async function selectScorer(): Promise<ScorerTemplate[] | null> {
  const groupedScorers = AVAILABLE_SCORERS.reduce(
    (acc, curr) => {
      if (!acc[curr.type]) {
        acc[curr.type] = [];
      }
      let obj = acc[curr.type];
      if (!obj) return acc;
      obj.push({
        value: curr.id,
        label: `${curr.name}`,
        hint: `${curr.description}`,
      });
      return acc;
    },
    {} as Record<string, Array<{ value: string; label: string; hint: string }>>,
  );

  const selectedIds = await p.groupMultiselect({
    message: 'Choose a scorer to add:',
    options: groupedScorers,
  });

  if (p.isCancel(selectedIds) || typeof selectedIds !== 'object') {
    p.log.info('Scorer selection cancelled.');
    return null;
  }

  if (!Array.isArray(selectedIds)) {
    return null;
  }

  const selectedScorers = selectedIds
    .map(scorerId => {
      const foundScorer = AVAILABLE_SCORERS.find(s => s.id === scorerId);
      return foundScorer;
    })
    .filter(item => item != undefined);

  return selectedScorers;
}

export async function addNewScorer(scorerId?: string, customDir?: string) {
  const depService = new DepsService();
  const needsEvals = (await depService.checkDependencies(['@mastra/evals'])) !== `ok`;

  if (needsEvals) {
    await depService.installPackages(['@mastra/evals']);
  }

  if (!scorerId) {
    await showInteractivePrompt(customDir);
    return;
  }

  const foundScorer = AVAILABLE_SCORERS.find(scorer => scorer.id === scorerId.toLowerCase());
  if (!foundScorer) {
    p.log.error(`Scorer for ${scorerId} not available`);
    return;
  }

  try {
    const res = await initializeScorer(foundScorer, customDir);
    if (!res.ok) {
      return;
    }
    p.log.success(res.message);
    showSuccessNote();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Skipped')) {
      return p.log.warning(errorMessage);
    }
    p.log.error(errorMessage);
  }
}

async function initializeScorer(scorer: ScorerTemplate, customPath?: string) {
  try {
    const templateContent = scorer.content;
    const res = writeScorer(scorer.filename, templateContent!, customPath);
    return res;
  } catch (error) {
    throw error;
  }
}

function showSuccessNote() {
  p.note(`
        ${pc.green('To use: Add the Scorer to your workflow or agent!')}
        `);
}

async function showInteractivePrompt(providedCustomDir?: string) {
  let selectedScorers = await selectScorer();
  if (!selectedScorers) {
    return;
  }

  let customPath: string | undefined = providedCustomDir;

  // Only ask for custom directory if one wasn't provided via --dir flag
  if (!providedCustomDir) {
    const useCustomDir = await p.confirm({
      message: `Would you like to use a custom directory?${pc.gray('(Default: src/mastra/scorers)')}`,
      initialValue: false,
    });

    if (p.isCancel(useCustomDir)) {
      p.log.info('Operation cancelled.');
      return;
    }

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
    }
  }

  const result = await Promise.allSettled(
    selectedScorers.map(scorer => {
      return initializeScorer(scorer, customPath);
    }),
  );

  result.forEach(op => {
    if (op.status === 'fulfilled') {
      p.log.success(op.value.message);
      return;
    }
    const errorMessage = String(op.reason);
    const coreError = errorMessage.replace('Error:', '').trim();
    if (coreError.includes('Skipped')) {
      return p.log.warning(coreError);
    }
    p.log.error(coreError);
  });

  const containsSuccessfulWrites = result.some(item => item.status === 'fulfilled');

  if (containsSuccessfulWrites) {
    showSuccessNote();
  }
  return;
}
