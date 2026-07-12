import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { RuleBuilder } from '@mastra/playground-ui/components/RuleBuilder';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { JsonSchema } from '@mastra/playground-ui/utils/json-schema';
import type { RuleGroup } from '@mastra/playground-ui/utils/rule-engine';
import { countLeafRules } from '@mastra/playground-ui/utils/rule-engine';
import { ChevronRight, Ruler, Trash2 } from 'lucide-react';
import { useState } from 'react';

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
    <div className="overflow-hidden rounded-md border border-border1">
      <div className="flex flex-col gap-2 bg-surface2 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size="sm">{icon}</Icon>
            <span className="text-xs font-medium text-neutral6">{name}</span>
          </div>
          {onRemove && (
            <Button tooltip={`Remove ${name}`} onClick={onRemove} variant="ghost" size="icon-sm">
              <Trash2 />
            </Button>
          )}
        </div>

        <Textarea
          id={`description-${id}`}
          value={description}
          onChange={onDescriptionChange ? e => onDescriptionChange(e.target.value) : undefined}
          placeholder="Custom description for this entity..."
          className="min-h-table-row-small border-dashed bg-surface3 px-2 py-1 text-xs"
          size="sm"
          disabled={isReadOnly}
        />
      </div>

      {showRulesSection && (
        <Collapsible open={isRulesOpen} onOpenChange={setIsRulesOpen} className="border-t border-border1 bg-surface2">
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2">
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
            <span className="text-ui-sm text-neutral5">Display Conditions</span>
            {ruleCount > 0 && (
              <span className="text-ui-sm text-neutral3">
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
