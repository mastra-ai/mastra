import type { ModelPack } from '@mastra/factory/model-packs';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { ModelPackTimeline } from '../../../settings/components/models/packs/ModelPackTimeline';

interface ModelPackSectionProps {
  packs: readonly ModelPack[];
  selectedPackId: string | undefined;
  defaultPackId: string | undefined;
  disabled: boolean;
  onPick: (pack: ModelPack) => void;
  renderProviderIcon: (provider: string) => ReactNode;
}

const DEFAULT_BADGE = 'Default';

export function ModelPackSection({
  packs,
  selectedPackId,
  defaultPackId,
  disabled,
  onPick,
  renderProviderIcon,
}: ModelPackSectionProps) {
  if (!packs.length) return null;
  return (
    <section aria-label="Packs" className="flex flex-col gap-1 px-1.5 py-1.5">
      <Txt as="h3" variant="caption" tone="muted" className="px-2">
        Packs
      </Txt>
      <ul className="flex max-h-48 flex-col overflow-y-auto overscroll-contain">
        {packs.map(pack => {
          const active = pack.id === selectedPackId;
          const badged = pack.id === defaultPackId && pack.name !== DEFAULT_BADGE;
          return (
            <li
              key={pack.id}
              className={cn(
                'text-muted-foreground relative flex flex-col gap-0.5 rounded-lg px-2 py-1.5',
                'hover:bg-fill hover:text-foreground has-focus-visible:bg-fill has-focus-visible:text-foreground',
                'has-disabled:pointer-events-none has-disabled:opacity-50',
                active && 'text-foreground',
              )}
            >
              <button
                type="button"
                aria-pressed={active}
                aria-label={pack.name}
                disabled={disabled}
                onClick={() => onPick(pack)}
                className="text-body-sm flex w-full items-center gap-2.5 text-left outline-none after:absolute after:inset-0 after:rounded-lg"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{pack.name}</span>
                  {badged ? (
                    <Badge variant="blue" size="xs">
                      {DEFAULT_BADGE}
                    </Badge>
                  ) : null}
                </span>
                {active ? <IconCheckmark2Medium aria-hidden className="ml-auto shrink-0" /> : null}
              </button>
              <div className="pointer-events-none">
                <ModelPackTimeline entries={pack.models} renderProviderIcon={renderProviderIcon} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
