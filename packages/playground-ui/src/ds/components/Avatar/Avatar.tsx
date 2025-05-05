import React, { ElementType, ReactNode } from 'react';

import { Txt } from '../Txt';

export interface AvatarProps {
  src?: string;
  name: string;
}

export const Avatar = ({ src, name }: AvatarProps) => {
  return (
    <div className="h-avatar-default w-avatar-default border-sm border-border1 bg-surface-3 shrink-0 overflow-hidden rounded-full">
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <Txt variant="ui-md" className="text-center">
          {name[0].toUpperCase()}
        </Txt>
      )}
    </div>
  );
};
