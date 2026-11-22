import { Button } from '@/ds/components/Button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';
import { RuleBuilder } from '@/ds/components/RuleBuilder';
import { IconRuler } from '@/ds/icons/central/IconRuler';
import type { JsonSchema } from '@/utils/json-schema';
import type { RuleGroup } from '@/utils/rule-engine';
import { countLeafRules } from '@/utils/rule-engine';

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
      <DialogTrigger
        render={
          <Button
            tooltip={ruleCount > 0 ? `${ruleCount} rules` : 'Display Conditions'}
            size="icon-sm"
            variant="ghost"
            className="relative"
          >
            <IconRuler />
            {ruleCount > 0 && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-foreground" />}
          </Button>
        }
      />
      <DialogContent size="xl">
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
