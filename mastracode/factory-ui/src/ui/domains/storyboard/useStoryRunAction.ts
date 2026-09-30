import { toast } from '@mastra/playground-ui/components/Toaster';
import { useNavigate, useParams } from 'react-router';

import type { CardAction } from '../factory/cardPrimaryAction';
import { useStoryCard } from './StoryboardProvider';
import { blockedFix, storySettingsPath } from './storyLinks';
import { stageRun } from './storyState';
import type { CardFacts } from './storyState';

type RunGate = (action: CardAction | undefined) => CardAction | undefined;

export function useStoryRunAction(itemId: string, stage: string | undefined): RunGate {
  const story = useStoryCard(itemId);
  const navigate = useNavigate();
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  return action => {
    if (story === null || action === undefined || !('start' in action)) return action;
    const { storyboard, facts } = story;
    const { state, patch } = storyboard;
    const run = stageRun(state, facts, stage);
    const record = (card: CardFacts) => patch({ cardFacts: { ...state.cardFacts, [itemId]: card } });

    if (run.kind === 'blocked') {
      const fix = blockedFix(run.reason, run.payer, state.viewer);
      return {
        ...action,
        blocked: true,
        ariaLabel: `${action.label} can't start: ${fix.label}`,
        start: () =>
          toast.error(`${action.label} can't start`, {
            description: fix.label,
            action: { label: 'Open Settings', onClick: () => void navigate(storySettingsPath(factoryId, fix.anchor)) },
          }),
      };
    }

    if (run.kind === 'mine')
      return {
        ...action,
        ariaLabel: `${action.label} on your ${run.plan.label}`,
        start: () => {
          record(run.card);
          toast.warning(`${action.label} runs on your ${run.plan.label}`, {
            description: 'No Factory key is connected, so this run bills your own plan.',
            action: {
              label: 'Add a Factory key',
              onClick: () => void navigate(storySettingsPath(factoryId, 'factory-work')),
            },
          });
          action.start();
        },
      };

    return {
      ...action,
      start: () => {
        record(run.card);
        action.start();
      },
    };
  };
}
