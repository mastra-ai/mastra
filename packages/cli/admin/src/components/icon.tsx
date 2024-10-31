/* eslint-disable check-file/filename-naming-convention */
import { forwardRef, type SVGProps } from 'react';

import { cn } from '@/lib/utils';

import { type IconName } from '@/types/icons';

export const Icon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement> & { name: IconName }>(
  ({ name, className, ...props }, ref) => {
    return (
      <svg className={cn('h-4 w-4', className)} {...props} ref={ref}>
        <use href={`/icons/sprite.svg#${name}`} />
      </svg>
    );
  },
);

Icon.displayName = 'Icon';

export default Icon;
