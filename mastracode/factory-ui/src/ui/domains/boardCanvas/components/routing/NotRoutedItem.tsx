import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { IntakeDecisionInfo } from '../../../../../api/types';
import { isIntakeProvider } from '../../../factory/boardSourceFilters';
import type { IntakeProvider } from '../../../factory/boardSourceFilters';
import { SettingsIntegrationIcon } from '../../../settings/components/brand-icons/SettingsIntegrationIcon';

/** One item no board took: where it came from, why, and when, with Why? and, for editors, Route again. */
export function NotRoutedItem({
  item,
  routing,
  onWhy,
  onRouteAgain,
}: {
  item: IntakeDecisionInfo;
  /** Route again is running for this item. */
  routing: boolean;
  onWhy: () => void;
  /** Unset when the caller can't route items again. */
  onRouteAgain?: () => void;
}) {
  const { provider, source } = sourceParts(item.sourceKey);
  return (
    <li className="border-border flex items-center gap-2 border-t py-2">
      {provider && <SettingsIntegrationIcon provider={provider} className="size-icon-xs" />}
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
          {item.reason && <span className="truncate">{item.reason}</span>}
          <time dateTime={item.decidedAt} className="shrink-0">
            {new Date(item.decidedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </time>
        </Txt>
      </span>
      <Button size="sm" variant="ghost" onClick={onWhy}>
        Why?
      </Button>
      {onRouteAgain && (
        <Button size="sm" variant="ghost" onClick={onRouteAgain} loading={routing}>
          Route again
        </Button>
      )}
    </li>
  );
}

/** Splits `github:acme/app#1` into the provider, for its mark, and the rest, to show. */
function sourceParts(sourceKey: string | null | undefined): { provider?: IntakeProvider; source?: string } {
  if (!sourceKey) return {};
  const colon = sourceKey.indexOf(':');
  const prefix = sourceKey.slice(0, colon);
  if (colon < 0 || !isIntakeProvider(prefix)) return { source: sourceKey };
  return { provider: prefix, source: sourceKey.slice(colon + 1) };
}
