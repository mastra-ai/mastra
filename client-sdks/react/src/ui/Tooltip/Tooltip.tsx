import {
  TooltipTrigger as RTooltipTrigger,
  TooltipProvider as RTooltipProvider,
  Root as RTooltipRoot,
  TooltipPortal as RTooltipPortal,
  TooltipContent as RTooltipContent,
  TooltipTriggerProps,
  TooltipContentProps,
} from '@radix-ui/react-tooltip';

export interface TooltipProps extends React.ComponentPropsWithoutRef<'div'> {
  children: React.ReactNode;
}

export const Tooltip = ({ children }: TooltipProps) => {
  return (
    <RTooltipProvider>
      <RTooltipRoot>{children}</RTooltipRoot>
    </RTooltipProvider>
  );
};

export const TooltipContentClass =
  'mastra:bg-surface4 mastra:text-text6 mastra mastra:rounded-lg mastra:py-1 mastra:px-2 mastra:text-xs mastra:border mastra:border-border1 mastra-tooltip-enter';
export const TooltipContent = ({ children, className, ...props }: TooltipContentProps) => {
  return (
    <RTooltipPortal>
      <RTooltipContent className={className || TooltipContentClass} {...props}>
        {children}
      </RTooltipContent>
    </RTooltipPortal>
  );
};

export const TooltipTrigger = (props: TooltipTriggerProps) => {
  return <RTooltipTrigger {...props} asChild />;
};
