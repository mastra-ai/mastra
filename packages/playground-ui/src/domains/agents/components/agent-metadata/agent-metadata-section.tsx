import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { useLinkComponent } from '@/lib/framework';
import { InfoIcon } from 'lucide-react';

export interface AgentMetadataSectionProps {
  title: string;
  children: React.ReactNode;
  hint?: {
    link: string;
    title: string;
  };
}

export const AgentMetadataSection = ({ title, children, hint }: AgentMetadataSectionProps) => {
  const { Link } = useLinkComponent();
  return (
    <section className="space-y-2 pb-7 last:pb-0">
      <Txt as="h3" variant="ui-md" className="text-icon3 flex items-center gap-1">
        {title}
        {hint && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={hint.link} target="_blank" rel="noopener noreferrer">
                  <Icon className="text-icon3" size="sm">
                    <InfoIcon />
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
