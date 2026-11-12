/**
 * Stand-in for `@/ds/components/ScrollArea`: plain divs.
 * Base UI's ScrollArea measures in a requestAnimationFrame after mount, which jsdom can't measure and which
 * lands outside `act(...)`.
 *
 * Usage: `vi.mock('@/ds/components/ScrollArea', () => import('@/test/mock-scroll-area'));`
 */
import type { ComponentProps } from 'react';
import type { ScrollAreaProps } from '@/ds/components/ScrollArea';

type MockScrollAreaProps = ComponentProps<'div'> &
  Pick<
    ScrollAreaProps,
    'maxHeight' | 'autoScroll' | 'orientation' | 'scrollButtons' | 'mask' | 'revealScrollbarOnHover'
  >;

export function ScrollArea({
  maxHeight: _maxHeight,
  autoScroll: _autoScroll,
  orientation: _orientation,
  scrollButtons: _scrollButtons,
  mask: _mask,
  revealScrollbarOnHover: _revealScrollbarOnHover,
  ...props
}: MockScrollAreaProps) {
  return <div data-testid="scroll-area" {...props} />;
}

export function ScrollAreaViewport({
  ref,
  className,
  children,
}: Pick<ComponentProps<'div'>, 'ref' | 'className' | 'children'>) {
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
