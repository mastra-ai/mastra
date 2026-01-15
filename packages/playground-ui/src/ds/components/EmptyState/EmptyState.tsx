import React, { ElementType, ReactNode } from 'react';

import { Txt } from '../Txt';

export interface EmptyStateProps {
  as?: ElementType;
  iconSlot: ReactNode;
  titleSlot: ReactNode;
  descriptionSlot: ReactNode;
  actionSlot: ReactNode;
}

export const EmptyState = ({
  iconSlot,
  titleSlot,
  descriptionSlot,
  actionSlot,
  as: Component = 'div',
}: EmptyStateProps) => {
  return (
    <div className="flex w-[340px] flex-col items-center justify-center text-center">
      <div className="h-auto [&>svg]:w-[126px]">{iconSlot}</div>
      <Component className="text-neutral6 pt-8 font-serif text-header-xl font-semibold">{titleSlot}</Component>

      <Txt variant="ui-lg" className="text-neutral3 pb-8">
        {descriptionSlot}
      </Txt>

      {actionSlot}
    </div>
  );
};
