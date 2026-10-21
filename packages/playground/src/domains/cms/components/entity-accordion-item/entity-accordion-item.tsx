import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { RuleBuilder } from '@mastra/playground-ui/components/RuleBuilder';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import type { JsonSchema } from '@mastra/playground-ui/utils/json-schema';
import type { RuleGroup } from '@mastra/playground-ui/utils/rule-engine';
import { countLeafRules } from '@mastra/playground-ui/utils/rule-engine';
import { Ruler, Trash2 } from 'lucide-react';
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
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex flex-col gap-2 bg-background p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size="xs">{icon}</Icon>
            <Txt as="span" variant="column" tone="ink">
              {name}
            </Txt>
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
          className="min-h-[40px] border-dashed bg-card px-2 py-1"
          size="sm"
          disabled={isReadOnly}
        />
      </div>

      {showRulesSection && (
        <Collapsible open={isRulesOpen} onOpenChange={setIsRulesOpen} className="border-t border-border bg-background">
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2">
            <Icon>
              <DisclosureChevron direction="right" className="text-muted-foreground" />
            </Icon>
            <Icon>
              <Ruler className="text-warning-foreground" />
            </Icon>
            <Txt as="span" variant="caption" tone="ink">
              Display Conditions
            </Txt>
            {ruleCount > 0 && (
              <Txt as="span" variant="caption" tone="muted">
                ({ruleCount} {ruleCount === 1 ? 'rule' : 'rules'})
              </Txt>
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
