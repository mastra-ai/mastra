/// <reference types="react" />
import * as motion_dom from 'motion-dom';
import { AnyResolvedKeyframe, OnKeyframesResolved, KeyframeResolver, UnresolvedValueKeyframe, MotionValue, Transition, ElementOrSelector, DOMKeyframesDefinition, AnimationOptions, AnimationPlaybackOptions, AnimationScope, AnimationPlaybackControlsWithThen, ValueAnimationTransition, AnimationPlaybackControls, EventInfo, MotionValueEventCallbacks, SpringOptions, TransformOptions, LegacyAnimationControls, AnimationDefinition } from 'motion-dom';
export * from 'motion-dom';
import * as react_jsx_runtime from 'react/jsx-runtime';
import * as React$1 from 'react';
import { useEffect, RefObject } from 'react';
import { V as VariantLabels, a as VisualElement, M as MotionProps, C as CreateVisualElement, b as MotionConfigContext, H as HTMLElements, c as HTMLMotionProps, D as DOMMotionComponents, d as HTMLMotionComponents, S as SVGMotionComponents, e as VisualElementAnimationOptions, I as IProjectionNode, R as ResolvedValues, f as HTMLRenderState } from '../types.d-BJcRxCew.js';
export { A as AnimationType, p as FlatTree, F as ForwardRefComponent, j as MotionStyle, k as MotionTransform, P as PresenceContext, l as SVGAttributesAsMotionValues, n as SVGMotionProps, g as ScrapeMotionValuesFromProps, i as SwitchLayoutGroupContext, h as VisualState, m as makeUseVisualState, o as optimizedAppearDataAttribute } from '../types.d-BJcRxCew.js';
import { Easing, EasingFunction, Point, Axis, Box } from 'motion-utils';
export * from 'motion-utils';
export { MotionGlobalConfig } from 'motion-utils';

type ResolveKeyframes<V extends AnyResolvedKeyframe> = (keyframes: V[], onComplete: OnKeyframesResolved<V>, name?: string, motionValue?: any) => KeyframeResolver<V>;

/**
 * @public
 */
interface AnimatePresenceProps {
    /**
     * By passing `initial={false}`, `AnimatePresence` will disable any initial animations on children
     * that are present when the component is first rendered.
     *
     * ```jsx
     * <AnimatePresence initial={false}>
     *   {isVisible && (
     *     <motion.div
     *       key="modal"
     *       initial={{ opacity: 0 }}
     *       animate={{ opacity: 1 }}
     *       exit={{ opacity: 0 }}
     *     />
     *   )}
     * </AnimatePresence>
     * ```
     *
     * @public
     */
    initial?: boolean;
    /**
     * When a component is removed, there's no longer a chance to update its props. So if a component's `exit`
     * prop is defined as a dynamic variant and you want to pass a new `custom` prop, you can do so via `AnimatePresence`.
     * This will ensure all leaving components animate using the latest data.
     *
     * @public
     */
    custom?: any;
    /**
     * Fires when all exiting nodes have completed animating out.
     *
     * @public
     */
    onExitComplete?: () => void;
    /**
     * Determines how to handle entering and exiting elements.
     *
     * - `"sync"`: Default. Elements animate in and out as soon as they're added/removed.
     * - `"popLayout"`: Exiting elements are "popped" from the page layout, allowing sibling
     *      elements to immediately occupy their new layouts.
     * - `"wait"`: Only renders one component at a time. Wait for the exiting component to animate out
     *      before animating the next component in.
     *
     * @public
     */
    mode?: "sync" | "popLayout" | "wait";
    /**
     * Root element to use when injecting styles, used when mode === `"popLayout"`.
     * This defaults to document.head but can be overridden e.g. for use in shadow DOM.
     */
    root?: HTMLElement | ShadowRoot;
    /**
     * Internal. Used in Framer to flag that sibling children *shouldn't* re-render as a result of a
     * child being removed.
     */
    presenceAffectsLayout?: boolean;
    /**
     * If true, the `AnimatePresence` component will propagate parent exit animations
     * to its children.
     */
    propagate?: boolean;
    /**
     * Internal. Set whether to anchor the x position of the exiting element to the left or right
     * when using `mode="popLayout"`.
     */
    anchorX?: "left" | "right";
}

/**
 * `AnimatePresence` enables the animation of components that have been removed from the tree.
 *
 * When adding/removing more than a single child, every child **must** be given a unique `key` prop.
 *
 * Any `motion` components that have an `exit` property defined will animate out when removed from
 * the tree.
 *
 * ```jsx
 * import { motion, AnimatePresence } from 'framer-motion'
 *
 * export const Items = ({ items }) => (
 *   <AnimatePresence>
 *     {items.map(item => (
 *       <motion.div
 *         key={item.id}
 *         initial={{ opacity: 0 }}
 *         animate={{ opacity: 1 }}
 *         exit={{ opacity: 0 }}
 *       />
 *     ))}
 *   </AnimatePresence>
 * )
 * ```
 *
 * You can sequence exit animations throughout a tree using variants.
 *
 * If a child contains multiple `motion` components with `exit` props, it will only unmount the child
 * once all `motion` components have finished animating out. Likewise, any components using
 * `usePresence` all need to call `safeToRemove`.
 *
 * @public
 */
declare const AnimatePresence: ({ children, custom, initial, onExitComplete, presenceAffectsLayout, mode, propagate, anchorX, root }: React$1.PropsWithChildren<AnimatePresenceProps>) => react_jsx_runtime.JSX.Element | null;

interface Props$3 {
    children: React$1.ReactElement;
    isPresent: boolean;
    anchorX?: "left" | "right";
    root?: HTMLElement | ShadowRoot;
}
declare function PopChild({ children, isPresent, anchorX, root }: Props$3): react_jsx_runtime.JSX.Element;

interface PresenceChildProps {
    children: React$1.ReactElement;
    isPresent: boolean;
    onExitComplete?: () => void;
    initial?: false | VariantLabels;
    custom?: any;
    presenceAffectsLayout: boolean;
    mode: "sync" | "popLayout" | "wait";
    anchorX?: "left" | "right";
    root?: HTMLElement | ShadowRoot;
}
declare const PresenceChild: ({ children, initial, isPresent, onExitComplete, custom, presenceAffectsLayout, mode, anchorX, root }: PresenceChildProps) => react_jsx_runtime.JSX.Element;

