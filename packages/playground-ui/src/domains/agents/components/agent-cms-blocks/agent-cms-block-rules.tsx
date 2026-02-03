import { Button } from '@/ds/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { Icon } from '@/ds/icons';
import { JsonSchema, Rule, RuleBuilder } from '@/lib/rule-engine';
import { cn } from '@/lib/utils';
import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';

export type AgentCMSBlockRulesProps = {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
  className?: string;
  schema: JsonSchema;
};

export const AgentCMSBlockRules = ({ rules, onChange, schema }: AgentCMSBlockRulesProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="border-t border-border1 flex items-center justify-start text-left w-full gap-2 px-3 py-2 text-ui-sm text-neutral3 hover:text-neutral6">
          <Icon>
            <ChevronRight
              className={cn('transition-transform duration-normal ease-out-custom', open ? 'rotate-90' : 'rotate-0')}
            />
          </Icon>
          Conditional rules
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <RuleBuilder schema={schema} rules={rules} onChange={onChange} />
      </CollapsibleContent>
    </Collapsible>
  );
};
