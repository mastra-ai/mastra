/// <reference types="react" />
import * as motion_dom from 'motion-dom';
import { TransformProperties, MotionNodeOptions, MotionValue, SVGPathProperties, Transition, JSAnimation, ValueTransition, TargetAndTransition, AnyResolvedKeyframe, KeyframeResolver, AnimationDefinition, Batcher } from 'motion-dom';
import { TransformPoint, Box, Delta, Point, Axis } from 'motion-utils';
import * as React$1 from 'react';
import { CSSProperties, PropsWithoutRef, RefAttributes, JSX, SVGAttributes } from 'react';

/**
 * Either a string, or array of strings, that reference variants defined via the `variants` prop.
 * @public
 */
type VariantLabels = string | string[];

type MotionValueString = MotionValue<string>;
type MotionValueNumber = MotionValue<number>;
type MotionValueAny = MotionValue<any>;
type AnyMotionValue = MotionValueNumber | MotionValueString | MotionValueAny;
type MotionValueHelper<T> = T | AnyMotionValue;
type MakeMotionHelper<T> = {
    [K in keyof T]: MotionValueHelper<T[K]>;
};
type MakeCustomValueTypeHelper<T> = MakeMotionHelper<T>;
type MakeMotion<T> = MakeCustomValueTypeHelper<T>;
type MotionCSS = MakeMotion<Omit<CSSProperties, "rotate" | "scale" | "perspective">>;
/**
 * @public
 */
type MotionTransform = MakeMotion<TransformProperties>;
type MotionSVGProps = MakeMotion<SVGPathProperties>;
/**
 * @public
 */
interface MotionStyle extends MotionCSS, MotionTransform, MotionSVGProps {
}
/**
 * Props for `motion` components.
 *
 * @public
 */
interface MotionProps extends MotionNodeOptions {
    /**
     *
     * The React DOM `style` prop, enhanced with support for `MotionValue`s and separate `transform` values.
     *
     * ```jsx
     * export const MyComponent = () => {
     *   const x = useMotionValue(0)
     *
     *   return <motion.div style={{ x, opacity: 1, scale: 0.5 }} />
     * }
     * ```
     */
    style?: MotionStyle;
    children?: React.ReactNode | MotionValueNumber | MotionValueString;
}

type ReducedMotionConfig = "always" | "never" | "user";
/**
 * @public
 */
interface MotionConfigContext {
    /**
     * Internal, exported only for usage in Framer
     */
    transformPagePoint: TransformPoint;
    /**
     * Internal. Determines whether this is a static context ie the Framer canvas. If so,
     * it'll disable all dynamic functionality.
     */
    isStatic: boolean;
    /**
     * Defines a new default transition for the entire tree.
     *
     * @public
     */
    transition?: Transition;
    /**
     * If true, will respect the device prefersReducedMotion setting by switching
     * transform animations off.
     *
     * @public
     */
    reducedMotion?: ReducedMotionConfig;
    /**
     * A custom `nonce` attribute used when wanting to enforce a Content Security Policy (CSP).
     * For more details see:
     * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src#unsafe_inline_styles
     *
     * @public
     */
    nonce?: string;
}
/**
 * @public
 */
declare const MotionConfigContext: React$1.Context<MotionConfigContext>;

/**
 * @public
 */
interface PresenceContextProps {
    id: string;
    isPresent: boolean;
    register: (id: string | number) => () => void;
    onExitComplete?: (id: string | number) => void;
    initial?: false | VariantLabels;
    custom?: any;
}
/**
 * @public
 */
declare const PresenceContext: React$1.Context<PresenceContextProps | null>;

interface VisualState<Instance, RenderState> {
    renderState: RenderState;
    latestValues: ResolvedValues;
    onMount?: (instance: Instance) => void;
}
type UseVisualState<Instance, RenderState> = (props: MotionProps, isStatic: boolean) => VisualState<Instance, RenderState>;
interface UseVisualStateConfig<RenderState> {
    scrapeMotionValuesFromProps: ScrapeMotionValuesFromProps;
    createRenderState: () => RenderState;
}
declare const makeUseVisualState: <I, RS>(config: UseVisualStateConfig<RS>) => UseVisualState<I, RS>;

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

