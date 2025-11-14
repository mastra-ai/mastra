import { ElementType, useState } from 'react';
import { EntityProvider, useEntity } from './context';
import { Icon } from '../Icon/Icon';
import { ChevronDownIcon } from 'lucide-react';

import { twMerge } from 'tailwind-merge';
import { EntityVariant } from './types';

export interface EntityProps extends React.ComponentPropsWithoutRef<'div'> {
  variant?: EntityVariant;
  initialExpanded?: boolean;
  disabled?: boolean;
}

export const Entity = ({
  className,
  variant = 'initial',
  initialExpanded = false,
  disabled = false,
  ...props
}: EntityProps) => {
  const [expanded, setExpanded] = useState(initialExpanded);

  return (
    <EntityProvider value={{ expanded, setExpanded, variant, disabled }}>
      <div className={className} {...props} />
    </EntityProvider>
  );
};

export const EntityTriggerClass = twMerge(
  'mastra:aria-disabled:cursor-not-allowed mastra:aria-disabled:bg-surface5 mastra:aria-disabled:text-text3',
  'mastra:aria-expanded:rounded-b-none mastra:aria-expanded:border-b-0',
  'mastra:bg-surface3 mastra:text-text6 mastra:hover:bg-surface4 mastra:active:bg-surface5',
  'mastra:rounded-lg mastra:py-2 mastra:px-4 mastra:border mastra:border-border1',
  'mastra:cursor-pointer mastra:inline-flex mastra:items-center mastra:gap-1 mastra:font-mono',
);

export const EntityTriggerVariantClasses: Record<EntityVariant, string> = {
  agent: 'mastra:[&_svg.mastra-icon]:text-accent1',
  workflow: 'mastra:[&_svg.mastra-icon]:text-accent3',
  tool: 'mastra:[&_svg.mastra-icon]:text-accent6',
  memory: 'mastra:[&_svg.mastra-icon]:text-accent2',
  initial: 'mastra:[&_svg.mastra-icon]:text-text3',
};

export const EntityTrigger = ({ className, children, ...props }: React.ComponentPropsWithoutRef<'button'>) => {
  const { expanded, setExpanded, variant, disabled } = useEntity();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    setExpanded(!expanded);
    props?.onClick?.(e);
  };

  return (
    <button
      className={className || twMerge(EntityTriggerClass, !disabled && EntityTriggerVariantClasses[variant])}
      {...props}
      onClick={handleClick}
      aria-expanded={expanded}
      aria-disabled={disabled}
    >
      {children}
    </button>
  );
};

export const EntityContentClass = twMerge(
  'mastra:space-y-4',
  'mastra:rounded-lg mastra:rounded-tl-none mastra:p-4 mastra:border mastra:border-border1 mastra:-mt-[0.5px]',
  'mastra:bg-surface3 mastra:text-text6',
);

export const EntityContent = ({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) => {
  const { expanded } = useEntity();

  if (!expanded) return null;

  return <div className={className || EntityContentClass} {...props} />;
};

export const EntityCaret = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
  const { expanded } = useEntity();

  return (
    <Icon>
      <ChevronDownIcon
        className={twMerge(
          `mastra:text-text3 mastra:transition-transform mastra:duration-200 mastra:ease-in-out`,
          expanded ? 'mastra:rotate-0' : 'mastra:-rotate-90',
          className,
        )}
        {...props}
      />
    </Icon>
  );
};
