import type { ReactNode } from 'react';
import { BoardAnswers } from './intake-board-answers';
import type { IntakeTestResultInfo } from './types';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { IconCircleDashed } from '@/ds/icons/central/IconCircleDashed';
import { IconPencil } from '@/ds/icons/central/IconPencil';
import { GithubIcon } from '@/ds/icons/GithubIcon';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

const KIND_LABEL: Record<IntakeTestResultInfo['item']['kind'], string> = {
  card: 'Card',
  not_routed: 'Not routed item',
  fetched: 'Read from its source, not filed',
};

/** `github.com/mastra-ai/mastra/issues/12` → `mastra-ai/mastra #12`; anything else as its host and path. */
function itemSource(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    const parts = pathname.split('/').filter(Boolean);
    if (host === 'github.com' && parts.length >= 4) return `${parts[0]}/${parts[1]} #${parts[3]}`;
    return `${host}${pathname}`;
  } catch {
    return url;
  }
}

/** Where an intake test says the item would go: which board takes it, what every rule answered, and its card's moves. */
export function IntakeTestResult({
  result,
  boardId,
  close,
  LinkComponent,
  onEditRule,
}: {
  result: IntakeTestResultInfo;
  /** The board on the canvas, marked current. */
  boardId: string;
  /** The panel's close button, in the header. */
  close: ReactNode;
  LinkComponent: LinkComponent;
  onEditRule: (routeId: string) => void;
}) {
  const { item, placement, card } = result;

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Txt as="p" variant="body-sm" tone="muted" className="flex min-w-0 items-center gap-2">
            {item.url?.startsWith('https://github.com/') && (
              <GithubIcon className="size-icon-sm shrink-0" aria-hidden />
            )}
            <span className="truncate">{item.url ? itemSource(item.url) : KIND_LABEL[item.kind]}</span>
          </Txt>
          {close}
        </div>
        <Txt as="h2" variant="card-title-strong">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </Txt>
        {item.url && (
          <Txt as="p" variant="caption" tone="muted">
            {KIND_LABEL[item.kind]}
          </Txt>
        )}
      </header>

      {placement ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-fill px-4 py-3">
          <IconCircleDashed className="size-icon-sm shrink-0" aria-hidden />
          <Txt as="p" variant="body-sm" tone="ink">
            Goes to {placement.place}
          </Txt>
        </div>
      ) : (
        <Notice variant="warning">{`Not routed. ${result.reason ?? ''}`}</Notice>
      )}
      {result.legacyEvaluator && (
        <Notice variant="info">
          This project still files new issues and pull requests with the old route list, so filing may differ from this
          answer until it switches to intake order.
        </Notice>
      )}
      {result.note && (
        <Txt as="p" variant="caption" tone="muted">
          {result.note}
        </Txt>
      )}

      <BoardAnswers boards={result.boards} boardId={boardId} onEditRule={onEditRule} />

      {card && (
        <section aria-label="Its card" className="flex flex-col gap-2">
          <div className="flex justify-between gap-2">
            <Txt as="h3" variant="body-sm" tone="muted">
              Its card
            </Txt>
            <Txt as="span" variant="body-sm" tone="muted">
              {card.place}
            </Txt>
          </div>
          {card.moves.length > 0 && (
            <>
              <ul aria-label="Card moves" className="flex flex-col gap-2">
                {card.moves.map(move => (
                  <li key={move.key} className="flex flex-col gap-1">
                    <div className="flex flex-col rounded-2xl bg-fill px-3 py-2.5">
                      <Txt as="span" variant="body-sm" tone="ink">
                        {move.event}
                      </Txt>
                      <Txt as="span" variant="caption" tone="muted">
                        {move.verdict}
                      </Txt>
                    </div>
                    {move.rules.map(rule => (
                      <div
                        key={rule.routeId}
                        className={cn(
                          'flex items-start gap-2 rounded-xl px-3 py-2',
                          rule.outcome === 'took' && 'bg-fill',
                        )}
                      >
                        <div className="flex min-w-0 flex-1 flex-col">
                          <Txt as="span" variant="body-sm" tone={rule.outcome === 'took' ? 'ink' : 'muted'}>
                            {rule.name}
                          </Txt>
                          <Txt as="span" variant="caption" tone="muted">
                            {rule.verdict}
                          </Txt>
                        </div>
                        {(rule.outcome === 'took' || rule.outcome === 'lost') && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            tooltip="Edit rule"
                            aria-label={`Edit ${rule.name}`}
                            onClick={() => onEditRule(rule.routeId)}
                          >
                            <IconPencil />
                          </Button>
                        )}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
              <Txt as="p" variant="caption" tone="muted">
                Replays run against the card's current phase and facts.
              </Txt>
            </>
          )}
        </section>
      )}

      {placement && (
        <Button
          variant="subtle"
          render={<LinkComponent href={placement.boardHref} />}
          iconEnd={<IconArrowUpRight />}
          className="self-start"
        >
          {`Open ${placement.boardName}`}
        </Button>
      )}
    </>
  );
}
