import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { InfoIcon } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';

const sectionAccentClasses = {
  amber: '[--section-accent:var(--badge-yellow-fg)]',
  blue: '[--section-accent:var(--badge-blue-fg)]',
  cyan: '[--section-accent:var(--badge-cyan-fg)]',
  green: '[--section-accent:var(--badge-green-fg)]',
  orange: '[--section-accent:var(--badge-orange-fg)]',
  pink: '[--section-accent:var(--badge-pink-fg)]',
  purple: '[--section-accent:var(--badge-purple-fg)]',
};

export interface AgentMetadataSectionProps {
  title: string;
  count?: number;
  accent: keyof typeof sectionAccentClasses;
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
    <section
      className={cn(
        'group/metadata grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 p-4',
        sectionAccentClasses[accent],
      )}
    >
      <header className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 group-has-[[data-slot=metadata-empty]]/metadata:col-span-1">
        <Txt as="h3" variant="ui-smd" className="text-neutral5 flex min-w-0 items-center gap-2 font-medium">
          {icon && (
            <Icon aria-hidden="true" className="shrink-0 text-(--section-accent)">
              {icon}
            </Icon>
          )}
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="text-(--section-accent)">{title}</span>
            {count !== undefined && count > 0 && (
              <Txt as="span" variant="caption" className="font-normal tabular-nums">
                {count}
              </Txt>
            )}
          </span>
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
                    <Icon className="text-neutral3" size="sm">
                      {hint.icon || <InfoIcon />}
                    </Icon>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{hint.title}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </Txt>
        {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      <div className="col-span-2 min-w-0 group-has-[[data-slot=metadata-empty]]/metadata:col-span-1">{children}</div>
    </section>
  );
};
