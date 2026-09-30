import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RotateCcw } from 'lucide-react';

import { MODEL_OPTIONS, modelsOn } from './cast';
import type { Storyboard } from './StoryboardProvider';
import { SettingSelect } from './StorySettingControls';

export function StoryMemoryPicker({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const { sharedAccount, memory } = state;
  const runnable = sharedAccount ? modelsOn(sharedAccount) : MODEL_OPTIONS;
  const options = [...new Set([memory.model, ...runnable])].map(model => ({ value: model, label: model }));
  return (
    <SettingSelect
      label="Observational memory model"
      value={memory.model}
      options={options}
      onChange={model => patch({ memory: { ...memory, model } })}
      className="w-36"
    />
  );
}

export function StoryMemoryNotice({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const { memory } = state;
  if (!memory.broken) return null;
  const paused = state.cards.length;
  return (
    <div className="px-4 py-3">
      <Notice
        variant="destructive"
        title={`${paused} ${paused === 1 ? 'thread' : 'threads'} paused`}
        action={
          <Button
            size="sm"
            icon={<RotateCcw aria-hidden />}
            onClick={() => patch({ memory: { ...memory, broken: false } })}
          >
            Retry blocked threads
          </Button>
        }
      >
        <Notice.Message>{memory.model} failed to write memory. Pick a working model, then retry.</Notice.Message>
      </Notice>
    </div>
  );
}
