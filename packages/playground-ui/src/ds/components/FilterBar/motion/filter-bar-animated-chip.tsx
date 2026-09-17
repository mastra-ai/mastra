import { useIsPresent, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import type { Ref } from 'react';
import { FilterBarChip } from '../filter-bar-chip';
import type { FilterBarItem } from '../types';
import { filterEnter, filterExit, filterTransition, filterVisible } from './transitions';

export function FilterBarAnimatedChip({ item, ref }: { item: FilterBarItem; ref?: Ref<HTMLDivElement> }) {
  const isPresent = useIsPresent();
  const reduceMotion = useReducedMotion();

  return (
    <m.div
      ref={ref}
      layout="position"
      initial={reduceMotion ? false : filterEnter}
      animate={filterVisible}
      exit={reduceMotion ? { opacity: 0 } : filterExit}
      transition={filterTransition}
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
      className="max-w-full"
    >
      <FilterBarChip item={item} />
    </m.div>
  );
}
