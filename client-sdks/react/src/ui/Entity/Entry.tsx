import { ElementType } from 'react';

export const EntryClass = 'mastra:space-y-2';
export const Entry = ({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) => {
  return <div className={className || EntryClass} {...props} />;
};

type EntryTitleProps = React.ComponentPropsWithoutRef<'div'> & {
  as?: ElementType;
};

export const EntryTitleClass = 'mastra:font-mono mastra:text-sm mastra:text-text3';
export const EntryTitle = ({ className, as: Root = 'h3', ...props }: EntryTitleProps) => {
  return <Root className={className || EntryTitleClass} {...props} />;
};
