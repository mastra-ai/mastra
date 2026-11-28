import type { LucideIcon } from 'lucide-react';
import { useChatModels } from '../../context/useChatModels';
import { useModelCredential } from '../../hooks/useModelCredential';
import type { CredentialHolder } from '../../hooks/useModelCredential';
import { ProviderBrandIcon } from '@/domains/factory';

import { Avatar } from '@/ds/components/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { IconBuildings } from '@/ds/icons/central/IconBuildings';
import { IconKey2 } from '@/ds/icons/central/IconKey2';
import { IconServer } from '@/ds/icons/central/IconServer';
import { IconUser } from '@/ds/icons/central/IconUser';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

const badgeShell = 'flex size-icon-sm items-center justify-center rounded-full border border-border bg-card';

function GlyphBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className={badgeShell}>
      <Icon className="size-2.5" />
    </span>
  );
}

export function HolderBadge({ holder }: { holder: CredentialHolder }) {
  if (holder.kind === 'organization') return <GlyphBadge icon={IconBuildings} />;
  if (holder.kind === 'deployment') return <GlyphBadge icon={IconServer} />;
  if (!holder.name) return <GlyphBadge icon={IconUser} />;
  return (
    <span className="flex [&>[data-slot=avatar]]:size-icon-sm">
      <Avatar name={holder.name} src={holder.avatarUrl} size="xs" />
    </span>
  );
}

export function ModelCredential() {
  const { activeModelId } = useChatModels();
  const modelCredential = useModelCredential(activeModelId);
  if (!modelCredential) return null;
  const { provider, credential, holder, holderDescription, warning } = modelCredential;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={[credential, holderDescription, warning].filter(Boolean).join('. ')}
            className={cn(
              'relative flex size-avatar-sm shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground',
              focusRing,
            )}
          />
        }
      >
        <ProviderBrandIcon provider={provider} fallback={<IconKey2 className="size-icon-sm" />} />
        <span className="absolute -right-1 -bottom-1">
          <HolderBadge holder={holder} />
        </span>
      </TooltipTrigger>
      <TooltipContent className="grid gap-1">
        <span className="font-medium">{credential}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <HolderBadge holder={holder} />
          {holderDescription}
        </span>
        {warning ? <span className="text-warning-foreground">{warning}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
