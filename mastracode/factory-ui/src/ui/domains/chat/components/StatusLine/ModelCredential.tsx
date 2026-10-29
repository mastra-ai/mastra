import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Building2, KeyRound, Server, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ProviderBrandIcon } from '../../../workspaces/components/ProviderBrandIcon';
import { useChatModels } from '../../context/useChatModels';
import { useModelCredential } from '../../hooks/useModelCredential';
import type { CredentialHolder } from '../../hooks/useModelCredential';

const badgeShell = 'flex size-icon-sm items-center justify-center rounded-full border border-border bg-card';

function GlyphBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className={badgeShell}>
      <Icon className="size-2.5" />
    </span>
  );
}

export function HolderBadge({ holder }: { holder: CredentialHolder }) {
  if (holder.kind === 'organization') return <GlyphBadge icon={Building2} />;
  if (holder.kind === 'deployment') return <GlyphBadge icon={Server} />;
  if (!holder.name) return <GlyphBadge icon={User} />;
  return (
    <span className="[&>[data-slot=avatar]]:size-icon-sm flex">
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
        <ProviderBrandIcon provider={provider} fallback={<KeyRound className="size-3.5" />} />
        <span className="absolute -right-1 -bottom-1">
          <HolderBadge holder={holder} />
        </span>
      </TooltipTrigger>
      <TooltipContent className="grid gap-1">
        <span className="font-medium">{credential}</span>
        <span className="text-muted-foreground flex items-center gap-1.5">
          <HolderBadge holder={holder} />
          {holderDescription}
        </span>
        {warning ? <span className="text-warning-foreground">{warning}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
