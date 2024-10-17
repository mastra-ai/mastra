import { VariantProps } from 'class-variance-authority';
import { InputHTMLAttributes } from 'react';
import React from 'react';

import { Icon } from '@/components/icon';

import { cn } from '@/lib/utils';

import { IconName } from '@/types/icons';

import { Input, inputVariants } from './input';

export interface InputWithIconProps extends InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof inputVariants> {
  icon?: IconName;
}

const InputWithIcon = React.forwardRef<HTMLInputElement, InputWithIconProps>(
  ({ icon, className, placeholder, ...rest }, ref) => (
    <div className="relative">
      {icon ? (
        <Icon
          name={icon}
          className="translate text-text-dim pointer-events-none absolute bottom-0 left-3 top-0 my-auto flex h-4 w-4 items-center opacity-50"
        />
      ) : null}
      <Input
        className={cn(icon ? 'pl-9' : '', className)}
        type="text"
        data-testid={`${rest.name}-input`}
        placeholder={placeholder}
        ref={ref}
        {...rest}
      />
    </div>
  ),
);

InputWithIcon.displayName = 'InputWithIcon';

export default InputWithIcon;
