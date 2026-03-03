import { useState, useEffect } from 'react';
import { SideDialog } from '@/ds/components/SideDialog';
import { Button } from '@/ds/components/Button';
import { RuleBuilder } from '@/lib/rule-engine';
import type { JsonSchema } from '@/lib/json-schema';
import type { RuleGroup } from '../types';

interface ConditionRulesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RuleGroup | undefined;
  onSave: (rules: RuleGroup | undefined) => void;
  schema: JsonSchema;
}

export function ConditionRulesDialog({ isOpen, onClose, rules, onSave, schema }: ConditionRulesDialogProps) {
  const [localRules, setLocalRules] = useState<RuleGroup | undefined>(rules);

  useEffect(() => {
    if (isOpen) {
      setLocalRules(rules);
    }
  }, [isOpen, rules]);

  const handleSave = () => {
    onSave(localRules);
    onClose();
  };

  return (
    <SideDialog
      dialogTitle="Condition Rules"
      dialogDescription="Define rules that determine when this condition branch executes"
      isOpen={isOpen}
      onClose={onClose}
      level={3}
    >
      <SideDialog.Top>
        <span className="flex-1">Condition Rules</span>
        <div className="flex items-center gap-2 mr-6">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      </SideDialog.Top>

      <SideDialog.Content>
        <RuleBuilder schema={schema} ruleGroup={localRules} onChange={setLocalRules} />
      </SideDialog.Content>
    </SideDialog>
  );
}
