import { UnresolvedValueKeyframe, MotionValue, Transition, ElementOrSelector, DOMKeyframesDefinition, AnimationOptions, AnimationPlaybackOptions, AnyResolvedKeyframe, AnimationScope, AnimationPlaybackControlsWithThen, ValueAnimationTransition, AnimationPlaybackControls } from 'motion-dom';
export * from 'motion-dom';
import { Easing, EasingFunction, Point } from 'motion-utils';
export * from 'motion-utils';

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

interface HTMLElements {
    a: HTMLAnchorElement;
    abbr: HTMLElement;
    address: HTMLElement;
    area: HTMLAreaElement;
    article: HTMLElement;
    aside: HTMLElement;
    audio: HTMLAudioElement;
    b: HTMLElement;
    base: HTMLBaseElement;
    bdi: HTMLElement;
    bdo: HTMLElement;
    big: HTMLElement;
    blockquote: HTMLQuoteElement;
    body: HTMLBodyElement;
    br: HTMLBRElement;
    button: HTMLButtonElement;
    canvas: HTMLCanvasElement;
    caption: HTMLElement;
    center: HTMLElement;
    cite: HTMLElement;
    code: HTMLElement;
    col: HTMLTableColElement;
    colgroup: HTMLTableColElement;
    data: HTMLDataElement;
    datalist: HTMLDataListElement;
    dd: HTMLElement;
    del: HTMLModElement;
    details: HTMLDetailsElement;
    dfn: HTMLElement;
    dialog: HTMLDialogElement;
    div: HTMLDivElement;
    dl: HTMLDListElement;
    dt: HTMLElement;
    em: HTMLElement;
    embed: HTMLEmbedElement;
    fieldset: HTMLFieldSetElement;
    figcaption: HTMLElement;
    figure: HTMLElement;
    footer: HTMLElement;
    form: HTMLFormElement;
    h1: HTMLHeadingElement;
    h2: HTMLHeadingElement;
    h3: HTMLHeadingElement;
    h4: HTMLHeadingElement;
    h5: HTMLHeadingElement;
    h6: HTMLHeadingElement;
    head: HTMLHeadElement;
    header: HTMLElement;
    hgroup: HTMLElement;
    hr: HTMLHRElement;
    html: HTMLHtmlElement;
    i: HTMLElement;
    iframe: HTMLIFrameElement;
    img: HTMLImageElement;
    input: HTMLInputElement;
    ins: HTMLModElement;
    kbd: HTMLElement;
    keygen: HTMLElement;
    label: HTMLLabelElement;
    legend: HTMLLegendElement;
    li: HTMLLIElement;
    link: HTMLLinkElement;
    main: HTMLElement;
    map: HTMLMapElement;
    mark: HTMLElement;
    menu: HTMLElement;
    menuitem: HTMLElement;
    meta: HTMLMetaElement;
    meter: HTMLMeterElement;
    nav: HTMLElement;
    noindex: HTMLElement;
    noscript: HTMLElement;
    object: HTMLObjectElement;
    ol: HTMLOListElement;
    optgroup: HTMLOptGroupElement;
    option: HTMLOptionElement;
    output: HTMLOutputElement;
    p: HTMLParagraphElement;
    param: HTMLParamElement;
    picture: HTMLElement;
    pre: HTMLPreElement;
    progress: HTMLProgressElement;
    q: HTMLQuoteElement;
    rp: HTMLElement;
    rt: HTMLElement;
    ruby: HTMLElement;
    s: HTMLElement;
    samp: HTMLElement;
    search: HTMLElement;
    slot: HTMLSlotElement;
    script: HTMLScriptElement;
    section: HTMLElement;
    select: HTMLSelectElement;
    small: HTMLElement;
    source: HTMLSourceElement;
    span: HTMLSpanElement;
    strong: HTMLElement;
    style: HTMLStyleElement;
    sub: HTMLElement;
    summary: HTMLElement;
    sup: HTMLElement;
    table: HTMLTableElement;
    template: HTMLTemplateElement;
    tbody: HTMLTableSectionElement;
    td: HTMLTableDataCellElement;
    textarea: HTMLTextAreaElement;
    tfoot: HTMLTableSectionElement;
    th: HTMLTableHeaderCellElement;
    thead: HTMLTableSectionElement;
    time: HTMLTimeElement;
    title: HTMLTitleElement;
    tr: HTMLTableRowElement;
    track: HTMLTrackElement;
    u: HTMLElement;
    ul: HTMLUListElement;
    var: HTMLElement;
    video: HTMLVideoElement;
    wbr: HTMLElement;
    webview: HTMLWebViewElement;
}

type DelayedFunction = (overshoot: number) => void;
declare function delayInSeconds(callback: DelayedFunction, timeout: number): () => void;

declare const distance: (a: number, b: number) => number;
declare function distance2D(a: Point, b: Point): number;

export { type AbsoluteKeyframe, type AnimationSequence, type At, type DOMSegment, type DOMSegmentWithTransition, type DelayedFunction, type HTMLElements, type MotionValueSegment, type MotionValueSegmentWithTransition, type ObjectSegment, type ObjectSegmentWithTransition, type ObjectTarget, type ResolvedAnimationDefinition, type ResolvedAnimationDefinitions, type Segment, type SequenceLabel, type SequenceLabelWithTime, type SequenceMap, type SequenceOptions, type SequenceTime, type ValueSequence, animate, animateMini, createScopedAnimate, delayInSeconds as delay, distance, distance2D, inView, scroll, scrollInfo };
