import type { Position } from 'css-box-model';
import { BeforeCapture } from '../../types';

export interface EventOptions {
  passive?: boolean;
  capture?: boolean;
  // sometimes an event might only event want to be bound once
  once?: boolean;
}

export interface EventBinding<TEvent = Event> {
  eventName: string;
  fn: (event: TEvent) => void;
  options?: EventOptions;
}

interface BeforeEventDetail {
  before: BeforeCapture;
  clientSelection: Position;
}

export type AnimationEventBinding = EventBinding<AnimationEvent>;
export type BeforeCaptureEvent = EventBinding<CustomEvent<BeforeEventDetail>>;
export type ClipboardEventBinding = EventBinding<ClipboardEvent>;
export type CompositionEventBinding = EventBinding<CompositionEvent>;
export type DragEventBinding = EventBinding<DragEvent>;
export type ErrorEventBinding = EventBinding<ErrorEvent>;
export type FocusEventBinding = EventBinding<FocusEvent>;
export type KeyboardEventBinding = EventBinding<KeyboardEvent>;
export type MouseEventBinding = EventBinding<MouseEvent>;
export type TouchEventBinding = EventBinding<TouchEvent>;
export type PointerEventBinding = EventBinding<PointerEvent>;
export type TransitionEventBinding = EventBinding<TransitionEvent>;
export type UIEventBinding = EventBinding<UIEvent>;
export type WheelEventBinding = EventBinding<WheelEvent>;

export type AnyEventBinding =
  | EventBinding
  | AnimationEventBinding
  | BeforeCaptureEvent
  | ClipboardEventBinding
  | CompositionEventBinding
  | DragEventBinding
  | ErrorEventBinding
  | FocusEventBinding
  | KeyboardEventBinding
  | MouseEventBinding
  | TouchEventBinding
  | PointerEventBinding
  | TransitionEventBinding
  | UIEventBinding
  | WheelEventBinding;