type InheritOption = boolean | "id";
interface Props$2 {
    id?: string;
    inherit?: InheritOption;
}
declare const LayoutGroup: React$1.FunctionComponent<React$1.PropsWithChildren<Props$2>>;

declare abstract class Feature<T extends any = any> {
    isMounted: boolean;
    node: VisualElement<T>;
    constructor(node: VisualElement<T>);
    abstract mount(): void;
    abstract unmount(): void;
    update(): void;
}

declare function MeasureLayout(props: MotionProps & {
    visualElement: VisualElement;
}): react_jsx_runtime.JSX.Element;

interface FeatureClass<Props = unknown> {
    new (props: Props): Feature<Props>;
}
interface HydratedFeatureDefinition {
    isEnabled: (props: MotionProps) => boolean;
    Feature: FeatureClass<unknown>;
    ProjectionNode?: any;
    MeasureLayout?: typeof MeasureLayout;
}
interface HydratedFeatureDefinitions {
    animation?: HydratedFeatureDefinition;
    exit?: HydratedFeatureDefinition;
    drag?: HydratedFeatureDefinition;
    tap?: HydratedFeatureDefinition;
    focus?: HydratedFeatureDefinition;
    hover?: HydratedFeatureDefinition;
    pan?: HydratedFeatureDefinition;
    inView?: HydratedFeatureDefinition;
    layout?: HydratedFeatureDefinition;
}
interface FeatureDefinition {
    isEnabled: HydratedFeatureDefinition["isEnabled"];
    Feature?: HydratedFeatureDefinition["Feature"];
    ProjectionNode?: HydratedFeatureDefinition["ProjectionNode"];
    MeasureLayout?: HydratedFeatureDefinition["MeasureLayout"];
}
type FeatureDefinitions = {
    [K in keyof HydratedFeatureDefinitions]: FeatureDefinition;
};
interface FeaturePackage {
    Feature?: HydratedFeatureDefinition["Feature"];
    ProjectionNode?: HydratedFeatureDefinition["ProjectionNode"];
    MeasureLayout?: HydratedFeatureDefinition["MeasureLayout"];
}
type FeaturePackages = {
    [K in keyof HydratedFeatureDefinitions]: FeaturePackage;
};
interface FeatureBundle extends FeaturePackages {
    renderer: CreateVisualElement;
}
type LazyFeatureBundle$1 = () => Promise<FeatureBundle>;

type LazyFeatureBundle = () => Promise<FeatureBundle>;
/**
 * @public
 */
interface LazyProps {
    children?: React.ReactNode;
    /**
     * Can be used to provide a feature bundle synchronously or asynchronously.
     *
     * ```jsx
     * // features.js
     * import { domAnimation } from "framer-motion"
     * export default domAnimation
     *
     * // index.js
     * import { LazyMotion, m } from "framer-motion"
     *
     * const loadFeatures = () =>import("./features.js")
     *   .then(res => res.default)
     *
     * function Component() {
     *   return (
     *     <LazyMotion features={loadFeatures}>
     *       <m.div animate={{ scale: 1.5 }} />
     *     </LazyMotion>
     *   )
     * }
     * ```
     *
     * @public
     */
    features: FeatureBundle | LazyFeatureBundle;
    /**
     * If `true`, will throw an error if a `motion` component renders within
     * a `LazyMotion` component.
     *
     * ```jsx
     * // This component will throw an error that explains using a motion component
     * // instead of the m component will break the benefits of code-splitting.
     * function Component() {
     *   return (
     *     <LazyMotion features={domAnimation} strict>
     *       <motion.div />
     *     </LazyMotion>
     *   )
     * }
     * ```
     *
     * @public
     */
    strict?: boolean;
}

/**
 * Used in conjunction with the `m` component to reduce bundle size.
 *
 * `m` is a version of the `motion` component that only loads functionality
 * critical for the initial render.
 *
 * `LazyMotion` can then be used to either synchronously or asynchronously
 * load animation and gesture support.
 *
 * ```jsx
 * // Synchronous loading
 * import { LazyMotion, m, domAnimation } from "framer-motion"
 *
 * function App() {
 *   return (
 *     <LazyMotion features={domAnimation}>
 *       <m.div animate={{ scale: 2 }} />
 *     </LazyMotion>
 *   )
 * }
 *
 * // Asynchronous loading
 * import { LazyMotion, m } from "framer-motion"
 *
 * function App() {
 *   return (
 *     <LazyMotion features={() => import('./path/to/domAnimation')}>
 *       <m.div animate={{ scale: 2 }} />
 *     </LazyMotion>
 *   )
 * }
 * ```
 *
 * @public
 */
declare function LazyMotion({ children, features, strict }: LazyProps): react_jsx_runtime.JSX.Element;

type IsValidProp = (key: string) => boolean;
declare function filterProps(props: MotionProps, isDom: boolean, forwardMotionProps: boolean): MotionProps;

interface MotionConfigProps extends Partial<MotionConfigContext> {
    children?: React$1.ReactNode;
    isValidProp?: IsValidProp;
}
/**
 * `MotionConfig` is used to set configuration options for all children `motion` components.
 *
 * ```jsx
 * import { motion, MotionConfig } from "framer-motion"
 *
 * export function App() {
 *   return (
 *     <MotionConfig transition={{ type: "spring" }}>
 *       <motion.div animate={{ x: 100 }} />
 *     </MotionConfig>
 *   )
 * }
 * ```
 *
 * @public
 */
declare function MotionConfig({ children, isValidProp, ...config }: MotionConfigProps): react_jsx_runtime.JSX.Element;

