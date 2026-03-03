import { useState } from 'react';
import { ChevronRight, Ruler, Trash2 } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { IconButton } from '@/ds/components/IconButton';
import { Textarea } from '@/ds/components/Textarea';
import { Icon } from '@/ds/icons';
import type { JsonSchema, RuleGroup } from '@/lib/rule-engine';
import { RuleBuilder, countLeafRules } from '@/lib/rule-engine';
import { cn } from '@/lib/utils';

export interface EntityAccordionItemProps {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  onDescriptionChange?: (description: string) => void;
  onRemove?: () => void;
  schema?: JsonSchema;
  rules?: RuleGroup;
  onRulesChange?: (rules: RuleGroup | undefined) => void;
}

export function EntityAccordionItem({
  id,
  name,
  icon,
  description,
  onDescriptionChange,
  onRemove,
  schema,
  rules,
  onRulesChange,
}: EntityAccordionItemProps) {
  const isReadOnly = !onDescriptionChange && !onRemove;
  const hasVariablesSet = Object.keys(schema?.properties ?? {}).length > 0;
  const showRulesSection = schema && hasVariablesSet && !isReadOnly;
  const ruleCount = countLeafRules(rules);

  const [isRulesOpen, setIsRulesOpen] = useState(ruleCount > 0);

  return (
    <div className="rounded-md border border-border1 overflow-hidden">
      <div className="bg-surface2 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size="sm">{icon}</Icon>
            <span className="text-xs font-medium text-neutral6">{name}</span>
          </div>
          {onRemove && (
            <IconButton tooltip={`Remove ${name}`} onClick={onRemove} variant="ghost" size="sm">
              <Trash2 />
            </IconButton>
          )}
        </div>

        <Textarea
          id={`description-${id}`}
          value={description}
          onChange={onDescriptionChange ? e => onDescriptionChange(e.target.value) : undefined}
          placeholder="Custom description for this entity..."
          className="min-h-[40px] text-xs bg-surface3 border-dashed px-2 py-1"
          size="sm"
          disabled={isReadOnly}
        />
      </div>

      {showRulesSection && (
        <Collapsible open={isRulesOpen} onOpenChange={setIsRulesOpen} className="border-t border-border1 bg-surface2">
          <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2">
            <Icon>
              <ChevronRight
                className={cn('text-neutral3 transition-transform', {
                  'rotate-90': isRulesOpen,
                })}
              />
            </Icon>
            <Icon>
              <Ruler className="text-accent6" />
            </Icon>
            <span className="text-neutral5 text-ui-sm">Display Conditions</span>
            {ruleCount > 0 && (
              <span className="text-neutral3 text-ui-sm">
                ({ruleCount} {ruleCount === 1 ? 'rule' : 'rules'})
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            {onRulesChange && <RuleBuilder schema={schema} ruleGroup={rules} onChange={onRulesChange} />}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
