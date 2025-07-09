import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt/Txt';
import { useAgentSettings } from '@/domains/agents/context/agent-context';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const AgentAdvancedSettings = () => {
  const { settings, setSettings } = useAgentSettings();
  const [isOpen, setIsOpen] = useState(false);

  const collapsibleClassName = 'rounded-lg border-sm border-border1 bg-surface3 overflow-clip';
  const collapsibleTriggerClassName =
    'text-icon3 text-ui-lg font-medium flex items-center gap-2 w-full p-[10px] justify-between';
  const collapsibleContentClassName = 'bg-surface2 p-[10px] grid grid-cols-2 gap-[10px]';

  return (
    <Collapsible className={collapsibleClassName} open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className={collapsibleTriggerClassName}>
        Advanced Settings
        <Icon className={cn('transition-transform', isOpen ? 'rotate-0' : '-rotate-90')}>
          <ChevronDown />
        </Icon>
      </CollapsibleTrigger>
      <CollapsibleContent className={collapsibleContentClassName}>
        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="top-k">
            Top K
          </Txt>
          <Input
            id="top-k"
            type="number"
            value={settings?.modelSettings?.topK || ''}
            onChange={e =>
              setSettings({
                ...settings,
                modelSettings: {
                  ...settings?.modelSettings,
                  topK: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="frequency-penalty">
            Frequency Penalty
          </Txt>
          <Input
            id="frequency-penalty"
            type="number"
            value={settings?.modelSettings?.frequencyPenalty || ''}
            onChange={e =>
              setSettings({
                ...settings,
                modelSettings: {
                  ...settings?.modelSettings,
                  frequencyPenalty: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="presence-penalty">
            Presence Penalty
          </Txt>
          <Input
            id="presence-penalty"
            type="number"
            value={settings?.modelSettings?.presencePenalty || ''}
            onChange={e =>
              setSettings({
                ...settings,
                modelSettings: {
                  ...settings?.modelSettings,
                  presencePenalty: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="max-tokens">
            Max Tokens
          </Txt>
          <Input
            id="max-tokens"
            type="number"
            value={settings?.modelSettings?.maxTokens || ''}
            onChange={e =>
              setSettings({
                ...settings,
                modelSettings: {
                  ...settings?.modelSettings,
                  maxTokens: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="max-steps">
            Max Steps
          </Txt>
          <Input
            id="max-steps"
            type="number"
            value={settings?.modelSettings?.maxSteps || ''}
            onChange={e =>
              setSettings({
                ...settings,
                modelSettings: {
                  ...settings?.modelSettings,
                  maxSteps: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm" htmlFor="max-retries">
            Max Retries
          </Txt>
          <Input
            id="max-retries"
            type="number"
            value={settings?.modelSettings?.maxRetries || ''}
            onChange={e =>
              setSettings({
                ...settings,
                modelSettings: {
                  ...settings?.modelSettings,
                  maxRetries: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