interface TransformOrigin {
    originX?: number | string;
    originY?: number | string;
    originZ?: number | string;
}
interface HTMLRenderState {
    /**
     * A mutable record of transforms we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    transform: ResolvedValues;
    /**
     * A mutable record of transform origins we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    transformOrigin: TransformOrigin;
    /**
     * A mutable record of styles we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    style: ResolvedValues;
    /**
     * A mutable record of CSS variables we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    vars: ResolvedValues;
}
/**
 * @public
 */
type ForwardRefComponent<T, P> = {
    readonly $$typeof: symbol;
} & ((props: PropsWithoutRef<P> & RefAttributes<T>) => JSX.Element);
type AttributesWithoutMotionProps<Attributes> = {
    [K in Exclude<keyof Attributes, keyof MotionProps>]?: Attributes[K];
};
/**
 * @public
 */
type HTMLMotionProps<Tag extends keyof HTMLElements> = AttributesWithoutMotionProps<JSX.IntrinsicElements[Tag]> & MotionProps;
/**
 * Motion-optimised versions of React's HTML components.
 *
 * @public
 */
type HTMLMotionComponents = {
    [K in keyof HTMLElements]: ForwardRefComponent<HTMLElements[K], HTMLMotionProps<K>>;
};

type UnionStringArray<T extends Readonly<string[]>> = T[number];
declare const svgElements: readonly ["animate", "circle", "defs", "desc", "ellipse", "g", "image", "line", "filter", "marker", "mask", "metadata", "path", "pattern", "polygon", "polyline", "rect", "stop", "svg", "switch", "symbol", "text", "tspan", "use", "view", "clipPath", "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence", "foreignObject", "linearGradient", "radialGradient", "textPath"];
type SVGElements = UnionStringArray<typeof svgElements>;

interface SVGAttributesWithoutMotionProps<T> extends Pick<SVGAttributes<T>, Exclude<keyof SVGAttributes<T>, keyof MotionProps>> {
}
/**
 * Blanket-accept any SVG attribute as a `MotionValue`
 * @public
 */
type SVGAttributesAsMotionValues<T> = MakeMotion<SVGAttributesWithoutMotionProps<T>>;
type UnwrapSVGFactoryElement<F> = F extends React.SVGProps<infer P> ? P : never;
/**
 * @public
 */
interface SVGMotionProps<T> extends SVGAttributesAsMotionValues<T>, MotionProps {
}
/**
 * Motion-optimised versions of React's SVG components.
 *
 * @public
 */
type SVGMotionComponents = {
    [K in SVGElements]: ForwardRefComponent<UnwrapSVGFactoryElement<JSX.IntrinsicElements[K]>, SVGMotionProps<UnwrapSVGFactoryElement<JSX.IntrinsicElements[K]>>>;
};

type DOMMotionComponents = HTMLMotionComponents & SVGMotionComponents;

interface SwitchLayoutGroup {
    register?: (member: IProjectionNode) => void;
    deregister?: (member: IProjectionNode) => void;
}
type InitialPromotionConfig = {
    /**
     * The initial transition to use when the elements in this group mount (and automatically promoted).
     * Subsequent updates should provide a transition in the promote method.
     */
    transition?: Transition;
    /**
     * If the follow tree should preserve its opacity when the lead is promoted on mount
     */
    shouldPreserveFollowOpacity?: (member: IProjectionNode) => boolean;
};
type SwitchLayoutGroupContext = SwitchLayoutGroup & InitialPromotionConfig;
/**
 * Internal, exported only for usage in Framer
 */
declare const SwitchLayoutGroupContext: React$1.Context<SwitchLayoutGroupContext>;

interface WithDepth {
    depth: number;
}

declare class FlatTree {
    private children;
    private isDirty;
    add(child: WithDepth): void;
    remove(child: WithDepth): void;
    forEach(callback: (child: WithDepth) => void): void;
}

declare class NodeStack {
    lead?: IProjectionNode;
    prevLead?: IProjectionNode;
    members: IProjectionNode[];
    add(node: IProjectionNode): void;
    remove(node: IProjectionNode): void;
    relegate(node: IProjectionNode): boolean;
    promote(node: IProjectionNode, preserveFollowOpacity?: boolean): void;
    exitAnimationComplete(): void;
    scheduleRender(): void;
    /**
     * Clear any leads that have been removed this render to prevent them from being
     * used in future animations and to prevent memory leaks
     */
    removeLeadSnapshot(): void;
}

interface Measurements {
    animationId: number;
    measuredBox: Box;
    layoutBox: Box;
    latestValues: ResolvedValues;
    source: number;
}
type Phase = "snapshot" | "measure";
interface ScrollMeasurements {
    animationId: number;
    phase: Phase;
    offset: Point;
    isRoot: boolean;
    wasRoot: boolean;
}
type LayoutEvents = "willUpdate" | "didUpdate" | "beforeMeasure" | "measure" | "projectionUpdate" | "animationStart" | "animationComplete";
interface IProjectionNode<I = unknown> {
    id: number;
    animationId: number;
    animationCommitId: number;
    parent?: IProjectionNode;
    relativeParent?: IProjectionNode;
    root?: IProjectionNode;
    children: Set<IProjectionNode>;
    path: IProjectionNode[];
    nodes?: FlatTree;
    depth: number;
    instance: I | undefined;
    mount: (node: I, isLayoutDirty?: boolean) => void;
    unmount: () => void;
    options: ProjectionNodeOptions;
    setOptions(options: ProjectionNodeOptions): void;
    layout?: Measurements;
    snapshot?: Measurements;
    target?: Box;
    relativeTarget?: Box;
    relativeTargetOrigin?: Box;
    targetDelta?: Delta;
    targetWithTransforms?: Box;
    scroll?: ScrollMeasurements;
    treeScale?: Point;
    projectionDelta?: Delta;
    projectionDeltaWithTransform?: Delta;
    latestValues: ResolvedValues;
    isLayoutDirty: boolean;
    isProjectionDirty: boolean;
    isSharedProjectionDirty: boolean;
    isTransformDirty: boolean;
    resolvedRelativeTargetAt?: number;
    shouldResetTransform: boolean;
    prevTransformTemplateValue: string | undefined;
    isUpdateBlocked(): boolean;
    updateManuallyBlocked: boolean;
    updateBlockedByResize: boolean;
    blockUpdate(): void;
    unblockUpdate(): void;
    isUpdating: boolean;
    needsReset: boolean;
    startUpdate(): void;
    willUpdate(notifyListeners?: boolean): void;
    didUpdate(): void;
    measure(removeTransform?: boolean): Measurements;
    measurePageBox(): Box;
    updateLayout(): void;
    updateSnapshot(): void;
    clearSnapshot(): void;
    updateScroll(phase?: Phase): void;
    scheduleUpdateProjection(): void;
    scheduleCheckAfterUnmount(): void;
    checkUpdateFailed(): void;
    sharedNodes: Map<string, NodeStack>;
    registerSharedNode(id: string, node: IProjectionNode): void;
    getStack(): NodeStack | undefined;
    isVisible: boolean;
    hide(): void;
    show(): void;
    scheduleRender(notifyAll?: boolean): void;
    getClosestProjectingParent(): IProjectionNode | undefined;
    setTargetDelta(delta: Delta): void;
    resetTransform(): void;
    resetSkewAndRotation(): void;
    applyTransform(box: Box, transformOnly?: boolean): Box;
    resolveTargetDelta(force?: boolean): void;
    calcProjection(): void;
    applyProjectionStyles(targetStyle: CSSStyleDeclaration, styleProp?: MotionStyle): void;
    clearMeasurements(): void;
    resetTree(): void;
    isProjecting(): boolean;
    animationValues?: ResolvedValues;
    currentAnimation?: JSAnimation<number>;
    isTreeAnimating?: boolean;
    isAnimationBlocked?: boolean;
    isTreeAnimationBlocked: () => boolean;
    setAnimationOrigin(delta: Delta): void;
    startAnimation(transition: ValueTransition): void;
    finishAnimation(): void;
    hasCheckedOptimisedAppear: boolean;
    isLead(): boolean;
    promote(options?: {
        needsReset?: boolean;
        transition?: Transition;
        preserveFollowOpacity?: boolean;
    }): void;
    relegate(): boolean;
    resumeFrom?: IProjectionNode;
    resumingFrom?: IProjectionNode;
    isPresent?: boolean;
    addEventListener(name: LayoutEvents, handler: any): VoidFunction;
    notifyListeners(name: LayoutEvents, ...args: any): void;
    hasListeners(name: LayoutEvents): boolean;
    hasTreeAnimated: boolean;
    preserveOpacity?: boolean;
}
interface ProjectionNodeOptions {
    animate?: boolean;
    layoutScroll?: boolean;
    layoutRoot?: boolean;
    alwaysMeasureLayout?: boolean;
    onExitComplete?: VoidFunction;
    animationType?: "size" | "position" | "both" | "preserve-aspect";
    layoutId?: string;
    layout?: boolean | string;
    visualElement?: VisualElement;
    crossfade?: boolean;
    transition?: Transition;
    initialPromotionConfig?: InitialPromotionConfig;
}

type AnimationType = "animate" | "whileHover" | "whileTap" | "whileDrag" | "whileFocus" | "whileInView" | "exit";

type VisualElementAnimationOptions = {
    delay?: number;
    transitionOverride?: Transition;
    custom?: any;
    type?: AnimationType;
};

interface AnimationState {
    animateChanges: (type?: AnimationType) => Promise<any>;
    setActive: (type: AnimationType, isActive: boolean, options?: VisualElementAnimationOptions) => Promise<any>;
    setAnimateFunction: (fn: any) => void;
    getState: () => {
        [key: string]: AnimationTypeState;
    };
    reset: () => void;
}
interface AnimationTypeState {
    isActive: boolean;
    protectedKeys: {
        [key: string]: true;
    };
    needsAnimating: {
        [key: string]: boolean;
    };
    prevResolvedValues: {
        [key: string]: any;
    };
    prevProp?: VariantLabels | TargetAndTransition;
}

/**
 * A VisualElement is an imperative abstraction around UI elements such as
 * HTMLElement, SVGElement, Three.Object3D etc.
 */
declare abstract class VisualElement<Instance = unknown, RenderState = unknown, Options extends {} = {}> {
    /**
     * VisualElements are arranged in trees mirroring that of the React tree.
     * Each type of VisualElement has a unique name, to detect when we're crossing
     * type boundaries within that tree.
     */
    abstract type: string;
    /**
     * An `Array.sort` compatible function that will compare two Instances and
     * compare their respective positions within the tree.
     */
    abstract sortInstanceNodePosition(a: Instance, b: Instance): number;
    /**
     * Measure the viewport-relative bounding box of the Instance.
     */
    abstract measureInstanceViewportBox(instance: Instance, props: MotionProps & Partial<MotionConfigContext>): Box;
    /**
     * When a value has been removed from all animation props we need to
     * pick a target to animate back to. For instance, for HTMLElements
     * we can look in the style prop.
     */
    abstract getBaseTargetFromProps(props: MotionProps, key: string): AnyResolvedKeyframe | undefined | MotionValue;
    /**
     * When we first animate to a value we need to animate it *from* a value.
     * Often this have been specified via the initial prop but it might be
     * that the value needs to be read from the Instance.
     */
    abstract readValueFromInstance(instance: Instance, key: string, options: Options): AnyResolvedKeyframe | null | undefined;
    /**
     * When a value has been removed from the VisualElement we use this to remove
     * it from the inherting class' unique render state.
     */
    abstract removeValueFromRenderState(key: string, renderState: RenderState): void;
    /**
     * Run before a React or VisualElement render, builds the latest motion
     * values into an Instance-specific format. For example, HTMLVisualElement
     * will use this step to build `style` and `var` values.
     */
    abstract build(renderState: RenderState, latestValues: ResolvedValues, props: MotionProps): void;
    /**
     * Apply the built values to the Instance. For example, HTMLElements will have
     * styles applied via `setProperty` and the style attribute, whereas SVGElements
     * will have values applied to attributes.
     */
    abstract renderInstance(instance: Instance, renderState: RenderState, styleProp?: MotionStyle, projection?: IProjectionNode): void;
    /**
     * This method is called when a transform property is bound to a motion value.
     * It's currently used to measure SVG elements when a new transform property is bound.
     */
    onBindTransform?(): void;
    /**
     * If the component child is provided as a motion value, handle subscriptions
     * with the renderer-specific VisualElement.
     */
    handleChildMotionValue?(): void;
    /**
     * This method takes React props and returns found MotionValues. For example, HTML
     * MotionValues will be found within the style prop, whereas for Three.js within attribute arrays.
     *
     * This isn't an abstract method as it needs calling in the constructor, but it is
     * intended to be one.
     */
    scrapeMotionValuesFromProps(_props: MotionProps, _prevProps: MotionProps, _visualElement: VisualElement): {
        [key: string]: MotionValue | AnyResolvedKeyframe;
    };
    /**
     * A reference to the current underlying Instance, e.g. a HTMLElement
     * or Three.Mesh etc.
     */
    current: Instance | null;
    /**
     * A reference to the parent VisualElement (if exists).
     */
    parent: VisualElement | undefined;
    /**
     * A set containing references to this VisualElement's children.
     */
    children: Set<VisualElement<unknown, unknown, {}>>;
    /**
     * A set containing the latest children of this VisualElement. This is flushed
     * at the start of every commit. We use it to calculate the stagger delay
     * for newly-added children.
     */
    enteringChildren?: Set<VisualElement>;
    /**
     * The depth of this VisualElement within the overall VisualElement tree.
     */
    depth: number;
    /**
     * The current render state of this VisualElement. Defined by inherting VisualElements.
     */
    renderState: RenderState;
    /**
     * An object containing the latest static values for each of this VisualElement's
     * MotionValues.
     */
    latestValues: ResolvedValues;
    /**
     * Determine what role this visual element should take in the variant tree.
     */
    isVariantNode: boolean;
    isControllingVariants: boolean;
    /**
     * If this component is part of the variant tree, it should track
     * any children that are also part of the tree. This is essentially
     * a shadow tree to simplify logic around how to stagger over children.
     */
    variantChildren?: Set<VisualElement>;
    /**
     * Decides whether this VisualElement should animate in reduced motion
     * mode.
     *
     * TODO: This is currently set on every individual VisualElement but feels
     * like it could be set globally.
     */
    shouldReduceMotion: boolean | null;
    /**
     * Normally, if a component is controlled by a parent's variants, it can
     * rely on that ancestor to trigger animations further down the tree.
     * However, if a component is created after its parent is mounted, the parent
     * won't trigger that mount animation so the child needs to.
     *
     * TODO: This might be better replaced with a method isParentMounted
     */
    manuallyAnimateOnMount: boolean;
    /**
     * This can be set by AnimatePresence to force components that mount
     * at the same time as it to mount as if they have initial={false} set.
     */
    blockInitialAnimation: boolean;
    /**
     * A reference to this VisualElement's projection node, used in layout animations.
     */
    projection?: IProjectionNode;
    /**
     * A map of all motion values attached to this visual element. Motion
     * values are source of truth for any given animated value. A motion
     * value might be provided externally by the component via props.
     */
    values: Map<string, MotionValue<any>>;
    /**
     * The AnimationState, this is hydrated by the animation Feature.
     */
    animationState?: AnimationState;
    KeyframeResolver: typeof KeyframeResolver;
    /**
     * The options used to create this VisualElement. The Options type is defined
     * by the inheriting VisualElement and is passed straight through to the render functions.
     */
    readonly options: Options;
    /**
     * A reference to the latest props provided to the VisualElement's host React component.
     */
    props: MotionProps;
    prevProps?: MotionProps;
    presenceContext: PresenceContextProps | null;
    prevPresenceContext?: PresenceContextProps | null;
    /**
     * Cleanup functions for active features (hover/tap/exit etc)
     */
    private features;
    /**
     * A map of every subscription that binds the provided or generated
     * motion values onChange listeners to this visual element.
     */
    private valueSubscriptions;
    /**
     * A reference to the ReducedMotionConfig passed to the VisualElement's host React component.
     */
    private reducedMotionConfig;
    /**
     * On mount, this will be hydrated with a callback to disconnect
     * this visual element from its parent on unmount.
     */
    private removeFromVariantTree;
    /**
     * A reference to the previously-provided motion values as returned
     * from scrapeMotionValuesFromProps. We use the keys in here to determine
     * if any motion values need to be removed after props are updated.
     */
    private prevMotionValues;
    /**
     * When values are removed from all animation props we need to search
     * for a fallback value to animate to. These values are tracked in baseTarget.
     */
    private baseTarget;
    /**
     * Create an object of the values we initially animated from (if initial prop present).
     */
    private initialValues;
    /**
     * An object containing a SubscriptionManager for each active event.
     */
    private events;
    /**
     * An object containing an unsubscribe function for each prop event subscription.
     * For example, every "Update" event can have multiple subscribers via
     * VisualElement.on(), but only one of those can be defined via the onUpdate prop.
     */
    private propEventSubscriptions;
    constructor({ parent, props, presenceContext, reducedMotionConfig, blockInitialAnimation, visualState, }: VisualElementOptions<Instance, RenderState>, options?: Options);
    mount(instance: Instance): void;
    unmount(): void;
    addChild(child: VisualElement): void;
    removeChild(child: VisualElement): void;
    private bindToMotionValue;
    sortNodePosition(other: VisualElement<Instance>): number;
    updateFeatures(): void;
    notifyUpdate: () => void;
    triggerBuild(): void;
    render: () => void;
    private renderScheduledAt;
    scheduleRender: () => void;
    /**
     * Measure the current viewport box with or without transforms.
     * Only measures axis-aligned boxes, rotate and skew must be manually
     * removed with a re-render to work.
     */
    measureViewportBox(): Box;
    getStaticValue(key: string): AnyResolvedKeyframe;
    setStaticValue(key: string, value: AnyResolvedKeyframe): void;
    /**
     * Update the provided props. Ensure any newly-added motion values are
     * added to our map, old ones removed, and listeners updated.
     */
    update(props: MotionProps, presenceContext: PresenceContextProps | null): void;
    getProps(): MotionProps;
    /**
     * Returns the variant definition with a given name.
     */
    getVariant(name: string): motion_dom.Variant | undefined;
    /**
     * Returns the defined default transition on this component.
     */
    getDefaultTransition(): motion_dom.Transition<any> | undefined;
    getTransformPagePoint(): any;
    getClosestVariantNode(): VisualElement | undefined;
    /**
     * Add a child visual element to our set of children.
     */
    addVariantChild(child: VisualElement): (() => boolean) | undefined;
    /**
     * Add a motion value and bind it to this visual element.
     */
    addValue(key: string, value: MotionValue): void;
    /**
     * Remove a motion value and unbind any active subscriptions.
     */
    removeValue(key: string): void;
    /**
     * Check whether we have a motion value for this key
     */
    hasValue(key: string): boolean;
    /**
     * Get a motion value for this key. If called with a default
     * value, we'll create one if none exists.
     */
    getValue(key: string): MotionValue | undefined;
    getValue(key: string, defaultValue: AnyResolvedKeyframe | null): MotionValue;
    /**
     * If we're trying to animate to a previously unencountered value,
     * we need to check for it in our state and as a last resort read it
     * directly from the instance (which might have performance implications).
     */
    readValue(key: string, target?: AnyResolvedKeyframe | null): any;
    /**
     * Set the base target to later animate back to. This is currently
     * only hydrated on creation and when we first read a value.
     */
    setBaseTarget(key: string, value: AnyResolvedKeyframe): void;
    /**
     * Find the base target for a value thats been removed from all animation
     * props.
     */
    getBaseTarget(key: string): ResolvedValues[string] | undefined | null;
    on<EventName extends keyof VisualElementEventCallbacks>(eventName: EventName, callback: VisualElementEventCallbacks[EventName]): VoidFunction;
    notify<EventName extends keyof VisualElementEventCallbacks>(eventName: EventName, ...args: any): void;
    scheduleRenderMicrotask(): void;
}

type ScrapeMotionValuesFromProps = (props: MotionProps, prevProps: MotionProps, visualElement?: VisualElement) => {
    [key: string]: MotionValue | AnyResolvedKeyframe;
};
interface VisualElementOptions<Instance, RenderState = any> {
    visualState: VisualState<Instance, RenderState>;
    parent?: VisualElement<unknown>;
    variantParent?: VisualElement<unknown>;
    presenceContext: PresenceContextProps | null;
    props: MotionProps;
    blockInitialAnimation?: boolean;
    reducedMotionConfig?: ReducedMotionConfig;
}
/**
 * A generic set of string/number values
 */
interface ResolvedValues {
    [key: string]: AnyResolvedKeyframe;
}
interface VisualElementEventCallbacks {
    BeforeLayoutMeasure: () => void;
    LayoutMeasure: (layout: Box, prevLayout?: Box) => void;
    LayoutUpdate: (layout: Axis, prevLayout: Axis) => void;
    Update: (latest: ResolvedValues) => void;
    AnimationStart: (definition: AnimationDefinition) => void;
    AnimationComplete: (definition: AnimationDefinition) => void;
    LayoutAnimationStart: () => void;
    LayoutAnimationComplete: () => void;
    SetAxisTarget: () => void;
    Unmount: () => void;
}
type CreateVisualElement<Props = {}, TagName extends keyof DOMMotionComponents | string = "div"> = (Component: TagName | string | React.ComponentType<Props>, options: VisualElementOptions<HTMLElement | SVGElement>) => VisualElement<HTMLElement | SVGElement>;

declare const optimizedAppearDataAttribute: "data-framer-appear-id";

/**
 * Expose only the needed part of the VisualElement interface to
 * ensure React types don't end up in the generic DOM bundle.
 */
interface WithAppearProps {
    props: {
        [optimizedAppearDataAttribute]?: string;
        values?: {
            [key: string]: MotionValue<number> | MotionValue<string>;
        };
    };
}
type HandoffFunction = (storeId: string, valueName: string, frame: Batcher) => number | null;
/**
 * The window global object acts as a bridge between our inline script
 * triggering the optimized appear animations, and Motion.
 */
declare global {
    interface Window {
        MotionHandoffAnimation?: HandoffFunction;
        MotionHandoffMarkAsComplete?: (elementId: string) => void;
        MotionHandoffIsComplete?: (elementId: string) => boolean;
        MotionHasOptimisedAnimation?: (elementId?: string, valueName?: string) => boolean;
        MotionCancelOptimisedAnimation?: (elementId?: string, valueName?: string, frame?: Batcher, canResume?: boolean) => void;
        MotionCheckAppearSync?: (visualElement: WithAppearProps, valueName: string, value: MotionValue) => VoidFunction | void;
        MotionIsMounted?: boolean;
    }
}

export { type AnimationType as A, type CreateVisualElement as C, type DOMMotionComponents as D, type ForwardRefComponent as F, type HTMLElements as H, type IProjectionNode as I, type MotionProps as M, PresenceContext as P, type ResolvedValues as R, type SVGMotionComponents as S, type VariantLabels as V, VisualElement as a, MotionConfigContext as b, type HTMLMotionProps as c, type HTMLMotionComponents as d, type VisualElementAnimationOptions as e, type HTMLRenderState as f, type ScrapeMotionValuesFromProps as g, type VisualState as h, SwitchLayoutGroupContext as i, type MotionStyle as j, type MotionTransform as k, type SVGAttributesAsMotionValues as l, makeUseVisualState as m, type SVGMotionProps as n, optimizedAppearDataAttribute as o, FlatTree as p };
