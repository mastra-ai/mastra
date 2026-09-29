/**
 * Stand-in for `@mastra/playground-ui/components/ScrollArea`: plain divs with the same viewport contract.
 * Base UI's ScrollArea measures in a requestAnimationFrame after mount, which jsdom can't measure and which
 * lands outside `act(...)`.
 *
 * Usage: `vi.mock('@mastra/playground-ui/components/ScrollArea', () => import('@/test/mock-scroll-area'));`
 */
import type { ScrollAreaProps, ScrollAreaViewportProps } from '@mastra/playground-ui/components/ScrollArea';
import { Children, createContext, isValidElement, use } from 'react';
import type { ComponentProps, Ref } from 'react';

type MockScrollAreaProps = ComponentProps<'div'> &
  Pick<
    ScrollAreaProps,
    | 'maxHeight'
    | 'autoScroll'
    | 'orientation'
    | 'scrollButtons'
    | 'mask'
    | 'showMask'
    | 'revealScrollbarOnHover'
    | 'viewportRef'
  >;

const ViewportRefContext = createContext<Ref<HTMLDivElement> | undefined>(undefined);

export function ScrollAreaViewport({ className, children }: ScrollAreaViewportProps) {
  return (
    <div ref={use(ViewportRefContext)} className={className}>
      {children}
    </div>
  );
}

export function ScrollArea({
  children,
  viewportRef,
  maxHeight: _maxHeight,
  autoScroll: _autoScroll,
  orientation: _orientation,
  scrollButtons: _scrollButtons,
  mask: _mask,
  showMask: _showMask,
  revealScrollbarOnHover: _revealScrollbarOnHover,
  ...props
}: MockScrollAreaProps) {
  const callerRendersViewport = Children.toArray(children).some(
    child => isValidElement(child) && child.type === ScrollAreaViewport,
  );

  return (
    <div data-testid="scroll-area" {...props}>
      <ViewportRefContext value={viewportRef}>
        {callerRendersViewport ? children : <ScrollAreaViewport>{children}</ScrollAreaViewport>}
      </ViewportRefContext>
    </div>
  );
}
