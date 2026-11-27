import type { ReactNode } from 'react';

import { RELATED_ITEM_LINK_CLASS } from './board-layout';
import { Button } from '@/ds/components/Button';
import { Metadata } from '@/ds/components/Metadata';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export interface RelatedItemLinkProps {
  href: string;
  /** Source mark or change-request status icon, sized `size-3`. */
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  /** Read out in the tooltip, one part per line item. */
  tooltip: readonly string[];
  /** Marks a card with a running session. */
  live?: boolean;
  /** Opens upstream in a new tab instead of routing in the app. */
  external?: boolean;
  LinkComponent?: LinkComponent;
}

/** A related card or upstream item on a board card, with its relation in a tooltip. */
export function RelatedItemLink({
  href,
  icon,
  label,
  ariaLabel,
  tooltip,
  live = false,
  external = false,
  LinkComponent: Link = 'a',
}: RelatedItemLinkProps) {
  const content = (
    <>
      {icon}
      <Txt as="span" variant="meta" className="min-w-0 flex-1 truncate">
        {label}
      </Txt>
      {live && (
        <IconChatBubble7
          data-live-session-indicator
          className="size-icon-xs shrink-0 text-badge-green-indicator"
          aria-hidden
        />
      )}
    </>
  );
  const className = cn('text-muted-foreground', RELATED_ITEM_LINK_CLASS);
  const link = external ? (
    <a href={href} target="_blank" rel="noreferrer" draggable={false} aria-label={ariaLabel} className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} draggable={false} aria-label={ariaLabel} className={className}>
      {content}
    </Link>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="top" className="max-w-90">
        <Metadata>
          {tooltip.map((part, index) => (
            <Metadata.Item key={index}>{part}</Metadata.Item>
          ))}
        </Metadata>
      </TooltipContent>
    </Tooltip>
  );
}

export interface UpstreamLink {
  url: string;
  label: string;
  ariaLabel: string;
  icon: ReactNode;
}

/** Where a card lives upstream: its own issue or pull request, then each attached one. */
export function UpstreamLinks({ links }: { links: readonly UpstreamLink[] }) {
  return links.map(link => (
    <a
      key={link.url}
      href={link.url}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      aria-label={link.ariaLabel}
      className={cn('text-muted-foreground', RELATED_ITEM_LINK_CLASS)}
    >
      {link.icon}
      <Txt as="span" variant="meta" className="min-w-0 truncate">
        {link.label}
      </Txt>
    </a>
  ));
}

export interface RelatedCardLinkProps {
  href: string;
  icon: ReactNode;
  ariaLabel: string;
  reference?: string;
  title: string;
  /** The related card's current phase: its icon (already toned) and name. */
  phase?: { icon: ReactNode; label: string };
  LinkComponent?: LinkComponent;
}

/** A related card in the card overview: reference, title and the phase it sits in. */
export function RelatedCardLink({
  href,
  icon,
  ariaLabel,
  reference,
  title,
  phase,
  LinkComponent: Link = 'a',
}: RelatedCardLinkProps) {
  return (
    <Button
      icon={icon}
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      aria-label={ariaLabel}
      render={<Link href={href} />}
    >
      {reference === undefined ? null : (
        <Txt as="span" variant="caption" tone="muted" className="shrink-0">
          {reference}
        </Txt>
      )}
      <span className="min-w-0 truncate">{title}</span>
      {phase === undefined ? null : (
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {phase.icon}
          <Txt as="span" variant="caption" tone="muted">
            {phase.label}
          </Txt>
        </span>
      )}
    </Button>
  );
}
