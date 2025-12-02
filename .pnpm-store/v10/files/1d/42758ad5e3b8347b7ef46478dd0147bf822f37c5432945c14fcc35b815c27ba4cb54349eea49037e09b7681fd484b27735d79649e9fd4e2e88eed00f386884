import type { Position } from 'css-box-model';
import createFluidScroller from './fluid-scroller';
import type { FluidScroller } from './fluid-scroller';
import createJumpScroller from './jump-scroller';
import type { JumpScroller } from './jump-scroller';
import type { AutoScroller } from './auto-scroller-types';
import type { DroppableId, State } from '../../types';
import type { MoveArgs } from '../action-creators';
import { AutoScrollerOptions } from './fluid-scroller/auto-scroller-options-types';

export interface Args {
  scrollWindow: (offset: Position) => void;
  scrollDroppable: (id: DroppableId, change: Position) => void;
  move: (args: MoveArgs) => unknown;
  getAutoScrollerOptions: () => AutoScrollerOptions;
}

export default ({
  scrollDroppable,
  scrollWindow,
  move,
  getAutoScrollerOptions,
}: Args): AutoScroller => {
  const fluidScroller: FluidScroller = createFluidScroller({
    scrollWindow,
    scrollDroppable,
    getAutoScrollerOptions,
  });

  const jumpScroll: JumpScroller = createJumpScroller({
    move,
    scrollWindow,
    scrollDroppable,
  });

  const scroll = (state: State) => {
    const autoScrollerOptions = getAutoScrollerOptions();

    // Only allowing auto scrolling in the DRAGGING phase
    // and when autoScroll is not disabled
    if (autoScrollerOptions.disabled || state.phase !== 'DRAGGING') {
      return;
    }

    if (state.movementMode === 'FLUID') {
      fluidScroller.scroll(state);
      return;
    }

    if (!state.scrollJumpRequest) {
      return;
    }

    jumpScroll(state);
  };

  const scroller: AutoScroller = {
    scroll,
    start: fluidScroller.start,
    stop: fluidScroller.stop,
  };

  return scroller;
};
