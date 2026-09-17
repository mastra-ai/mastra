import { FilterBarChip, fieldSegmentAccentStyle } from '../filter-bar-chip';
import { useFilterBarContext } from '../filter-bar-context';
import styles from './filter-bar-animation.module.css';
import { useFilterChipLayout } from './use-filter-chip-layout';
import { cn } from '@/lib/utils';

export function FilterBarAnimatedChips() {
  const { items, getField } = useFilterBarContext();
  const { chipElements, exitLayerRef } = useFilterChipLayout(items);

  return (
    <>
      {items.map(item => (
        <div
          key={item.id}
          ref={element => {
            if (element) chipElements.current.set(item.id, element);
            else chipElements.current.delete(item.id);
          }}
          className={cn('max-w-full', styles.chip)}
          style={fieldSegmentAccentStyle(getField(item.fieldId))}
          onAnimationEnd={event => {
            if (event.target === event.currentTarget) event.currentTarget.removeAttribute('data-activated');
          }}
        >
          <FilterBarChip item={item} />
        </div>
      ))}
      <div
        ref={exitLayerRef}
        inert
        aria-hidden
        className={cn('pointer-events-none absolute inset-0', styles.exitLayer)}
      />
    </>
  );
}