type ObjectTarget<O> = {
    [K in keyof O]?: O[K] | UnresolvedValueKeyframe[];
};
type SequenceTime = number | "<" | `+${number}` | `-${number}` | `${string}`;
type SequenceLabel = string;
interface SequenceLabelWithTime {
    name: SequenceLabel;
    at: SequenceTime;
}
interface At {
    at?: SequenceTime;
}
type MotionValueSegment = [
    MotionValue,
    UnresolvedValueKeyframe | UnresolvedValueKeyframe[]
];
type MotionValueSegmentWithTransition = [
    MotionValue,
    UnresolvedValueKeyframe | UnresolvedValueKeyframe[],
    Transition & At
];
type DOMSegment = [ElementOrSelector, DOMKeyframesDefinition];
type DOMSegmentWithTransition = [
    ElementOrSelector,
    DOMKeyframesDefinition,
    AnimationOptions & At
];
type ObjectSegment<O extends {} = {}> = [O, ObjectTarget<O>];
type ObjectSegmentWithTransition<O extends {} = {}> = [
    O,
    ObjectTarget<O>,
    AnimationOptions & At
];
type Segment = ObjectSegment | ObjectSegmentWithTransition | SequenceLabel | SequenceLabelWithTime | MotionValueSegment | MotionValueSegmentWithTransition | DOMSegment | DOMSegmentWithTransition;
type AnimationSequence = Segment[];
interface SequenceOptions extends AnimationPlaybackOptions {
    delay?: number;
    duration?: number;
    defaultTransition?: Transition;
}
interface AbsoluteKeyframe {
    value: AnyResolvedKeyframe | null;
    at: number;
    easing?: Easing;
}
type ValueSequence = AbsoluteKeyframe[];
interface SequenceMap {
    [key: string]: ValueSequence;
}
type ResolvedAnimationDefinition = {
    keyframes: {
        [key: string]: UnresolvedValueKeyframe[];
    };
    transition: {
        [key: string]: Transition;
    };
};
type ResolvedAnimationDefinitions = Map<Element | MotionValue, ResolvedAnimationDefinition>;

/**
 * Creates an animation function that is optionally scoped
 * to a specific element.
 */
declare function createScopedAnimate(scope?: AnimationScope): {
    (sequence: AnimationSequence, options?: SequenceOptions): AnimationPlaybackControlsWithThen;
    (value: string | MotionValue<string>, keyframes: string | UnresolvedValueKeyframe<string>[], options?: ValueAnimationTransition<string>): AnimationPlaybackControlsWithThen;
    (value: number | MotionValue<number>, keyframes: number | UnresolvedValueKeyframe<number>[], options?: ValueAnimationTransition<number>): AnimationPlaybackControlsWithThen;
    <V extends string | number>(value: V | MotionValue<V>, keyframes: V | UnresolvedValueKeyframe<V>[], options?: ValueAnimationTransition<V>): AnimationPlaybackControlsWithThen;
    (element: ElementOrSelector, keyframes: DOMKeyframesDefinition, options?: AnimationOptions): AnimationPlaybackControlsWithThen;
    <O extends {}>(object: O | O[], keyframes: ObjectTarget<O>, options?: AnimationOptions): AnimationPlaybackControlsWithThen;
};
declare const animate: {
    (sequence: AnimationSequence, options?: SequenceOptions): AnimationPlaybackControlsWithThen;
    (value: string | MotionValue<string>, keyframes: string | UnresolvedValueKeyframe<string>[], options?: ValueAnimationTransition<string>): AnimationPlaybackControlsWithThen;
    (value: number | MotionValue<number>, keyframes: number | UnresolvedValueKeyframe<number>[], options?: ValueAnimationTransition<number>): AnimationPlaybackControlsWithThen;
    <V extends string | number>(value: V | MotionValue<V>, keyframes: V | UnresolvedValueKeyframe<V>[], options?: ValueAnimationTransition<V>): AnimationPlaybackControlsWithThen;
    (element: ElementOrSelector, keyframes: DOMKeyframesDefinition, options?: AnimationOptions): AnimationPlaybackControlsWithThen;
    <O extends {}>(object: O | O[], keyframes: ObjectTarget<O>, options?: AnimationOptions): AnimationPlaybackControlsWithThen;
};

declare const animateMini: (elementOrSelector: ElementOrSelector, keyframes: DOMKeyframesDefinition, options?: AnimationOptions) => AnimationPlaybackControlsWithThen;

interface ScrollOptions {
    source?: HTMLElement;
    container?: Element;
    target?: Element;
    axis?: "x" | "y";
    offset?: ScrollOffset;
}
type OnScrollProgress = (progress: number) => void;
type OnScrollWithInfo = (progress: number, info: ScrollInfo) => void;
type OnScroll = OnScrollProgress | OnScrollWithInfo;
interface AxisScrollInfo {
    current: number;
    offset: number[];
    progress: number;
    scrollLength: number;
    velocity: number;
    targetOffset: number;
    targetLength: number;
    containerLength: number;
    interpolatorOffsets?: number[];
    interpolate?: EasingFunction;
}
interface ScrollInfo {
    time: number;
    x: AxisScrollInfo;
    y: AxisScrollInfo;
}
type OnScrollInfo = (info: ScrollInfo) => void;
type SupportedEdgeUnit = "px" | "vw" | "vh" | "%";
type EdgeUnit = `${number}${SupportedEdgeUnit}`;
type NamedEdges = "start" | "end" | "center";
type EdgeString = NamedEdges | EdgeUnit | `${number}`;
type Edge = EdgeString | number;
type ProgressIntersection = [number, number];
type Intersection = `${Edge} ${Edge}`;
type ScrollOffset = Array<Edge | Intersection | ProgressIntersection>;
interface ScrollInfoOptions {
    container?: Element;
    target?: Element;
    axis?: "x" | "y";
    offset?: ScrollOffset;
}

declare function scroll(onScroll: OnScroll | AnimationPlaybackControls, { axis, container, ...options }?: ScrollOptions): VoidFunction;

declare function scrollInfo(onScroll: OnScrollInfo, { container, ...options }?: ScrollInfoOptions): VoidFunction;

type ViewChangeHandler = (entry: IntersectionObserverEntry) => void;
type MarginValue = `${number}${"px" | "%"}`;
type MarginType = MarginValue | `${MarginValue} ${MarginValue}` | `${MarginValue} ${MarginValue} ${MarginValue}` | `${MarginValue} ${MarginValue} ${MarginValue} ${MarginValue}`;
interface InViewOptions {
    root?: Element | Document;
    margin?: MarginType;
    amount?: "some" | "all" | number;
}
declare function inView(elementOrSelector: ElementOrSelector, onStart: (element: Element, entry: IntersectionObserverEntry) => void | ViewChangeHandler, { root, margin: rootMargin, amount }?: InViewOptions): VoidFunction;

