import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { InfoIcon } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';

const sectionAccentClasses = {
  amber: '[--section-accent:var(--accent6)]',
  blue: '[--section-accent:var(--badge-blue)]',
  cyan: '[--section-accent:var(--badge-cyan)]',
  green: '[--section-accent:var(--badge-green)]',
  orange: '[--section-accent:var(--badge-orange)]',
  pink: '[--section-accent:var(--badge-pink)]',
  purple: '[--section-accent:var(--badge-purple)]',
};

export interface AgentMetadataSectionProps {
  title: string;
  count?: number;
  accent: keyof typeof sectionAccentClasses;
  icon?: React.ReactNode;
  children: React.ReactNode;
  hint?: {
    link: string;
    title: string;
    icon?: React.ReactNode;
  };
}

export const AgentMetadataSection = ({ title, count, accent, icon, children, hint }: AgentMetadataSectionProps) => {
  const { Link } = useLinkComponent();
  return (
    <section className={`space-y-2 pb-6 last:pb-0 ${sectionAccentClasses[accent]}`}>
      <Txt as="h3" variant="ui-smd" className="text-neutral5 flex items-center gap-2 font-medium">
        {icon && (
          <Icon aria-hidden="true" className="text-(--section-accent) shrink-0">
            {icon}
          </Icon>
        )}
        <span className="flex items-center gap-1.5">
          <span className="from-(--section-accent) to-neutral5 bg-linear-to-r bg-clip-text text-transparent forced-colors:bg-none forced-colors:text-inherit">
            {title}
          </span>
          {count !== undefined && (
            <Txt as="span" variant="caption" className="font-normal tabular-nums">
              {count}
            </Txt>
          )}
        </span>
        {hint && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={hint.link} aria-label={hint.title} target="_blank" rel="noopener noreferrer">
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
      {children}
    </section>
  );
};
