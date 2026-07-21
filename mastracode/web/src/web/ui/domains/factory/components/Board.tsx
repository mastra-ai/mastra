import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';

export interface BoardCard {
  id: string;
  title: string;
  url?: string;
  meta?: string;
  action?: ReactNode;
}

export interface BoardColumn {
  id: string;
  title: string;
  cards: BoardCard[];
  emptyLabel: string;
  footer?: ReactNode;
}

export function Board({ columns, error }: { columns: BoardColumn[]; error?: string }) {
  if (error) return <Notice variant="destructive">{error}</Notice>;

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2" aria-label="Factory board">
      {columns.map(column => (
        <section key={column.id} className="flex min-h-72 w-80 shrink-0 flex-col rounded-lg border border-border1 bg-surface2">
          <header className="flex items-center justify-between border-b border-border1 px-3 py-2">
            <h2 className="m-0 text-ui-sm font-medium text-icon6">{column.title}</h2>
            <span className="text-ui-xs text-icon3">{column.cards.length}</span>
          </header>
          <div className="flex flex-1 flex-col gap-2 p-2">
            {column.cards.length === 0 ? (
              <p className="m-2 text-ui-sm text-icon3">{column.emptyLabel}</p>
            ) : (
              column.cards.map(card => (
                <article key={card.id} className="rounded-md border border-border1 bg-surface1 p-3">
                  {card.url ? (
                    <a className="text-ui-sm font-medium text-icon6 hover:underline" href={card.url} target="_blank" rel="noreferrer">
                      {card.title}
                    </a>
                  ) : (
                    <h3 className="m-0 text-ui-sm font-medium text-icon6">{card.title}</h3>
                  )}
                  {card.meta ? <p className="mb-0 mt-1 text-ui-xs text-icon3">{card.meta}</p> : null}
                  {card.action ? <div className="mt-3">{card.action}</div> : null}
                </article>
              ))
            )}
          </div>
          {column.footer ? <div className="border-t border-border1 p-2">{column.footer}</div> : null}
        </section>
      ))}
    </div>
  );
}

export function LoadMoreButton({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <Button variant="ghost" size="sm" className="w-full" onClick={onClick} disabled={pending}>
      {pending ? 'Loading…' : 'Load more'}
    </Button>
  );
}
