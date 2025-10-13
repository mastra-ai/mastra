import { twMerge } from 'tailwind-merge';
import { StepMetadataType } from '../types';
import { Clock, Columns2, GitBranch, Infinity as InfinityIcon } from 'lucide-react';
import { Icon } from '@/ui/Icon';

export interface StepMetadataProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: StepMetadataType;
}

export const StepMetadataBackgrounds: Record<StepMetadataType, string> = {
  conditional: 'mastra:bg-accent6',
  parallel: 'mastra:bg-accent6',
  waitForEvent: 'mastra:bg-accent6',
  loop: 'mastra:bg-accent6',
  foreach: 'mastra:bg-accent6',
};

export const StepMetadataIcons: Record<StepMetadataType, React.ReactNode> = {
  conditional: <GitBranch />,
  parallel: <Columns2 />,
  waitForEvent: <Clock />,
  loop: <InfinityIcon />,
  foreach: <InfinityIcon />,
};

export const StepMetadataClass = 'mastra:relative mastra:text-xs mastra:p-0.5 mastra:rounded-xl mastra:rounded-tl-none';
export const StepMetadata = ({ type, className, children, ...props }: StepMetadataProps) => {
  if (!type) return <>{children}</>;
  const icon = StepMetadataIcons[type];

  return (
    <div className={className || twMerge(StepMetadataClass, StepMetadataBackgrounds[type])} {...props}>
      <div className="mastra:flex mastra:gap-1 mastra:items-center mastra:text-surface2 mastra:font-mono mastra:absolute mastra:top-0 mastra:left-0 mastra:bg-accent6 mastra:rounded-t-md mastra:px-2 mastra:py-0.5 mastra:-translate-y-full mastra:text-[10px]">
        <Icon size="sm">{icon}</Icon>
        {type}
      </div>

      {children}
    </div>
  );
};
