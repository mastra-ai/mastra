import type { ModelPack } from '@mastra/factory/model-packs';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useId } from 'react';

import { modelPackChain } from '../../services/modelPacks';

interface ModelPackSectionProps {
  packs: readonly ModelPack[];
  activePackId: string | undefined;
  defaultPackId: string | null;
  pendingPackId: string | undefined;
  disabled: boolean;
  onPick: (pack: ModelPack) => void;
}

export function ModelPackSection({
  packs,
  activePackId,
  defaultPackId,
  pendingPackId,
  disabled,
  onPick,
}: ModelPackSectionProps) {
  const chainId = useId();
  if (!packs.length) return null;
  return (
    <section aria-label="Packs" className="flex flex-col gap-1 px-1.5 py-1.5">
      <Txt as="h3" variant="caption" tone="muted" className="px-2">
        Packs
      </Txt>
      <ul className="flex flex-col">
        {packs.map(pack => {
          const active = pack.id === (pendingPackId ?? activePackId);
          return (
            <li key={pack.id}>
              <button
                type="button"
                aria-pressed={active}
                aria-label={pack.name}
                aria-describedby={`${chainId}-${pack.id}`}
                disabled={disabled}
                onClick={() => onPick(pack)}
                className={cn(
                  'text-body-sm text-muted-foreground flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left',
                  'hover:bg-fill hover:text-foreground focus-visible:bg-fill focus-visible:text-foreground outline-none',
                  'disabled:pointer-events-none disabled:opacity-50',
                  active && 'text-foreground',
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{pack.name}</span>
                    {pack.id === defaultPackId ? (
                      <Badge variant="blue" size="xs">
                        Default
                      </Badge>
                    ) : null}
                  </span>
                  <span id={`${chainId}-${pack.id}`} className="text-caption text-muted-foreground truncate">
                    {modelPackChain(pack)}
                  </span>
                </span>
                {active ? <IconCheckmark2Medium aria-hidden className="ml-auto shrink-0" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
