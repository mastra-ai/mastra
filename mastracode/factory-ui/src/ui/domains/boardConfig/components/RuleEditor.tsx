import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { RuleBuilder } from '@mastra/playground-ui/components/RuleBuilder';
import type { RuleBuilderProps } from '@mastra/playground-ui/components/RuleBuilder';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useId, useState } from 'react';

import { ruleProblem, validateRule } from '../boardDraft';
import type { CardRule } from '../boardDraft';

/** The card facts a phase rule can test (`CARD_RULE_FIELDS`), as the rule builder's field tree. */
const CARD_FACTS: RuleBuilderProps['schema'] = {
  type: 'object',
  properties: {
    item: {
      type: 'object',
      title: 'Card',
      properties: {
        labels: { type: 'string', title: 'Labels' },
        title: { type: 'string', title: 'Title' },
        author: { type: 'string', title: 'Author' },
      },
    },
    author: { type: 'object', title: 'Author', properties: { trusted: { type: 'boolean', title: 'Trusted' } } },
    source: {
      type: 'object',
      title: 'Source',
      properties: {
        kind: { type: 'string', title: 'Kind' },
        integration: { type: 'string', title: 'Integration' },
      },
    },
  },
};

/**
 * A phase condition, edited with the rule builder or as raw JSON. Unset means "every card".
 * Reports a rule the server would refuse, so the form can hold back the save.
 */
export function RuleEditor({
  label,
  description,
  rule,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  rule: CardRule | null | undefined;
  disabled: boolean;
  onChange: (rule: CardRule | null, problem: string | undefined) => void;
}) {
  const [raw, setRaw] = useState<string | undefined>(undefined);
  const [rawProblem, setRawProblem] = useState<string | undefined>(undefined);
  const id = useId();
  const problem = raw === undefined ? ruleProblem(rule) : rawProblem;

  const editRaw = (text: string) => {
    setRaw(text);
    if (text.trim() === '') {
      setRawProblem(undefined);
      onChange(null, undefined);
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      setRawProblem('Not valid JSON.');
      onChange(rule ?? null, 'Not valid JSON.');
      return;
    }
    const checked = validateRule(value);
    if ('problem' in checked) {
      setRawProblem(checked.problem);
      onChange(rule ?? null, checked.problem);
      return;
    }
    setRawProblem(undefined);
    onChange(checked.rule, undefined);
  };

  return (
    <Field invalid={problem !== undefined}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {!disabled && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRawProblem(undefined);
              if (raw === undefined) {
                setRaw(rule ? JSON.stringify(rule, null, 2) : '');
                return;
              }
              setRaw(undefined);
              // The builder edits the last valid rule, so JSON that never parsed no longer holds the save.
              onChange(rule ?? null, ruleProblem(rule));
            }}
          >
            {raw === undefined ? 'Edit as JSON' : 'Use rule builder'}
          </Button>
        )}
      </div>
      <FieldDescription>{description}</FieldDescription>
      {raw !== undefined ? (
        <Textarea
          id={id}
          aria-label={`${label} JSON`}
          value={raw}
          disabled={disabled}
          rows={6}
          className="font-mono"
          onChange={event => editRaw(event.target.value)}
        />
      ) : disabled ? (
        <Txt id={id} as="p" variant="caption" tone="muted" font={rule ? 'mono' : undefined}>
          {rule ? JSON.stringify(rule) : 'Every card.'}
        </Txt>
      ) : (
        <div id={id}>
          <RuleBuilder
            schema={CARD_FACTS}
            // Factory's rule groups have the builder's shape; the server validates the depth.
            ruleGroup={(rule ?? undefined) as RuleBuilderProps['ruleGroup']}
            onChange={next => {
              const value = (next ?? null) as CardRule | null;
              onChange(value, ruleProblem(value));
            }}
          />
        </div>
      )}
      {problem && <FieldError>{problem}</FieldError>}
    </Field>
  );
}