type DelayedFunction = (overshoot: number) => void;
/**
 * Timeout defined in ms
 */
declare function delay(callback: DelayedFunction, timeout: number): () => void;

declare const distance: (a: number, b: number) => number;
declare function distance2D(a: Point, b: Point): number;

type ReorderElementTag = keyof HTMLElements;
type DefaultGroupElement = "ul";
type DefaultItemElement = "li";

interface Props$1<V, TagName extends ReorderElementTag = DefaultGroupElement> {
    /**
     * A HTML element to render this component as. Defaults to `"ul"`.
     *
     * @public
     */
    as?: TagName;
    /**
     * The axis to reorder along. By default, items will be draggable on this axis.
     * To make draggable on both axes, set `<Reorder.Item drag />`
     *
     * @public
     */
    axis?: "x" | "y";
    /**
     * A callback to fire with the new value order. For instance, if the values
     * are provided as a state from `useState`, this could be the set state function.
     *
     * @public
     */
    onReorder: (newOrder: V[]) => void;
    /**
     * The latest values state.
     *
     * ```jsx
     * function Component() {
     *   const [items, setItems] = useState([0, 1, 2])
     *
     *   return (
     *     <Reorder.Group values={items} onReorder={setItems}>
     *         {items.map((item) => <Reorder.Item key={item} value={item} />)}
     *     </Reorder.Group>
     *   )
     * }
     * ```
     *
     * @public
     */
    values: V[];
}
type ReorderGroupProps<V, TagName extends ReorderElementTag = DefaultGroupElement> = Props$1<V, TagName> & Omit<HTMLMotionProps<TagName>, "values"> & React$1.PropsWithChildren<{}>;
declare function ReorderGroupComponent<V, TagName extends ReorderElementTag = DefaultGroupElement>({ children, as, axis, onReorder, values, ...props }: ReorderGroupProps<V, TagName>, externalRef?: React$1.ForwardedRef<any>): JSX.Element;
declare const ReorderGroup: <V, TagName extends keyof HTMLElements = "ul">(props: ReorderGroupProps<V, TagName> & {
    ref?: React$1.ForwardedRef<any>;
}) => ReturnType<typeof ReorderGroupComponent>;

interface Props<V, TagName extends ReorderElementTag = DefaultItemElement> {
    /**
     * A HTML element to render this component as. Defaults to `"li"`.
     *
     * @public
     */
    as?: TagName;
    /**
     * The value in the list that this component represents.
     *
     * @public
     */
    value: V;
    /**
     * A subset of layout options primarily used to disable layout="size"
     *
     * @public
     * @default true
     */
    layout?: true | "position";
}
type ReorderItemProps<V, TagName extends ReorderElementTag = DefaultItemElement> = Props<V, TagName> & Omit<HTMLMotionProps<TagName>, "value" | "layout"> & React$1.PropsWithChildren<{}>;
declare function ReorderItemComponent<V, TagName extends ReorderElementTag = DefaultItemElement>({ children, style, value, as, onDrag, layout, ...props }: ReorderItemProps<V, TagName>, externalRef?: React$1.ForwardedRef<any>): JSX.Element;
declare const ReorderItem: <V, TagName extends keyof HTMLElements = "li">(props: ReorderItemProps<V, TagName> & {
    ref?: React$1.ForwardedRef<any>;
}) => ReturnType<typeof ReorderItemComponent>;

declare namespace namespace_d {
  export { ReorderGroup as Group, ReorderItem as Item };
}

type MotionComponentProps<Props> = {
    [K in Exclude<keyof Props, keyof MotionProps>]?: Props[K];
} & MotionProps;
type MotionComponent<T, P> = T extends keyof DOMMotionComponents ? DOMMotionComponents[T] : React$1.ComponentType<Omit<MotionComponentProps<P>, "children"> & {
    children?: "children" extends keyof P ? P["children"] | MotionComponentProps<P>["children"] : MotionComponentProps<P>["children"];
}>;
interface MotionComponentOptions {
    forwardMotionProps?: boolean;
}
/**
 * Create a `motion` component.
 *
 * This function accepts a Component argument, which can be either a string (ie "div"
 * for `motion.div`), or an actual React component.
 *
 * Alongside this is a config option which provides a way of rendering the provided
 * component "offline", or outside the React render cycle.
 */
declare function createMotionComponent<Props, TagName extends keyof DOMMotionComponents | string = "div">(Component: TagName | string | React$1.ComponentType<Props>, { forwardMotionProps }?: MotionComponentOptions, preloadedFeatures?: FeaturePackages, createVisualElement?: CreateVisualElement<Props, TagName>): MotionComponent<TagName, Props>;

declare const m: typeof createMotionComponent & HTMLMotionComponents & SVGMotionComponents & {
    create: typeof createMotionComponent;
};

declare const motion: typeof createMotionComponent & HTMLMotionComponents & SVGMotionComponents & {
    create: typeof createMotionComponent;
};

type EventListenerWithPointInfo = (e: PointerEvent, info: EventInfo) => void;
declare const addPointerInfo: (handler: EventListenerWithPointInfo) => EventListener;

declare function addPointerEvent(target: EventTarget, eventName: string, handler: EventListenerWithPointInfo, options?: AddEventListenerOptions): () => void;

declare const animations: FeaturePackages;

declare function calcLength(axis: Axis): number;

declare const createBox: () => Box;

declare const isBrowser: boolean;

/**
 * Taken from https://github.com/radix-ui/primitives/blob/main/packages/react/compose-refs/src/compose-refs.tsx
 */

type PossibleRef<T> = React$1.Ref<T> | undefined;
/**
 * A custom hook that composes multiple refs
 * Accepts callback refs and RefObject(s)
 */
declare function useComposedRefs<T>(...refs: PossibleRef<T>[]): React$1.RefCallback<T>;

declare function useForceUpdate(): [VoidFunction, number];

declare const useIsomorphicLayoutEffect: typeof useEffect;

declare function useUnmountEffect(callback: () => void): void;

/**
 * @public
 */
declare const domAnimation: FeatureBundle;

/**
 * @public
 */
declare const domMax: FeatureBundle;

/**
 * @public
 */
declare const domMin: FeatureBundle;

