import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip/Tooltip';
import { Icon, IconProps } from '../Icon/Icon';
import { twMerge } from 'tailwind-merge';

export interface IconButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  children: React.ReactNode;
  tooltip: React.ReactNode;
  size?: IconProps['size'];
}

export const IconButtonClass =
  'mastra:text-text3 mastra:hover:text-text6 mastra:active:text-text6 mastra:hover:bg-surface4 mastra:active:bg-surface5 mastra:rounded-md mastra:cursor-pointer';

export const IconButton = ({ children, tooltip, size = 'md', className, ...props }: IconButtonProps) => {
  return (
    <Tooltip>
      <TooltipTrigger>
        <button
          {...props}
          className={
            className || twMerge(IconButtonClass, size === 'md' && 'mastra:p-0.5', size === 'lg' && 'mastra:p-1')
          }
        >
          <Icon size={size}>{children}</Icon>
        </button>
      </TooltipTrigger>

      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
};
