import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { cn } from '@mastra/playground-ui/utils/cn';
import { InfoIcon } from 'lucide-react';

const sectionAccentIcon = {
  amber: 'text-badge-amber-indicator',
  blue: 'text-badge-blue-indicator',
  cyan: 'text-badge-cyan-indicator',
  green: 'text-badge-green-indicator',
  orange: 'text-badge-orange-indicator',
  pink: 'text-badge-pink-indicator',
  purple: 'text-badge-purple-indicator',
};

export interface AgentMetadataSectionProps {
  title: string;
  count?: number;
  accent: keyof typeof sectionAccentIcon;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  hint?: {
    link: string;
    title: string;
    icon?: React.ReactNode;
  };
}

export const AgentMetadataSection = ({
  title,
  count,
  accent,
  icon,
  actions,
  children,
  hint,
}: AgentMetadataSectionProps) => {
  const { Link } = useLinkComponent();
  return (
    <section className="group/metadata grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 p-4">
      <header className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 group-has-[[data-slot=metadata-empty]]/metadata:col-span-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="flex min-w-0 items-center gap-2 text-foreground">
            {icon && (
              <Icon aria-hidden="true" className={cn('shrink-0', sectionAccentIcon[accent])}>
                {icon}
              </Icon>
            )}
            <span className="flex min-w-0 items-center gap-1.5">
              <Txt as="span" variant="label">
                {title}
              </Txt>
              {count !== undefined && count > 0 && (
                <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
                  {count}
                </Txt>
              )}
            </span>
          </h3>
          {hint && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={hint.link}
                    aria-label={hint.title}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 group-focus-within/metadata:opacity-100 group-hover/metadata:opacity-100 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:justify-center pointer-coarse:opacity-100"
                  >
                    <Icon className="text-muted-foreground" size="xs">
                      {hint.icon || <InfoIcon />}
                    </Icon>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{hint.title}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      <div className="col-span-2 min-w-0 group-has-[[data-slot=metadata-empty]]/metadata:col-span-1">{children}</div>
    </section>
  );
};
