import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@mastra/playground-ui/components/Dialog';
import { RuleBuilder } from '@mastra/playground-ui/components/RuleBuilder';
import type { JsonSchema } from '@mastra/playground-ui/utils/json-schema';
import type { RuleGroup } from '@mastra/playground-ui/utils/rule-engine';
import { countLeafRules } from '@mastra/playground-ui/utils/rule-engine';
import { Ruler } from 'lucide-react';

interface DisplayConditionsDialogProps {
  entityName: string;
  schema?: JsonSchema;
  rules?: RuleGroup;
  onRulesChange: (rules: RuleGroup | undefined) => void;
}

export function DisplayConditionsDialog({ entityName, schema, rules, onRulesChange }: DisplayConditionsDialogProps) {
  const hasVariables = Object.keys(schema?.properties ?? {}).length > 0;

  if (!schema || !hasVariables) {
    return null;
  }

  const ruleCount = countLeafRules(rules);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          tooltip={ruleCount > 0 ? `${ruleCount} rules` : 'Display Conditions'}
          size="icon-sm"
          variant="ghost"
          className="relative"
        >
          <Ruler className="text-accent6" />
          {ruleCount > 0 && <span className="bg-accent1 absolute -top-0.5 -right-0.5 size-2 rounded-full" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-5xl">
        <DialogHeader>
          <DialogTitle>Display Conditions for {entityName}</DialogTitle>
          <DialogDescription>
            Configure when this entity should be displayed based on variable values.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <RuleBuilder schema={schema} ruleGroup={rules} onChange={onRulesChange} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