declare function useMotionValueEvent<V, EventName extends keyof MotionValueEventCallbacks<V>>(value: MotionValue<V>, event: EventName, callback: MotionValueEventCallbacks<V>[EventName]): void;

/**
 * @deprecated useElementScroll is deprecated. Convert to useScroll({ container: ref })
 */
declare function useElementScroll(ref: RefObject<HTMLElement | null>): {
    scrollX: motion_dom.MotionValue<number>;
    scrollY: motion_dom.MotionValue<number>;
    scrollXProgress: motion_dom.MotionValue<number>;
    scrollYProgress: motion_dom.MotionValue<number>;
};

/**
 * @deprecated useViewportScroll is deprecated. Convert to useScroll()
 */
declare function useViewportScroll(): {
    scrollX: motion_dom.MotionValue<number>;
    scrollY: motion_dom.MotionValue<number>;
    scrollXProgress: motion_dom.MotionValue<number>;
    scrollYProgress: motion_dom.MotionValue<number>;
};

/**
 * Combine multiple motion values into a new one using a string template literal.
 *
 * ```jsx
 * import {
 *   motion,
 *   useSpring,
 *   useMotionValue,
 *   useMotionTemplate
 * } from "framer-motion"
 *
 * function Component() {
 *   const shadowX = useSpring(0)
 *   const shadowY = useMotionValue(0)
 *   const shadow = useMotionTemplate`drop-shadow(${shadowX}px ${shadowY}px 20px rgba(0,0,0,0.3))`
 *
 *   return <motion.div style={{ filter: shadow }} />
 * }
 * ```
 *
 * @public
 */
declare function useMotionTemplate(fragments: TemplateStringsArray, ...values: Array<MotionValue | number | string>): MotionValue<string>;

/**
 * Creates a `MotionValue` to track the state and velocity of a value.
 *
 * Usually, these are created automatically. For advanced use-cases, like use with `useTransform`, you can create `MotionValue`s externally and pass them into the animated component via the `style` prop.
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const scale = useMotionValue(1)
 *
 *   return <motion.div style={{ scale }} />
 * }
 * ```
 *
 * @param initial - The initial state.
 *
 * @public
 */
declare function useMotionValue<T>(initial: T): MotionValue<T>;

interface UseScrollOptions extends Omit<ScrollInfoOptions, "container" | "target"> {
    container?: RefObject<HTMLElement | null>;
    target?: RefObject<HTMLElement | null>;
}
declare function useScroll({ container, target, ...options }?: UseScrollOptions): {
    scrollX: motion_dom.MotionValue<number>;
    scrollY: motion_dom.MotionValue<number>;
    scrollXProgress: motion_dom.MotionValue<number>;
    scrollYProgress: motion_dom.MotionValue<number>;
};

/**
 * Creates a `MotionValue` that, when `set`, will use a spring animation to animate to its new state.
 *
 * It can either work as a stand-alone `MotionValue` by initialising it with a value, or as a subscriber
 * to another `MotionValue`.
 *
 * @remarks
 *
 * ```jsx
 * const x = useSpring(0, { stiffness: 300 })
 * const y = useSpring(x, { damping: 10 })
 * ```
 *
 * @param inputValue - `MotionValue` or number. If provided a `MotionValue`, when the input `MotionValue` changes, the created `MotionValue` will spring towards that value.
 * @param springConfig - Configuration options for the spring.
 * @returns `MotionValue`
 *
 * @public
 */
declare function useSpring(source: MotionValue<string>, options?: SpringOptions): MotionValue<string>;
declare function useSpring(source: string, options?: SpringOptions): MotionValue<string>;
declare function useSpring(source: MotionValue<number>, options?: SpringOptions): MotionValue<number>;
declare function useSpring(source: number, options?: SpringOptions): MotionValue<number>;

declare function useTime(): motion_dom.MotionValue<number>;

type InputRange = number[];
type SingleTransformer<I, O> = (input: I) => O;
type MultiTransformer<I, O> = (input: I[]) => O;
/**
 * Create a `MotionValue` that transforms the output of another `MotionValue` by mapping it from one range of values into another.
 *
 * @remarks
 *
 * Given an input range of `[-200, -100, 100, 200]` and an output range of
 * `[0, 1, 1, 0]`, the returned `MotionValue` will:
 *
 * - When provided a value between `-200` and `-100`, will return a value between `0` and  `1`.
 * - When provided a value between `-100` and `100`, will return `1`.
 * - When provided a value between `100` and `200`, will return a value between `1` and  `0`
 *
 *
 * The input range must be a linear series of numbers. The output range
 * can be any value type supported by Motion: numbers, colors, shadows, etc.
 *
 * Every value in the output range must be of the same type and in the same format.
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const x = useMotionValue(0)
 *   const xRange = [-200, -100, 100, 200]
 *   const opacityRange = [0, 1, 1, 0]
 *   const opacity = useTransform(x, xRange, opacityRange)
 *
 *   return (
 *     <motion.div
 *       animate={{ x: 200 }}
 *       style={{ opacity, x }}
 *     />
 *   )
 * }
 * ```
 *
 * @param inputValue - `MotionValue`
 * @param inputRange - A linear series of numbers (either all increasing or decreasing)
 * @param outputRange - A series of numbers, colors or strings. Must be the same length as `inputRange`.
 * @param options -
 *
 *  - clamp: boolean. Clamp values to within the given range. Defaults to `true`
 *  - ease: EasingFunction[]. Easing functions to use on the interpolations between each value in the input and output ranges. If provided as an array, the array must be one item shorter than the input and output ranges, as the easings apply to the transition between each.
 *
 * @returns `MotionValue`
 *
 * @public
 */
declare function useTransform<I, O>(value: MotionValue<number>, inputRange: InputRange, outputRange: O[], options?: TransformOptions<O>): MotionValue<O>;
/**
 * Create a `MotionValue` that transforms the output of another `MotionValue` through a function.
 * In this example, `y` will always be double `x`.
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const x = useMotionValue(10)
 *   const y = useTransform(x, value => value * 2)
 *
 *   return <motion.div style={{ x, y }} />
 * }
 * ```
 *
 * @param input - A `MotionValue` that will pass its latest value through `transform` to update the returned `MotionValue`.
 * @param transform - A function that accepts the latest value from `input` and returns a new value.
 * @returns `MotionValue`
 *
 * @public
 */
