import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

/** One item no board took: where it came from, why, and when, with Why? and, for editors, Route again. */
export function NotRoutedItem({
  item,
  icon,
  source,
  routing,
  onWhy,
  onRouteAgain,
}: {
  item: { title: string; url: string | null; reason: string | null; decidedAt: string };
  /** The mark of the provider it came from, when known. */
  icon?: ReactNode;
  /** Where it came from, without the provider, such as `acme/app#1`. */
  source?: string;
  /** Route again is running for this item. */
  routing: boolean;
  onWhy: () => void;
  /** Unset when the caller can't route items again. */
  onRouteAgain?: () => void;
}) {
  return (
    <li className="flex items-center gap-2 border-t border-border py-2">
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" variant="body-sm" tone="ink" className="truncate">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </Txt>
        <Txt as="span" variant="caption" tone="muted" className="flex min-w-0 gap-1.5">
          {source && <span className="truncate">{source}</span>}
          <span className="truncate">{item.reason ?? 'No board’s rules match it.'}</span>
          <time dateTime={item.decidedAt} className="shrink-0">
            {new Date(item.decidedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </time>
        </Txt>
      </span>
      <Button size="sm" variant="ghost" onClick={onWhy}>
        Why?
      </Button>
      {onRouteAgain && (
        <Button
          size="sm"
          variant="ghost"
          tooltip="Change a board’s rules, then route it again."
          onClick={onRouteAgain}
          loading={routing}
        >
          Route again
        </Button>
      )}
    </li>
  );
}
