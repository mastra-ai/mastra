import { FilterBarChip, fieldSegmentAccentStyle } from '../filter-bar-chip';
import { useFilterBarContext } from '../filter-bar-context';
import styles from './filter-bar-animation.module.css';
import { cn } from '@/lib/utils';

export function FilterBarAnimatedChips() {
  const { items, getField, animation } = useFilterBarContext();

  return (
    <>
      {items.map(item => (
        <div
          key={item.id}
          ref={element => {
            animation.register(`chip:${item.id}`, element);
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
    </>
  );
}