declare function useTransform<I, O>(input: MotionValue<I>, transformer: SingleTransformer<I, O>): MotionValue<O>;
/**
 * Pass an array of `MotionValue`s and a function to combine them. In this example, `z` will be the `x` multiplied by `y`.
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const x = useMotionValue(0)
 *   const y = useMotionValue(0)
 *   const z = useTransform([x, y], ([latestX, latestY]) => latestX * latestY)
 *
 *   return <motion.div style={{ x, y, z }} />
 * }
 * ```
 *
 * @param input - An array of `MotionValue`s that will pass their latest values through `transform` to update the returned `MotionValue`.
 * @param transform - A function that accepts the latest values from `input` and returns a new value.
 * @returns `MotionValue`
 *
 * @public
 */
declare function useTransform<I, O>(input: MotionValue<string>[] | MotionValue<number>[] | MotionValue<AnyResolvedKeyframe>[], transformer: MultiTransformer<I, O>): MotionValue<O>;
declare function useTransform<I, O>(transformer: () => O): MotionValue<O>;

/**
 * Creates a `MotionValue` that updates when the velocity of the provided `MotionValue` changes.
 *
 * ```javascript
 * const x = useMotionValue(0)
 * const xVelocity = useVelocity(x)
 * const xAcceleration = useVelocity(xVelocity)
 * ```
 *
 * @public
 */
declare function useVelocity(value: MotionValue<number>): MotionValue<number>;

interface WillChange extends MotionValue<string> {
    add(name: string): void;
}

declare function useWillChange(): WillChange;

declare class WillChangeMotionValue extends MotionValue<string> implements WillChange {
    private isEnabled;
    add(name: string): void;
    private update;
}

/**
 * If the provided value is a MotionValue, this returns the actual value, otherwise just the value itself
 *
 * TODO: Remove and move to library
 */
declare function resolveMotionValue(value?: AnyResolvedKeyframe | MotionValue): AnyResolvedKeyframe;

/**
 * A hook that returns `true` if we should be using reduced motion based on the current device's Reduced Motion setting.
 *
 * This can be used to implement changes to your UI based on Reduced Motion. For instance, replacing motion-sickness inducing
 * `x`/`y` animations with `opacity`, disabling the autoplay of background videos, or turning off parallax motion.
 *
 * It will actively respond to changes and re-render your components with the latest setting.
 *
 * ```jsx
 * export function Sidebar({ isOpen }) {
 *   const shouldReduceMotion = useReducedMotion()
 *   const closedX = shouldReduceMotion ? 0 : "-100%"
 *
 *   return (
 *     <motion.div animate={{
 *       opacity: isOpen ? 1 : 0,
 *       x: isOpen ? 0 : closedX
 *     }} />
 *   )
 * }
 * ```
 *
 * @return boolean
 *
 * @public
 */
declare function useReducedMotion(): boolean | null;

declare function useReducedMotionConfig(): boolean | null;

/**
 * @public
 */
declare function animationControls(): LegacyAnimationControls;

declare function useAnimate<T extends Element = any>(): [AnimationScope<T>, {
    (sequence: AnimationSequence, options?: SequenceOptions | undefined): motion_dom.AnimationPlaybackControlsWithThen;
    (value: string | motion_dom.MotionValue<string>, keyframes: string | motion_dom.UnresolvedValueKeyframe<string>[], options?: motion_dom.ValueAnimationTransition<string> | undefined): motion_dom.AnimationPlaybackControlsWithThen;
    (value: number | motion_dom.MotionValue<number>, keyframes: number | motion_dom.UnresolvedValueKeyframe<number>[], options?: motion_dom.ValueAnimationTransition<number> | undefined): motion_dom.AnimationPlaybackControlsWithThen;
    <V extends string | number>(value: V | motion_dom.MotionValue<V>, keyframes: V | motion_dom.UnresolvedValueKeyframe<V>[], options?: motion_dom.ValueAnimationTransition<V> | undefined): motion_dom.AnimationPlaybackControlsWithThen;
    (element: motion_dom.ElementOrSelector, keyframes: motion_dom.DOMKeyframesDefinition, options?: motion_dom.AnimationOptions | undefined): motion_dom.AnimationPlaybackControlsWithThen;
    <O extends {}>(object: O | O[], keyframes: ObjectTarget<O>, options?: motion_dom.AnimationOptions | undefined): motion_dom.AnimationPlaybackControlsWithThen;
}];

declare function useAnimateMini<T extends Element = any>(): [AnimationScope<T>, (elementOrSelector: motion_dom.ElementOrSelector, keyframes: motion_dom.DOMKeyframesDefinition, options?: motion_dom.AnimationOptions | undefined) => motion_dom.AnimationPlaybackControlsWithThen];

/**
 * Creates `LegacyAnimationControls`, which can be used to manually start, stop
 * and sequence animations on one or more components.
 *
 * The returned `LegacyAnimationControls` should be passed to the `animate` property
 * of the components you want to animate.
 *
 * These components can then be animated with the `start` method.
 *
 * ```jsx
 * import * as React from 'react'
 * import { motion, useAnimation } from 'framer-motion'
 *
 * export function MyComponent(props) {
 *    const controls = useAnimation()
 *
 *    controls.start({
 *        x: 100,
 *        transition: { duration: 0.5 },
 *    })
 *
 *    return <motion.div animate={controls} />
 * }
 * ```
 *
 * @returns Animation controller with `start` and `stop` methods
 *
 * @public
 */
declare function useAnimationControls(): LegacyAnimationControls;
declare const useAnimation: typeof useAnimationControls;

declare function animateVisualElement(visualElement: VisualElement, definition: AnimationDefinition, options?: VisualElementAnimationOptions): Promise<void>;

type SafeToRemove = () => void;
type AlwaysPresent = [true, null];
type Present = [true];
type NotPresent = [false, SafeToRemove];
/**
 * When a component is the child of `AnimatePresence`, it can use `usePresence`
 * to access information about whether it's still present in the React tree.
 *
 * ```jsx
 * import { usePresence } from "framer-motion"
 *
 * export const Component = () => {
 *   const [isPresent, safeToRemove] = usePresence()
 *
 *   useEffect(() => {
 *     !isPresent && setTimeout(safeToRemove, 1000)
 *   }, [isPresent])
 *
 *   return <div />
 * }
 * ```
 *
 * If `isPresent` is `false`, it means that a component has been removed the tree, but
 * `AnimatePresence` won't really remove it until `safeToRemove` has been called.
 *
 * @public
 */
