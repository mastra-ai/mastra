import { twMerge } from 'tailwind-merge';

export const ToolApprovalClass = twMerge(
  'mastra:rounded-lg mastra:border mastra:border-border1 mastra:max-w-1/2 mastra:mt-2',
  'mastra:bg-surface3 mastra:text-text6',
);

export const ToolApproval = ({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) => {
  return <div className={className || ToolApprovalClass} {...props} />;
};

export const ToolApprovalTitleClass = twMerge('mastra:text-text6 mastra:inline-flex mastra:items-center mastra:gap-1');
export const ToolApprovalTitle = ({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) => {
  return <div className={className || ToolApprovalTitleClass} {...props} />;
};

export const ToolApprovalHeaderClass = twMerge(
  'mastra:flex mastra:justify-between mastra:items-center mastra:gap-2',
  'mastra:border-b mastra:border-border1 mastra:px-4 mastra:py-2',
);
export const ToolApprovalHeader = ({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) => {
  return <div className={className || ToolApprovalHeaderClass} {...props} />;
};

export const ToolApprovalContentClass = twMerge('mastra:text-text6 mastra:p-4');
export const ToolApprovalContent = ({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) => {
  return <div className={className || ToolApprovalContentClass} {...props} />;
};

export const ToolApprovalActionsClass = twMerge('mastra:flex mastra:gap-2 mastra:items-center');
export const ToolApprovalActions = ({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) => {
  return <div className={className || ToolApprovalActionsClass} {...props} />;
};
