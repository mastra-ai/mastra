import React from 'react';

export interface IconProps extends React.ComponentPropsWithoutRef<'div'> {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const IconSizes = {
  sm: 'mastra:[&>svg]:size-3',
  md: 'mastra:[&>svg]:size-4',
  lg: 'mastra:[&>svg]:size-5',
};

export const Icon = ({ children, className, size = 'md', ...props }: IconProps) => {
  return (
    <div className={className || IconSizes[size]} {...props}>
      {children}
    </div>
  );
};