declare function usePresence(subscribe?: boolean): AlwaysPresent | Present | NotPresent;
/**
 * Similar to `usePresence`, except `useIsPresent` simply returns whether or not the component is present.
 * There is no `safeToRemove` function.
 *
 * ```jsx
 * import { useIsPresent } from "framer-motion"
 *
 * export const Component = () => {
 *   const isPresent = useIsPresent()
 *
 *   useEffect(() => {
 *     !isPresent && console.log("I've been removed!")
 *   }, [isPresent])
 *
 *   return <div />
 * }
 * ```
 *
 * @public
 */
declare function useIsPresent(): boolean;

declare function usePresenceData(): any;

/**
 * Attaches an event listener directly to the provided DOM element.
 *
 * Bypassing React's event system can be desirable, for instance when attaching non-passive
 * event handlers.
 *
 * ```jsx
 * const ref = useRef(null)
 *
 * useDomEvent(ref, 'wheel', onWheel, { passive: false })
 *
 * return <div ref={ref} />
 * ```
 *
 * @param ref - React.RefObject that's been provided to the element you want to bind the listener to.
 * @param eventName - Name of the event you want listen for.
 * @param handler - Function to fire when receiving the event.
 * @param options - Options to pass to `Event.addEventListener`.
 *
 * @public
 */
declare function useDomEvent(ref: RefObject<EventTarget | null>, eventName: string, handler?: EventListener | undefined, options?: AddEventListenerOptions): void;

interface DragControlOptions {
    /**
     * This distance after which dragging starts and a direction is locked in.
     *
     * @public
     */
    distanceThreshold?: number;
    /**
     * Whether to immediately snap to the cursor when dragging starts.
     *
     * @public
     */
    snapToCursor?: boolean;
}

/**
 * Can manually trigger a drag gesture on one or more `drag`-enabled `motion` components.
 *
 * ```jsx
 * const dragControls = useDragControls()
 *
 * function startDrag(event) {
 *   dragControls.start(event, { snapToCursor: true })
 * }
 *
 * return (
 *   <>
 *     <div onPointerDown={startDrag} />
 *     <motion.div drag="x" dragControls={dragControls} />
 *   </>
 * )
 * ```
 *
 * @public
 */
declare class DragControls {
    private componentControls;
    /**
     * Start a drag gesture on every `motion` component that has this set of drag controls
     * passed into it via the `dragControls` prop.
     *
     * ```jsx
     * dragControls.start(e, {
     *   snapToCursor: true
     * })
     * ```
     *
     * @param event - PointerEvent
     * @param options - Options
     *
     * @public
     */
    start(event: React$1.PointerEvent | PointerEvent, options?: DragControlOptions): void;
    /**
     * Cancels a drag gesture.
     *
     * ```jsx
     * dragControls.cancel()
     * ```
     *
     * @public
     */
    cancel(): void;
    /**
     * Stops a drag gesture.
     *
     * ```jsx
     * dragControls.stop()
     * ```
     *
     * @public
     */
    stop(): void;
}
/**
 * Usually, dragging is initiated by pressing down on a `motion` component with a `drag` prop
 * and moving it. For some use-cases, for instance clicking at an arbitrary point on a video scrubber, we
 * might want to initiate that dragging from a different component than the draggable one.
 *
 * By creating a `dragControls` using the `useDragControls` hook, we can pass this into
 * the draggable component's `dragControls` prop. It exposes a `start` method
 * that can start dragging from pointer events on other components.
 *
 * ```jsx
 * const dragControls = useDragControls()
 *
 * function startDrag(event) {
 *   dragControls.start(event, { snapToCursor: true })
 * }
 *
 * return (
 *   <>
 *     <div onPointerDown={startDrag} />
 *     <motion.div drag="x" dragControls={dragControls} />
 *   </>
 * )
 * ```
 *
 * @public
 */
declare function useDragControls(): DragControls;

/**
 * Checks if a component is a `motion` component.
 */
declare function isMotionComponent(component: React.ComponentType | string): boolean;

/**
 * Unwraps a `motion` component and returns either a string for `motion.div` or
 * the React component for `motion(Component)`.
 *
 * If the component is not a `motion` component it returns undefined.
 */
declare function unwrapMotionComponent(component: React.ComponentType | string): React.ComponentType | string | undefined;

/**
 * Check whether a prop name is a valid `MotionProp` key.
 *
 * @param key - Name of the property to check
 * @returns `true` is key is a valid `MotionProp`.
 *
 * @public
 */
declare function isValidMotionProp(key: string): boolean;

type ScaleCorrector = (latest: AnyResolvedKeyframe, node: IProjectionNode) => AnyResolvedKeyframe;
interface ScaleCorrectorDefinition {
    correct: ScaleCorrector;
    applyTo?: string[];
    isCSSVariable?: boolean;
}
interface ScaleCorrectorMap {
    [key: string]: ScaleCorrectorDefinition;
}

declare function addScaleCorrector(correctors: ScaleCorrectorMap): void;

declare function useInstantLayoutTransition(): (cb?: (() => void) | undefined) => void;

declare function useResetProjection(): () => void;

/**
 * Build a CSS transform style from individual x/y/scale etc properties.
 *
 * This outputs with a default order of transforms/scales/rotations, this can be customised by
 * providing a transformTemplate function.
 */
declare function buildTransform(latestValues: ResolvedValues, transform: HTMLRenderState["transform"], transformTemplate?: MotionProps["transformTemplate"]): string;

declare const visualElementStore: WeakMap<any, VisualElement<unknown, unknown, {}>>;

type FrameCallback = (timestamp: number, delta: number) => void;
declare function useAnimationFrame(callback: FrameCallback): void;

