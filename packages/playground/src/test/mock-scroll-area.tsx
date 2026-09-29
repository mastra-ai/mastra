/**
 * Stand-in for `@mastra/playground-ui/components/ScrollArea`: plain divs.
 * Base UI's ScrollArea measures in a requestAnimationFrame after mount, which jsdom can't measure and which
 * lands outside `act(...)`.
 *
 * Usage: `vi.mock('@mastra/playground-ui/components/ScrollArea', () => import('@/test/mock-scroll-area'));`
 */
import type { ScrollAreaProps } from '@mastra/playground-ui/components/ScrollArea';
import type { ComponentProps } from 'react';

type MockScrollAreaProps = ComponentProps<'div'> &
  Pick<
    ScrollAreaProps,
    'maxHeight' | 'autoScroll' | 'orientation' | 'scrollButtons' | 'mask' | 'showMask' | 'revealScrollbarOnHover'
  >;

export function ScrollArea({
  maxHeight: _maxHeight,
  autoScroll: _autoScroll,
  orientation: _orientation,
  scrollButtons: _scrollButtons,
  mask: _mask,
  showMask: _showMask,
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
