import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';
import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { RuleBuilder } from '@mastra/playground-ui/components/RuleBuilder';
import type { RuleBuilderProps } from '@mastra/playground-ui/components/RuleBuilder';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useId, useState } from 'react';
import type { z } from 'zod';

type Facts = RuleBuilderProps['schema'];

const CARD_FACT_PROPERTIES = {
  item: {
    type: 'object',
    title: 'Card',
    properties: {
      labels: { type: 'string', title: 'Labels' },
      title: { type: 'string', title: 'Title' },
      author: { type: 'string', title: 'Author' },
      pullRequest: { type: 'number', title: 'Open pull request' },
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
} satisfies Facts['properties'];

/** The card facts a phase rule can test (`CARD_RULE_FIELDS`), as the rule builder's field tree. */
export const CARD_FACTS: Facts = { type: 'object', properties: CARD_FACT_PROPERTIES };

/**
 * The facts an intake route can test (`INTAKE_ROUTE_RULE_FIELDS`): the card's, the status event a
 * route moves cards on, and the issue a pull request closes.
 */
const ROUTE_FACT_PROPERTIES = {
  ...CARD_FACT_PROPERTIES,
  pullRequest: {
    type: 'object',
    title: 'Pull request',
    properties: { closesIssue: { type: 'boolean', title: 'Closes an issue' } },
  },
  closedIssue: {
    type: 'object',
    title: 'Closed issue',
    properties: {
      phase: { type: 'string', title: 'Phase' },
      hasPullRequest: { type: 'boolean', title: 'Has a pull request' },
    },
  },
} as const;

/**
 * The facts an intake route handling `on` can test. As the route API requires, event facts
 * apply only to a route handling an event besides `work_item.created`, and `event.reason` only
 * to one handling `work_item.closed`, the one event that carries a reason.
 */
export function intakeRouteFacts(on: readonly string[]): Facts {
  if (on.every(type => type === 'work_item.created')) return { type: 'object', properties: ROUTE_FACT_PROPERTIES };
  const event = {
    type: { type: 'string', title: 'Type' },
    ...(on.includes('work_item.closed') ? { reason: { type: 'string', title: 'Reason' } } : {}),
  };
  return {
    type: 'object',
    properties: { ...ROUTE_FACT_PROPERTIES, event: { type: 'object', title: 'Event', properties: event } },
  };
}

type RuleIssue = { path: PropertyKey[]; message: string; code: string; errors?: RuleIssue[][] };

/** Zod issues as `path: message`, following the closest branch of a condition-or-group union. */
function describeIssues(issues: RuleIssue[], prefix: PropertyKey[] = []): string[] {
  return issues.flatMap(issue => {
    const path = [...prefix, ...issue.path];
    if (issue.code === 'invalid_union' && issue.errors?.length) {
      const closest = issue.errors.reduce((best, branch) => (branch.length < best.length ? branch : best));
      return describeIssues(closest, path);
    }
    return [`${path.map(String).join('.') || 'rule'}: ${issue.message}`];
  });
}

/** Why the server would refuse this rule, if it would. */
function validateRule<Rule>(schema: z.ZodType<Rule>, value: unknown): { rule: Rule } | { problem: string } {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { rule: parsed.data };
  return { problem: describeIssues(parsed.error.issues).join('; ') };
}

function ruleProblem<Rule>(schema: z.ZodType<Rule>, rule: Rule | null | undefined): string | undefined {
  if (rule == null) return undefined;
  const checked = validateRule(schema, rule);
  return 'problem' in checked ? checked.problem : undefined;
}

/**
 * A rule, edited with the rule builder or as raw JSON. Unset means "every card".
 * Reports a rule the server would refuse, so the form can hold back the save.
 * `facts` defaults to the card facts a phase rule tests.
 */
export function RuleEditor<Rule>({
  label,
  description,
  rule,
  disabled,
  facts = CARD_FACTS,
  schema,
  onChange,
}: {
  label: string;
  description: string;
  rule: Rule | null | undefined;
  disabled: boolean;
  facts?: Facts;
  schema: z.ZodType<Rule>;
  onChange: (rule: Rule | null, problem: string | undefined) => void;
}) {
  const [raw, setRaw] = useState<string | undefined>(undefined);
  const [rawProblem, setRawProblem] = useState<string | undefined>(undefined);
  const id = useId();
  const problem = raw === undefined ? ruleProblem(schema, rule) : rawProblem;

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
    const checked = validateRule(schema, value);
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
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => {
            setRawProblem(undefined);
            if (raw === undefined) {
              setRaw(rule ? JSON.stringify(rule, null, 2) : '');
              return;
            }
            setRaw(undefined);
            // The builder edits the last valid rule, so JSON that never parsed no longer holds the save.
            onChange(rule ?? null, ruleProblem(schema, rule));
          }}
        >
          {raw === undefined ? 'Edit as JSON' : 'Use rule builder'}
        </Button>
      </div>
      <FieldDescription>{description}</FieldDescription>
      {raw !== undefined ? (
        <Textarea
          id={id}
          aria-label={`${label} JSON`}
          value={raw}
          disabled={disabled}
          rows={6}
          onChange={event => editRaw(event.target.value)}
        />
      ) : disabled ? (
        <Txt id={id} as="p" variant="caption" tone="muted">
          {rule ? JSON.stringify(rule) : 'Every card.'}
        </Txt>
      ) : (
        <div id={id}>
          <RuleBuilder
            schema={facts}
            // Factory's rule groups have the builder's shape; the server validates the depth.
            ruleGroup={(rule ?? undefined) as RuleBuilderProps['ruleGroup']}
            onChange={next => {
              const value = (next ?? null) as Rule | null;
              onChange(value, ruleProblem(schema, value));
            }}
          />
        </div>
      )}
      {problem && <FieldError>{problem}</FieldError>}
    </Field>
  );
}
