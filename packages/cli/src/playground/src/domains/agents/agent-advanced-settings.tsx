import { AgentContext, Icon, Txt } from '@mastra/playground-ui';
import { useContext, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const AgentAdvancedSettings = () => {
  const { modelSettings, setModelSettings } = useContext(AgentContext);
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
          <Txt as="label" className="text-icon3" variant="ui-sm">
            Top K
          </Txt>
          <Input
            type="number"
            value={modelSettings?.topK}
            onChange={e =>
              setModelSettings({ ...modelSettings, topK: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>

        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm">
            Frequency Penalty
          </Txt>
          <Input
            type="number"
            value={modelSettings?.frequencyPenalty}
            onChange={e =>
              setModelSettings({
                ...modelSettings,
                frequencyPenalty: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm">
            Presence Penalty
          </Txt>
          <Input
            type="number"
            value={modelSettings?.presencePenalty}
            onChange={e =>
              setModelSettings({
                ...modelSettings,
                presencePenalty: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm">
            Max Tokens
          </Txt>
          <Input
            type="number"
            value={modelSettings?.maxTokens}
            onChange={e =>
              setModelSettings({
                ...modelSettings,
                maxTokens: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm">
            Max Steps
          </Txt>
          <Input
            type="number"
            value={modelSettings?.maxSteps}
            onChange={e =>
              setModelSettings({
                ...modelSettings,
                maxSteps: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Txt as="label" className="text-icon3" variant="ui-sm">
            Max Retries
          </Txt>
          <Input
            type="number"
            value={modelSettings?.maxRetries}
            onChange={e =>
              setModelSettings({
                ...modelSettings,
                maxRetries: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
