import { useState, useCallback } from 'react';
import { Ruler, Info, Check } from 'lucide-react';

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { IconButton } from '@/ds/components/IconButton';
import { Icon } from '@/ds/icons';
import { Kbd } from '@/ds/components/Kbd';
import type { JsonSchema, RuleGroup } from '@/lib/rule-engine';
import { RuleBuilder, countLeafRules, countGroups } from '@/lib/rule-engine';

interface DisplayConditionsDialogProps {
  entityName: string;
  schema?: JsonSchema;
  rules?: RuleGroup;
  onRulesChange: (rules: RuleGroup | undefined) => void;
}

export function DisplayConditionsDialog({ entityName, schema, rules, onRulesChange }: DisplayConditionsDialogProps) {
  const hasVariables = Object.keys(schema?.properties ?? {}).length > 0;

  const [open, setOpen] = useState(false);
  const [localRules, setLocalRules] = useState<RuleGroup | undefined>(undefined);
  const [showBanner, setShowBanner] = useState(true);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setLocalRules(rules ? structuredClone(rules) : undefined);
        setShowBanner(true);
      }
      setOpen(nextOpen);
    },
    [rules],
  );

  const handleSave = useCallback(() => {
    onRulesChange(localRules);
    setOpen(false);
  }, [localRules, onRulesChange]);

  if (!schema || !hasVariables) {
    return null;
  }

  const ruleCount = countLeafRules(rules);
  const localRuleCount = countLeafRules(localRules);
  const groupCount = countGroups(localRules);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <IconButton
          tooltip={ruleCount > 0 ? `${ruleCount} rules` : 'Display Conditions'}
          size="sm"
          variant="ghost"
          className="relative"
        >
          <Ruler className="text-accent6" />
          {ruleCount > 0 && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent1" />}
        </IconButton>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-full">
        <DialogHeader>
          <DialogTitle>Display Conditions for {entityName}</DialogTitle>
          <DialogDescription>
            Configure when this entity should be displayed based on variable values.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            {showBanner && (
              <div className="flex items-start gap-3 bg-accent5Darker border border-accent5/30 rounded-md p-3">
                <Icon size="sm" className="text-accent5 mt-0.5 shrink-0">
                  <Info />
                </Icon>
                <p className="text-ui-sm text-neutral5 flex-1">
                  Rules within a group are combined with <Kbd>and</Kbd> or <Kbd>or</Kbd> logic. Click the connector
                  between rules to toggle.
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowBanner(false)}>
                  Dismiss
                </Button>
              </div>
            )}

            <RuleBuilder schema={schema} ruleGroup={localRules} onChange={setLocalRules} />
          </div>
        </DialogBody>
        <DialogFooter className="flex items-center justify-between border-t border-border1 px-6 py-4">
          <span className="text-ui-sm text-neutral3">
            {localRuleCount} {localRuleCount === 1 ? 'rule' : 'rules'} · {groupCount}{' '}
            {groupCount === 1 ? 'group' : 'groups'}
          </span>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="primary" onClick={handleSave}>
              <Icon>
                <Check />
              </Icon>
              Save conditions
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
