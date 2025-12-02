/* eslint-disable no-underscore-dangle */
import { applyMiddleware, createStore, compose, StoreEnhancer } from 'redux';
import reducer from './reducer';
import lift from './middleware/lift';
import style from './middleware/style';
import drop from './middleware/drop/drop-middleware';
import scrollListener from './middleware/scroll-listener';
import responders from './middleware/responders/responders-middleware';
import dropAnimationFinish from './middleware/drop/drop-animation-finish-middleware';
import dropAnimationFlushOnScroll from './middleware/drop/drop-animation-flush-on-scroll-middleware';
import dimensionMarshalStopper from './middleware/dimension-marshal-stopper';
import focus from './middleware/focus';
import autoScroll from './middleware/auto-scroll';
import pendingDrop from './middleware/pending-drop';
import type { DimensionMarshal } from './dimension-marshal/dimension-marshal-types';
import type { FocusMarshal } from '../view/use-focus-marshal/focus-marshal-types';
import type { StyleMarshal } from '../view/use-style-marshal/style-marshal-types';
import type { AutoScroller } from './auto-scroller/auto-scroller-types';
import type { Responders, Announce, State } from '../types';
import type { Store, Dispatch } from './store-types';

// For more config
// See: https://github.com/reduxjs/redux-devtools/blob/main/packages/redux-devtools-extension/src/index.ts#L3
interface Config {
  name?: string;
}

export interface ReduxDevtoolsExtensionCompose {
  (config: Config): (...funcs: StoreEnhancer[]) => StoreEnhancer;
  (...funcs: StoreEnhancer[]): StoreEnhancer;
}

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: ReduxDevtoolsExtensionCompose;
  }
}

// See: https://github.com/reduxjs/redux-devtools/blob/main/packages/redux-devtools-extension/src/index.ts#L219-L222
const composeEnhancers =
  process.env.NODE_ENV !== 'production' &&
  typeof window !== 'undefined' &&
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
        name: '@hello-pangea/dnd',
      })
    : compose;

interface Args {
  dimensionMarshal: DimensionMarshal;
  focusMarshal: FocusMarshal;
  styleMarshal: StyleMarshal;
  getResponders: () => Responders;
  announce: Announce;
  autoScroller: AutoScroller;
}

export default ({
  dimensionMarshal,
  focusMarshal,
  styleMarshal,
  getResponders,
  announce,
  autoScroller,
}: Args): Store =>
  createStore(
    reducer,
    composeEnhancers(
      applyMiddleware<Dispatch, State>(
        // ## Debug middleware

        // > uncomment to use
        // debugging logger
        // require('../debug/middleware/log').default('light'),
        // // user timing api
        // require('../debug/middleware/user-timing').default,
        // debugging timer
        // require('../debug/middleware/action-timing').default,
        // average action timer
        // require('../debug/middleware/action-timing-average').default(200),

        // ## Application middleware
        // Style updates do not cause more actions. It is important to update styles
        // before responders are called: specifically the onDragEnd responder. We need to clear
        // the transition styles off the elements before a reorder to prevent strange
        // post drag animations in firefox. Even though we clear the transition off
        // a Draggable - if it is done after a reorder firefox will still apply the
        // transition.
        // Must be called before dimension marshal for lifting to apply collecting styles
        style(styleMarshal),
        // Stop the dimension marshal collecting anything
        // when moving into a phase where collection is no longer needed.
        // We need to stop the marshal before responders fire as responders can cause
        // dimension registration changes in response to reordering
        dimensionMarshalStopper(dimensionMarshal),
        // Fire application responders in response to drag changes
        lift(dimensionMarshal),
        drop,
        // When a drop animation finishes - fire a drop complete
        dropAnimationFinish,
        dropAnimationFlushOnScroll,
        pendingDrop,
        autoScroll(autoScroller),
        scrollListener,
        focus(focusMarshal),
        // Fire responders for consumers (after update to store)
        responders(getResponders, announce),
      ),
    ),
  );