type Cycle = (i?: number) => void;
type CycleState<T> = [T, Cycle];
/**
 * Cycles through a series of visual properties. Can be used to toggle between or cycle through animations. It works similar to `useState` in React. It is provided an initial array of possible states, and returns an array of two arguments.
 *
 * An index value can be passed to the returned `cycle` function to cycle to a specific index.
 *
 * ```jsx
 * import * as React from "react"
 * import { motion, useCycle } from "framer-motion"
 *
 * export const MyComponent = () => {
 *   const [x, cycleX] = useCycle(0, 50, 100)
 *
 *   return (
 *     <motion.div
 *       animate={{ x: x }}
 *       onTap={() => cycleX()}
 *      />
 *    )
 * }
 * ```
 *
 * @param items - items to cycle through
 * @returns [currentState, cycleState]
 *
 * @public
 */
declare function useCycle<T>(...items: T[]): CycleState<T>;

interface UseInViewOptions extends Omit<InViewOptions, "root" | "amount"> {
    root?: RefObject<Element | null>;
    once?: boolean;
    amount?: "some" | "all" | number;
    initial?: boolean;
}
declare function useInView(ref: RefObject<Element | null>, { root, margin, amount, once, initial, }?: UseInViewOptions): boolean;

declare function useInstantTransition(): (callback: () => void) => void;
declare function disableInstantTransitions(): void;

declare function usePageInView(): boolean;

declare function startOptimizedAppearAnimation(element: HTMLElement, name: string, keyframes: string[] | number[], options: ValueAnimationTransition<number | string>, onReady?: (animation: Animation) => void): void;

interface NodeGroup {
    add: (node: IProjectionNode) => void;
    remove: (node: IProjectionNode) => void;
    dirty: VoidFunction;
}

interface LayoutGroupContextProps {
    id?: string;
    group?: NodeGroup;
    forceRender?: VoidFunction;
}
declare const LayoutGroupContext: React$1.Context<LayoutGroupContextProps>;

interface MotionContextProps<Instance = unknown> {
    visualElement?: VisualElement<Instance>;
    initial?: false | string | string[];
    animate?: string | string[];
}
declare const MotionContext: React$1.Context<MotionContextProps<unknown>>;

/**
 * @public
 */
interface ScrollMotionValues {
    scrollX: MotionValue<number>;
    scrollY: MotionValue<number>;
    scrollXProgress: MotionValue<number>;
    scrollYProgress: MotionValue<number>;
}

/**
 * This is not an officially supported API and may be removed
 * on any version.
 */
declare function useAnimatedState(initialState: any): any[];

declare const AnimateSharedLayout: React$1.FunctionComponent<React$1.PropsWithChildren<unknown>>;

/**
 * Note: Still used by components generated by old versions of Framer
 *
 * @deprecated
 */
declare const DeprecatedLayoutGroupContext: React$1.Context<string | null>;

interface ScaleMotionValues {
    scaleX: MotionValue<number>;
    scaleY: MotionValue<number>;
}
/**
 * Returns a `MotionValue` each for `scaleX` and `scaleY` that update with the inverse
 * of their respective parent scales.
 *
 * This is useful for undoing the distortion of content when scaling a parent component.
 *
 * By default, `useInvertedScale` will automatically fetch `scaleX` and `scaleY` from the nearest parent.
 * By passing other `MotionValue`s in as `useInvertedScale({ scaleX, scaleY })`, it will invert the output
 * of those instead.
 *
 * ```jsx
 * const MyComponent = () => {
 *   const { scaleX, scaleY } = useInvertedScale()
 *   return <motion.div style={{ scaleX, scaleY }} />
 * }
 * ```
 *
 * @deprecated
 */
declare function useInvertedScale(scale?: Partial<ScaleMotionValues>): ScaleMotionValues;

export { type AbsoluteKeyframe, AnimatePresence, type AnimatePresenceProps, AnimateSharedLayout, type AnimationSequence, type At, CreateVisualElement, type Cycle, type CycleState, DOMMotionComponents, type DOMSegment, type DOMSegmentWithTransition, type DelayedFunction, DeprecatedLayoutGroupContext, DragControls, type FeatureBundle, type FeatureDefinition, type FeatureDefinitions, type FeaturePackage, type FeaturePackages, HTMLElements, HTMLMotionProps, type HydratedFeatureDefinition, type HydratedFeatureDefinitions, IProjectionNode, LayoutGroup, LayoutGroupContext, type LazyFeatureBundle$1 as LazyFeatureBundle, LazyMotion, type LazyProps, MotionConfig, MotionConfigContext, type MotionConfigProps, MotionContext, MotionProps, type MotionValueSegment, type MotionValueSegmentWithTransition, type ObjectSegment, type ObjectSegmentWithTransition, type ObjectTarget, PopChild, PresenceChild, namespace_d as Reorder, type ResolveKeyframes, type ResolvedAnimationDefinition, type ResolvedAnimationDefinitions, ResolvedValues, type ScrollMotionValues, type Segment, type SequenceLabel, type SequenceLabelWithTime, type SequenceMap, type SequenceOptions, type SequenceTime, type UseInViewOptions, type UseScrollOptions, type ValueSequence, VariantLabels, VisualElement, WillChangeMotionValue, addPointerEvent, addPointerInfo, addScaleCorrector, animate, animateMini, animateVisualElement, animationControls, animations, buildTransform, calcLength, createBox, createScopedAnimate, delay, disableInstantTransitions, distance, distance2D, domAnimation, domMax, domMin, filterProps, inView, isBrowser, isMotionComponent, isValidMotionProp, m, motion, resolveMotionValue, scroll, scrollInfo, startOptimizedAppearAnimation, unwrapMotionComponent, useAnimate, useAnimateMini, useAnimation, useAnimationControls, useAnimationFrame, useComposedRefs, useCycle, useAnimatedState as useDeprecatedAnimatedState, useInvertedScale as useDeprecatedInvertedScale, useDomEvent, useDragControls, useElementScroll, useForceUpdate, useInView, useInstantLayoutTransition, useInstantTransition, useIsPresent, useIsomorphicLayoutEffect, useMotionTemplate, useMotionValue, useMotionValueEvent, usePageInView, usePresence, usePresenceData, useReducedMotion, useReducedMotionConfig, useResetProjection, useScroll, useSpring, useTime, useTransform, useUnmountEffect, useVelocity, useViewportScroll, useWillChange, visualElementStore };
