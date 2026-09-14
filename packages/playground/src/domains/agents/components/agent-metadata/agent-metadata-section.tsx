import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { InfoIcon } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';

export interface AgentMetadataSectionProps {
  title: string | React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  hint?: {
    link: string;
    title: string;
    icon?: React.ReactNode;
  };
}

export const AgentMetadataSection = ({ title, icon, children, hint }: AgentMetadataSectionProps) => {
  const { Link } = useLinkComponent();
  return (
    <section className="space-y-2 pb-6 last:pb-0">
      <Txt as="h3" variant="ui-smd" className="text-neutral5 flex items-center gap-2 font-medium">
        {icon && (
          <Icon aria-hidden="true" className="text-neutral3 shrink-0">
            {icon}
          </Icon>
        )}
        {title}
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
