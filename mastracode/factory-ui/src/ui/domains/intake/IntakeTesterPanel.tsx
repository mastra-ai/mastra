import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect, useState } from 'react';

import type { IntakeTestBody, IntakeTestResponse } from '../../../api/types';
import { useIntakeTest } from '../../../hooks/useIntakeDryRun';
import { ruleVerdictLabel } from './intakeCheckCopy';

export interface IntakeTesterPanelProps {
  factoryProjectId: string;
  /** A recent card's or Not routed decision's id to test as soon as the panel opens. */
  itemId?: string;
  /** Unsaved rules or intake order to test against instead of the saved ones. */
  draft?: Pick<IntakeTestBody, 'boards' | 'order'>;
}

function ruleNamer(result: IntakeTestResponse) {
  const names = new Map<string, string>();
  for (const board of result.boards) {
    for (const rule of board.rules) {
      names.set(`${board.boardKey}\u0000${rule.routeId}`, `${board.name} › ${rule.name ?? 'Unnamed rule'}`);
    }
  }
  return (boardKey: string, routeId: string) => names.get(`${boardKey}\u0000${routeId}`) ?? boardKey;
}

function Verdict({ result }: { result: IntakeTestResponse }) {
  if (!result.placement) {
    return <Notice variant="warning">{`Not routed. ${result.reason ?? ''}`}</Notice>;
  }
  const board = result.boards.find(entry => entry.boardKey === result.placement?.boardKey);
  return (
    <Txt as="p" variant="body-sm" tone="ink">
      Goes to {board?.name ?? result.placement.boardKey} › {result.placement.phase}
    </Txt>
  );
}

/**
 * "Where would this go?": paste an issue or pull request URL, or open it on a recent item, and see
 * which board takes it and what every rule answered. Nothing is filed.
 */
export function IntakeTesterPanel({ factoryProjectId, itemId, draft }: IntakeTesterPanelProps) {
  const [url, setUrl] = useState('');
  const test = useIntakeTest(factoryProjectId);
  const { mutate } = test;

  useEffect(() => {
    // Re-test only when the item changes; a draft edit is tested by pressing Test.
    if (itemId) mutate({ ...draft, itemId });
  }, [itemId, mutate]);

  const submit = () => {
    const trimmed = url.trim();
    if (trimmed) mutate({ ...draft, url: trimmed });
  };
  const result = test.data;
  const ruleName = result ? ruleNamer(result) : null;

  return (
    <section aria-label="Where would this go?" className="flex flex-col gap-3">
      <Txt as="h3" variant="subheading">
        Where would this go?
      </Txt>
      <form
        className="flex items-center gap-2"
        onSubmit={event => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          aria-label="Issue or pull request URL"
          placeholder="Paste an issue or pull request URL"
          value={url}
          disabled={test.isPending}
          onChange={event => setUrl(event.target.value)}
        />
        <Button type="submit" variant="default" disabled={test.isPending || url.trim() === ''}>
          Test
        </Button>
      </form>
      <Txt as="p" variant="caption" tone="muted">
        Links from GitHub and GitLab repositories linked to this project are read once and never filed. For Linear, Jira
        and incident.io, pick a recent item instead.
      </Txt>
      {test.error && <Notice variant="destructive">{test.error.message}</Notice>}
      {result && ruleName && (
        <div className="flex flex-col gap-2">
          <Txt as="p" variant="body-sm" tone="ink">
            {result.item.url ? <a href={result.item.url}>{result.item.title}</a> : result.item.title}
          </Txt>
          <Verdict result={result} />
          <ul aria-label="What each rule answered" className="flex flex-col gap-1">
            {result.boards.flatMap(board =>
              board.rules.map(rule => (
                <li key={`${board.boardKey}:${rule.routeId}`}>
                  <Txt as="span" variant="caption" tone={rule.outcome === 'took' ? 'ink' : 'muted'}>
                    <code>{ruleName(board.boardKey, rule.routeId)}</code>: {ruleVerdictLabel(rule, ruleName)}
                  </Txt>
                </li>
              )),
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
