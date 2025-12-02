import { Box, Easing, EasingFunction, BezierDefinition, Point, BoundingBox, Axis } from 'motion-utils';

interface SVGAttributes {
    accentHeight?: AnyResolvedKeyframe | undefined;
    accumulate?: "none" | "sum" | undefined;
    additive?: "replace" | "sum" | undefined;
    alignmentBaseline?: "auto" | "baseline" | "before-edge" | "text-before-edge" | "middle" | "central" | "after-edge" | "text-after-edge" | "ideographic" | "alphabetic" | "hanging" | "mathematical" | "inherit" | undefined;
    allowReorder?: "no" | "yes" | undefined;
    alphabetic?: AnyResolvedKeyframe | undefined;
    amplitude?: AnyResolvedKeyframe | undefined;
    arabicForm?: "initial" | "medial" | "terminal" | "isolated" | undefined;
    ascent?: AnyResolvedKeyframe | undefined;
    attributeName?: string | undefined;
    attributeType?: string | undefined;
    autoReverse?: boolean | undefined;
    azimuth?: AnyResolvedKeyframe | undefined;
    baseFrequency?: AnyResolvedKeyframe | undefined;
    baselineShift?: AnyResolvedKeyframe | undefined;
    baseProfile?: AnyResolvedKeyframe | undefined;
    bbox?: AnyResolvedKeyframe | undefined;
    begin?: AnyResolvedKeyframe | undefined;
    bias?: AnyResolvedKeyframe | undefined;
    by?: AnyResolvedKeyframe | undefined;
    calcMode?: AnyResolvedKeyframe | undefined;
    capHeight?: AnyResolvedKeyframe | undefined;
    clip?: AnyResolvedKeyframe | undefined;
    clipPath?: string | undefined;
    clipPathUnits?: AnyResolvedKeyframe | undefined;
    clipRule?: AnyResolvedKeyframe | undefined;
    colorInterpolation?: AnyResolvedKeyframe | undefined;
    colorInterpolationFilters?: "auto" | "sRGB" | "linearRGB" | "inherit" | undefined;
    colorProfile?: AnyResolvedKeyframe | undefined;
    colorRendering?: AnyResolvedKeyframe | undefined;
    contentScriptType?: AnyResolvedKeyframe | undefined;
    contentStyleType?: AnyResolvedKeyframe | undefined;
    cursor?: AnyResolvedKeyframe | undefined;
    cx?: AnyResolvedKeyframe | undefined;
    cy?: AnyResolvedKeyframe | undefined;
    d?: string | undefined;
    decelerate?: AnyResolvedKeyframe | undefined;
    descent?: AnyResolvedKeyframe | undefined;
    diffuseConstant?: AnyResolvedKeyframe | undefined;
    direction?: AnyResolvedKeyframe | undefined;
    display?: AnyResolvedKeyframe | undefined;
    divisor?: AnyResolvedKeyframe | undefined;
    dominantBaseline?: AnyResolvedKeyframe | undefined;
    dur?: AnyResolvedKeyframe | undefined;
    dx?: AnyResolvedKeyframe | undefined;
    dy?: AnyResolvedKeyframe | undefined;
    edgeMode?: AnyResolvedKeyframe | undefined;
    elevation?: AnyResolvedKeyframe | undefined;
    enableBackground?: AnyResolvedKeyframe | undefined;
    end?: AnyResolvedKeyframe | undefined;
    exponent?: AnyResolvedKeyframe | undefined;
    externalResourcesRequired?: boolean | undefined;
    fill?: string | undefined;
    fillOpacity?: AnyResolvedKeyframe | undefined;
    fillRule?: "nonzero" | "evenodd" | "inherit" | undefined;
    filter?: string | undefined;
    filterRes?: AnyResolvedKeyframe | undefined;
    filterUnits?: AnyResolvedKeyframe | undefined;
    floodColor?: AnyResolvedKeyframe | undefined;
    floodOpacity?: AnyResolvedKeyframe | undefined;
    focusable?: boolean | "auto" | undefined;
    fontFamily?: string | undefined;
    fontSize?: AnyResolvedKeyframe | undefined;
    fontSizeAdjust?: AnyResolvedKeyframe | undefined;
    fontStretch?: AnyResolvedKeyframe | undefined;
    fontStyle?: AnyResolvedKeyframe | undefined;
    fontVariant?: AnyResolvedKeyframe | undefined;
    fontWeight?: AnyResolvedKeyframe | undefined;
    format?: AnyResolvedKeyframe | undefined;
    fr?: AnyResolvedKeyframe | undefined;
    from?: AnyResolvedKeyframe | undefined;
    fx?: AnyResolvedKeyframe | undefined;
    fy?: AnyResolvedKeyframe | undefined;
    g1?: AnyResolvedKeyframe | undefined;
    g2?: AnyResolvedKeyframe | undefined;
    glyphName?: AnyResolvedKeyframe | undefined;
    glyphOrientationHorizontal?: AnyResolvedKeyframe | undefined;
    glyphOrientationVertical?: AnyResolvedKeyframe | undefined;
    glyphRef?: AnyResolvedKeyframe | undefined;
    gradientTransform?: string | undefined;
    gradientUnits?: string | undefined;
    hanging?: AnyResolvedKeyframe | undefined;
    horizAdvX?: AnyResolvedKeyframe | undefined;
    horizOriginX?: AnyResolvedKeyframe | undefined;
    href?: string | undefined;
    ideographic?: AnyResolvedKeyframe | undefined;
    imageRendering?: AnyResolvedKeyframe | undefined;
    in2?: AnyResolvedKeyframe | undefined;
    in?: string | undefined;
    intercept?: AnyResolvedKeyframe | undefined;
    k1?: AnyResolvedKeyframe | undefined;
    k2?: AnyResolvedKeyframe | undefined;
    k3?: AnyResolvedKeyframe | undefined;
    k4?: AnyResolvedKeyframe | undefined;
    k?: AnyResolvedKeyframe | undefined;
    kernelMatrix?: AnyResolvedKeyframe | undefined;
    kernelUnitLength?: AnyResolvedKeyframe | undefined;
    kerning?: AnyResolvedKeyframe | undefined;
    keyPoints?: AnyResolvedKeyframe | undefined;
    keySplines?: AnyResolvedKeyframe | undefined;
    keyTimes?: AnyResolvedKeyframe | undefined;
    lengthAdjust?: AnyResolvedKeyframe | undefined;
    letterSpacing?: AnyResolvedKeyframe | undefined;
    lightingColor?: AnyResolvedKeyframe | undefined;
    limitingConeAngle?: AnyResolvedKeyframe | undefined;
    local?: AnyResolvedKeyframe | undefined;
    markerEnd?: string | undefined;
    markerHeight?: AnyResolvedKeyframe | undefined;
    markerMid?: string | undefined;
    markerStart?: string | undefined;
    markerUnits?: AnyResolvedKeyframe | undefined;
    markerWidth?: AnyResolvedKeyframe | undefined;
    mask?: string | undefined;
    maskContentUnits?: AnyResolvedKeyframe | undefined;
    maskUnits?: AnyResolvedKeyframe | undefined;
    mathematical?: AnyResolvedKeyframe | undefined;
    mode?: AnyResolvedKeyframe | undefined;
    numOctaves?: AnyResolvedKeyframe | undefined;
    offset?: AnyResolvedKeyframe | undefined;
    opacity?: AnyResolvedKeyframe | undefined;
    operator?: AnyResolvedKeyframe | undefined;
    order?: AnyResolvedKeyframe | undefined;
    orient?: AnyResolvedKeyframe | undefined;
    orientation?: AnyResolvedKeyframe | undefined;
    origin?: AnyResolvedKeyframe | undefined;
    overflow?: AnyResolvedKeyframe | undefined;
    overlinePosition?: AnyResolvedKeyframe | undefined;
    overlineThickness?: AnyResolvedKeyframe | undefined;
    paintOrder?: AnyResolvedKeyframe | undefined;
    panose1?: AnyResolvedKeyframe | undefined;
    path?: string | undefined;
    pathLength?: AnyResolvedKeyframe | undefined;
    patternContentUnits?: string | undefined;
    patternTransform?: AnyResolvedKeyframe | undefined;
    patternUnits?: string | undefined;
    pointerEvents?: AnyResolvedKeyframe | undefined;
    points?: string | undefined;
    pointsAtX?: AnyResolvedKeyframe | undefined;
    pointsAtY?: AnyResolvedKeyframe | undefined;
    pointsAtZ?: AnyResolvedKeyframe | undefined;
    preserveAlpha?: boolean | undefined;
    preserveAspectRatio?: string | undefined;
    primitiveUnits?: AnyResolvedKeyframe | undefined;
    r?: AnyResolvedKeyframe | undefined;
    radius?: AnyResolvedKeyframe | undefined;
    refX?: AnyResolvedKeyframe | undefined;
    refY?: AnyResolvedKeyframe | undefined;
    renderingIntent?: AnyResolvedKeyframe | undefined;
    repeatCount?: AnyResolvedKeyframe | undefined;
    repeatDur?: AnyResolvedKeyframe | undefined;
    requiredExtensions?: AnyResolvedKeyframe | undefined;
    requiredFeatures?: AnyResolvedKeyframe | undefined;
    restart?: AnyResolvedKeyframe | undefined;
    result?: string | undefined;
    rotate?: AnyResolvedKeyframe | undefined;
    rx?: AnyResolvedKeyframe | undefined;
    ry?: AnyResolvedKeyframe | undefined;
    scale?: AnyResolvedKeyframe | undefined;
    seed?: AnyResolvedKeyframe | undefined;
    shapeRendering?: AnyResolvedKeyframe | undefined;
    slope?: AnyResolvedKeyframe | undefined;
    spacing?: AnyResolvedKeyframe | undefined;
    specularConstant?: AnyResolvedKeyframe | undefined;
    specularExponent?: AnyResolvedKeyframe | undefined;
    speed?: AnyResolvedKeyframe | undefined;
    spreadMethod?: string | undefined;
    startOffset?: AnyResolvedKeyframe | undefined;
    stdDeviation?: AnyResolvedKeyframe | undefined;
    stemh?: AnyResolvedKeyframe | undefined;
    stemv?: AnyResolvedKeyframe | undefined;
    stitchTiles?: AnyResolvedKeyframe | undefined;
    stopColor?: string | undefined;
    stopOpacity?: AnyResolvedKeyframe | undefined;
    strikethroughPosition?: AnyResolvedKeyframe | undefined;
    strikethroughThickness?: AnyResolvedKeyframe | undefined;
    string?: AnyResolvedKeyframe | undefined;
    stroke?: string | undefined;
    strokeDasharray?: AnyResolvedKeyframe | undefined;
    strokeDashoffset?: AnyResolvedKeyframe | undefined;
    strokeLinecap?: "butt" | "round" | "square" | "inherit" | undefined;
    strokeLinejoin?: "miter" | "round" | "bevel" | "inherit" | undefined;
    strokeMiterlimit?: AnyResolvedKeyframe | undefined;
    strokeOpacity?: AnyResolvedKeyframe | undefined;
    strokeWidth?: AnyResolvedKeyframe | undefined;
    surfaceScale?: AnyResolvedKeyframe | undefined;
    systemLanguage?: AnyResolvedKeyframe | undefined;
    tableValues?: AnyResolvedKeyframe | undefined;
    targetX?: AnyResolvedKeyframe | undefined;
    targetY?: AnyResolvedKeyframe | undefined;
    textAnchor?: string | undefined;
    textDecoration?: AnyResolvedKeyframe | undefined;
    textLength?: AnyResolvedKeyframe | undefined;
    textRendering?: AnyResolvedKeyframe | undefined;
    to?: AnyResolvedKeyframe | undefined;
    transform?: string | undefined;
    u1?: AnyResolvedKeyframe | undefined;
    u2?: AnyResolvedKeyframe | undefined;
    underlinePosition?: AnyResolvedKeyframe | undefined;
    underlineThickness?: AnyResolvedKeyframe | undefined;
    unicode?: AnyResolvedKeyframe | undefined;
    unicodeBidi?: AnyResolvedKeyframe | undefined;
    unicodeRange?: AnyResolvedKeyframe | undefined;
    unitsPerEm?: AnyResolvedKeyframe | undefined;
    vAlphabetic?: AnyResolvedKeyframe | undefined;
    values?: string | undefined;
    vectorEffect?: AnyResolvedKeyframe | undefined;
    version?: string | undefined;
    vertAdvY?: AnyResolvedKeyframe | undefined;
    vertOriginX?: AnyResolvedKeyframe | undefined;
    vertOriginY?: AnyResolvedKeyframe | undefined;
    vHanging?: AnyResolvedKeyframe | undefined;
    vIdeographic?: AnyResolvedKeyframe | undefined;
    viewBox?: string | undefined;
    viewTarget?: AnyResolvedKeyframe | undefined;
    visibility?: AnyResolvedKeyframe | undefined;
    vMathematical?: AnyResolvedKeyframe | undefined;
    widths?: AnyResolvedKeyframe | undefined;
    wordSpacing?: AnyResolvedKeyframe | undefined;
    writingMode?: AnyResolvedKeyframe | undefined;
    x1?: AnyResolvedKeyframe | undefined;
    x2?: AnyResolvedKeyframe | undefined;
    x?: AnyResolvedKeyframe | undefined;
    xChannelSelector?: string | undefined;
    xHeight?: AnyResolvedKeyframe | undefined;
    xlinkActuate?: string | undefined;
    xlinkArcrole?: string | undefined;
    xlinkHref?: string | undefined;
    xlinkRole?: string | undefined;
    xlinkShow?: string | undefined;
    xlinkTitle?: string | undefined;
    xlinkType?: string | undefined;
    xmlBase?: string | undefined;
    xmlLang?: string | undefined;
    xmlns?: string | undefined;
    xmlnsXlink?: string | undefined;
    xmlSpace?: string | undefined;
    y1?: AnyResolvedKeyframe | undefined;
    y2?: AnyResolvedKeyframe | undefined;
    y?: AnyResolvedKeyframe | undefined;
    yChannelSelector?: string | undefined;
    z?: AnyResolvedKeyframe | undefined;
    zoomAndPan?: string | undefined;
}

/**
 * An update function. It accepts a timestamp used to advance the animation.
 */
type Update$1 = (timestamp: number) => void;
/**
 * Drivers accept a update function and call it at an interval. This interval
 * could be a synchronous loop, a setInterval, or tied to the device's framerate.
 */
interface DriverControls {
    start: (keepAlive?: boolean) => void;
    stop: () => void;
    now: () => number;
}
type Driver = (update: Update$1) => DriverControls;

/**
 * Temporary subset of VisualElement until VisualElement is
 * moved to motion-dom
 */
interface WithRender {
    render: () => void;
    readValue: (name: string, keyframe: any) => any;
    getValue: (name: string, defaultValue?: any) => any;
    current?: HTMLElement | SVGElement;
    measureViewportBox: () => Box;
}

type AnyResolvedKeyframe = string | number;
interface ProgressTimeline {
    currentTime: null | {
        value: number;
    };
    cancel?: VoidFunction;
}
interface ValueAnimationOptionsWithRenderContext<V extends AnyResolvedKeyframe = number> extends ValueAnimationOptions<V> {
    KeyframeResolver?: typeof KeyframeResolver;
    motionValue?: MotionValue<V>;
    element?: WithRender;
}
interface TimelineWithFallback {
    timeline?: ProgressTimeline;
    observe: (animation: AnimationPlaybackControls) => VoidFunction;
}
/**
 * Methods to control an animation.
 */
interface AnimationPlaybackControls {
    /**
     * The current time of the animation, in seconds.
     */
    time: number;
    /**
     * The playback speed of the animation.
     * 1 = normal speed, 2 = double speed, 0.5 = half speed.
     */
    speed: number;
    /**
     * The start time of the animation, in milliseconds.
     */
    startTime: number | null;
    /**
     * The state of the animation.
     *
     * This is currently for internal use only.
     */
    state: AnimationPlayState;
    duration: number;
    /**
     * The duration of the animation, including any delay.
     */
    iterationDuration: number;
    /**
     * Stops the animation at its current state, and prevents it from
     * resuming when the animation is played again.
     */
    stop: () => void;
    /**
     * Plays the animation.
     */
    play: () => void;
    /**
     * Pauses the animation.
     */
    pause: () => void;
    /**
     * Completes the animation and applies the final state.
     */
    complete: () => void;
    /**
     * Cancels the animation and applies the initial state.
     */
    cancel: () => void;
    /**
     * Attaches a timeline to the animation, for instance the `ScrollTimeline`.
     *
     * This is currently for internal use only.
     */
    attachTimeline: (timeline: TimelineWithFallback) => VoidFunction;
    finished: Promise<any>;
}
type AnimationPlaybackControlsWithThen = AnimationPlaybackControls & {
    then: (onResolve: VoidFunction, onReject?: VoidFunction) => Promise<void>;
};
interface AnimationState<V> {
    value: V;
    done: boolean;
}
interface KeyframeGenerator<V> {
    calculatedDuration: null | number;
    next: (t: number) => AnimationState<V>;
    toString: () => string;
}
interface DOMValueAnimationOptions<V extends AnyResolvedKeyframe = number> extends ValueAnimationTransition<V> {
    element: HTMLElement | SVGElement;
    keyframes: ValueKeyframesDefinition;
    name: string;
    pseudoElement?: string;
    allowFlatten?: boolean;
}
interface ValueAnimationOptions<V extends AnyResolvedKeyframe = number> extends ValueAnimationTransition {
    keyframes: V[];
    element?: any;
    name?: string;
    motionValue?: MotionValue<V>;
    from?: any;
    isHandoff?: boolean;
    allowFlatten?: boolean;
    finalKeyframe?: V;
}
type GeneratorFactoryFunction = (options: ValueAnimationOptions<any>) => KeyframeGenerator<any>;
interface GeneratorFactory extends GeneratorFactoryFunction {
    applyToOptions?: (options: Transition) => Transition;
}
type AnimationGeneratorName = "decay" | "spring" | "keyframes" | "tween" | "inertia";
type AnimationGeneratorType = GeneratorFactory | AnimationGeneratorName | false;
interface AnimationPlaybackLifecycles<V> {
    onUpdate?: (latest: V) => void;
    onPlay?: () => void;
    onComplete?: () => void;
    onRepeat?: () => void;
    onStop?: () => void;
}
interface ValueAnimationTransition<V = any> extends ValueTransition, AnimationPlaybackLifecycles<V> {
    isSync?: boolean;
}
type RepeatType = "loop" | "reverse" | "mirror";
interface AnimationPlaybackOptions {
    /**
     * The number of times to repeat the transition. Set to `Infinity` for perpetual repeating.
     *
     * Without setting `repeatType`, this will loop the animation.
     *
     * @public
     */
    repeat?: number;
    /**
     * How to repeat the animation. This can be either:
     *
     * "loop": Repeats the animation from the start
     *
     * "reverse": Alternates between forward and backwards playback
     *
     * "mirror": Switches `from` and `to` alternately
     *
     * @public
     */
    repeatType?: RepeatType;
    /**
     * When repeating an animation, `repeatDelay` will set the
     * duration of the time to wait, in seconds, between each repetition.
     *
     * @public
     */
    repeatDelay?: number;
}
interface VelocityOptions {
    velocity?: number;
    /**
     * End animation if absolute speed (in units per second) drops below this
     * value and delta is smaller than `restDelta`. Set to `0.01` by default.
     *
     * @public
     */
    restSpeed?: number;
    /**
     * End animation if distance is below this value and speed is below
     * `restSpeed`. When animation ends, spring gets "snapped" to. Set to
     * `0.01` by default.
     *
     * @public
     */
    restDelta?: number;
}
interface DurationSpringOptions {
    /**
     * The total duration of the animation. Set to `0.3` by default.
     *
     * @public
     */
    duration?: number;
    /**
     * If visualDuration is set, this will override duration.
     *
     * The visual duration is a time, set in seconds, that the animation will take to visually appear to reach its target.
     *
     * In other words, the bulk of the transition will occur before this time, and the "bouncy bit" will mostly happen after.
     *
     * This makes it easier to edit a spring, as well as visually coordinate it with other time-based animations.
     *
     * @public
     */
    visualDuration?: number;
    /**
     * `bounce` determines the "bounciness" of a spring animation.
     *
     * `0` is no bounce, and `1` is extremely bouncy.
     *
     * If `duration` is set, this defaults to `0.25`.
     *
     * Note: `bounce` and `duration` will be overridden if `stiffness`, `damping` or `mass` are set.
     *
     * @public
     */
    bounce?: number;
}
interface SpringOptions extends DurationSpringOptions, VelocityOptions {
    /**
     * Stiffness of the spring. Higher values will create more sudden movement.
     * Set to `100` by default.
     *
     * @public
     */
    stiffness?: number;
    /**
     * Strength of opposing force. If set to 0, spring will oscillate
     * indefinitely. Set to `10` by default.
     *
     * @public
     */
    damping?: number;
    /**
     * Mass of the moving object. Higher values will result in more lethargic
     * movement. Set to `1` by default.
     *
     * @public
     */
    mass?: number;
}
/**
 * @deprecated Use SpringOptions instead
 */
interface Spring extends SpringOptions {
}
interface DecayOptions extends VelocityOptions {
    keyframes?: number[];
    /**
     * A higher power value equals a further target. Set to `0.8` by default.
     *
     * @public
     */
    power?: number;
    /**
     * Adjusting the time constant will change the duration of the
     * deceleration, thereby affecting its feel. Set to `700` by default.
     *
     * @public
     */
    timeConstant?: number;
    /**
     * A function that receives the automatically-calculated target and returns a new one. Useful for snapping the target to a grid.
     *
     * @public
     */
    modifyTarget?: (v: number) => number;
}
interface InertiaOptions extends DecayOptions {
    /**
     * If `min` or `max` is set, this affects the stiffness of the bounce
     * spring. Higher values will create more sudden movement. Set to `500` by
     * default.
     *
     * @public
     */
    bounceStiffness?: number;
    /**
     * If `min` or `max` is set, this affects the damping of the bounce spring.
     * If set to `0`, spring will oscillate indefinitely. Set to `10` by
     * default.
     *
     * @public
     */
    bounceDamping?: number;
    /**
     * Minimum constraint. If set, the value will "bump" against this value (or immediately spring to it if the animation starts as less than this value).
     *
     * @public
     */
    min?: number;
    /**
     * Maximum constraint. If set, the value will "bump" against this value (or immediately snap to it, if the initial animation value exceeds this value).
     *
     * @public
     */
    max?: number;
}
interface AnimationOrchestrationOptions {
    /**
     * Delay the animation by this duration (in seconds). Defaults to `0`.
     *
     * @public
     */
    delay?: number;
    /**
     * Describes the relationship between the transition and its children. Set
     * to `false` by default.
     *
     * @remarks
     * When using variants, the transition can be scheduled in relation to its
     * children with either `"beforeChildren"` to finish this transition before
     * starting children transitions, `"afterChildren"` to finish children
     * transitions before starting this transition.
     *
     * @public
     */
    when?: false | "beforeChildren" | "afterChildren" | string;
    /**
     * When using variants, children animations will start after this duration
     * (in seconds). You can add the `transition` property to both the `motion.div` and the
     * `variant` directly. Adding it to the `variant` generally offers more flexibility,
     * as it allows you to customize the delay per visual state.
     *
     * @public
     */
    delayChildren?: number | DynamicOption<number>;
    /**
     * When using variants, animations of child components can be staggered by this
     * duration (in seconds).
     *
     * For instance, if `staggerChildren` is `0.01`, the first child will be
     * delayed by `0` seconds, the second by `0.01`, the third by `0.02` and so
     * on.
     *
     * The calculated stagger delay will be added to `delayChildren`.
     *
     * @deprecated - Use `delayChildren: stagger(interval)` instead.
     */
    staggerChildren?: number;
    /**
     * The direction in which to stagger children.
     *
     * A value of `1` staggers from the first to the last while `-1`
     * staggers from the last to the first.
     *
     * @deprecated - Use `delayChildren: stagger(interval, { from: "last" })` instead.
     */
    staggerDirection?: number;
}
interface KeyframeOptions {
    /**
     * The total duration of the animation. Set to `0.3` by default.
     *
     * @public
     */
    duration?: number;
    ease?: Easing | Easing[];
    times?: number[];
}
interface ValueTransition extends AnimationOrchestrationOptions, AnimationPlaybackOptions, Omit<SpringOptions, "keyframes">, Omit<InertiaOptions, "keyframes">, KeyframeOptions {
    /**
     * Delay the animation by this duration (in seconds). Defaults to `0`.
     *
     * @public
     */
    delay?: number;
    /**
     * The duration of time already elapsed in the animation. Set to `0` by
     * default.
     */
    elapsed?: number;
    driver?: Driver;
    /**
     * Type of animation to use.
     *
     * - "tween": Duration-based animation with ease curve
     * - "spring": Physics or duration-based spring animation
     * - false: Use an instant animation
     */
    type?: AnimationGeneratorType;
    /**
     * The duration of the tween animation. Set to `0.3` by default, 0r `0.8` if animating a series of keyframes.
     *
     * @public
     */
    duration?: number;
    autoplay?: boolean;
    startTime?: number;
    from?: any;
}
/**
 * @deprecated Use KeyframeOptions instead
 */
interface Tween extends KeyframeOptions {
}
type SVGForcedAttrTransitions = {
    [K in keyof SVGForcedAttrProperties]: ValueTransition;
};
type SVGPathTransitions = {
    [K in keyof SVGPathProperties]: ValueTransition;
};
type SVGTransitions = {
    [K in keyof Omit<SVGAttributes, "from">]: ValueTransition;
};
interface VariableTransitions {
    [key: `--${string}`]: ValueTransition;
}
type StyleTransitions = {
    [K in keyof CSSStyleDeclarationWithTransform]?: ValueTransition;
};
type ValueKeyframe<T extends AnyResolvedKeyframe = AnyResolvedKeyframe> = T;
type UnresolvedValueKeyframe<T extends AnyResolvedKeyframe = AnyResolvedKeyframe> = ValueKeyframe<T> | null;
type ResolvedValueKeyframe = ValueKeyframe | ValueKeyframe[];
type ValueKeyframesDefinition = ValueKeyframe | ValueKeyframe[] | UnresolvedValueKeyframe[];
type StyleKeyframesDefinition = {
    [K in keyof CSSStyleDeclarationWithTransform]?: ValueKeyframesDefinition;
};
type SVGKeyframesDefinition = {
    [K in keyof Omit<SVGAttributes, "from">]?: ValueKeyframesDefinition;
};
interface VariableKeyframesDefinition {
    [key: `--${string}`]: ValueKeyframesDefinition;
}
type SVGForcedAttrKeyframesDefinition = {
    [K in keyof SVGForcedAttrProperties]?: ValueKeyframesDefinition;
};
type SVGPathKeyframesDefinition = {
    [K in keyof SVGPathProperties]?: ValueKeyframesDefinition;
};
type DOMKeyframesDefinition = StyleKeyframesDefinition & SVGKeyframesDefinition & SVGPathKeyframesDefinition & SVGForcedAttrKeyframesDefinition & VariableKeyframesDefinition;
interface Target extends DOMKeyframesDefinition {
}
type CSSPropertyKeys = {
    [K in keyof CSSStyleDeclaration as K extends string ? CSSStyleDeclaration[K] extends AnyResolvedKeyframe ? K : never : never]: CSSStyleDeclaration[K];
};
interface CSSStyleDeclarationWithTransform extends Omit<CSSPropertyKeys, "direction" | "transition" | "x" | "y" | "z"> {
    x: number | string;
    y: number | string;
    z: number | string;
    originX: number;
    originY: number;
    originZ: number;
    translateX: number | string;
    translateY: number | string;
    translateZ: number | string;
    rotateX: number | string;
    rotateY: number | string;
    rotateZ: number | string;
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    skewX: number | string;
    skewY: number | string;
    transformPerspective: number;
}
type TransitionWithValueOverrides<V> = ValueAnimationTransition<V> & StyleTransitions & SVGPathTransitions & SVGForcedAttrTransitions & SVGTransitions & VariableTransitions & {
    default?: ValueTransition;
    layout?: ValueTransition;
};
type Transition<V = any> = ValueAnimationTransition<V> | TransitionWithValueOverrides<V>;
type DynamicOption<T> = (i: number, total: number) => T;
type ValueAnimationWithDynamicDelay = Omit<ValueAnimationTransition<any>, "delay"> & {
    delay?: number | DynamicOption<number>;
};
type AnimationOptions = ValueAnimationWithDynamicDelay | (ValueAnimationWithDynamicDelay & StyleTransitions & SVGPathTransitions & SVGForcedAttrTransitions & SVGTransitions & VariableTransitions & {
    default?: ValueTransition;
    layout?: ValueTransition;
});
interface TransformProperties {
    x?: AnyResolvedKeyframe;
    y?: AnyResolvedKeyframe;
    z?: AnyResolvedKeyframe;
    translateX?: AnyResolvedKeyframe;
    translateY?: AnyResolvedKeyframe;
    translateZ?: AnyResolvedKeyframe;
    rotate?: AnyResolvedKeyframe;
    rotateX?: AnyResolvedKeyframe;
    rotateY?: AnyResolvedKeyframe;
    rotateZ?: AnyResolvedKeyframe;
    scale?: AnyResolvedKeyframe;
    scaleX?: AnyResolvedKeyframe;
    scaleY?: AnyResolvedKeyframe;
    scaleZ?: AnyResolvedKeyframe;
    skew?: AnyResolvedKeyframe;
    skewX?: AnyResolvedKeyframe;
    skewY?: AnyResolvedKeyframe;
    originX?: AnyResolvedKeyframe;
    originY?: AnyResolvedKeyframe;
    originZ?: AnyResolvedKeyframe;
    perspective?: AnyResolvedKeyframe;
    transformPerspective?: AnyResolvedKeyframe;
}
interface SVGForcedAttrProperties {
    attrX?: number;
    attrY?: number;
    attrScale?: number;
}
interface SVGPathProperties {
    pathLength?: number;
    pathOffset?: number;
    pathSpacing?: number;
}

/**
 * @public
 */
type Subscriber<T> = (v: T) => void;
/**
 * @public
 */
type PassiveEffect<T> = (v: T, safeSetter: (v: T) => void) => void;
type StartAnimation = (complete: () => void) => AnimationPlaybackControlsWithThen | undefined;
interface MotionValueEventCallbacks<V> {
    animationStart: () => void;
    animationComplete: () => void;
    animationCancel: () => void;
    change: (latestValue: V) => void;
    destroy: () => void;
}
interface ResolvedValues$1 {
    [key: string]: AnyResolvedKeyframe;
}
interface Owner {
    current: HTMLElement | unknown;
    getProps: () => {
        onUpdate?: (latest: ResolvedValues$1) => void;
        transformTemplate?: (transform: TransformProperties, generatedTransform: string) => string;
    };
}
interface MotionValueOptions {
    owner?: Owner;
}
declare const collectMotionValues: {
    current: MotionValue[] | undefined;
};
/**
 * `MotionValue` is used to track the state and velocity of motion values.
 *
 * @public
 */
declare class MotionValue<V = any> {
    /**
     * If a MotionValue has an owner, it was created internally within Motion
     * and therefore has no external listeners. It is therefore safe to animate via WAAPI.
     */
    owner?: Owner;
    /**
     * The current state of the `MotionValue`.
     */
    private current;
    /**
     * The previous state of the `MotionValue`.
     */
    private prev;
    /**
     * The previous state of the `MotionValue` at the end of the previous frame.
     */
    private prevFrameValue;
    /**
     * The last time the `MotionValue` was updated.
     */
    updatedAt: number;
    /**
     * The time `prevFrameValue` was updated.
     */
    prevUpdatedAt: number | undefined;
    private stopPassiveEffect?;
    /**
     * Whether the passive effect is active.
     */
    isEffectActive?: boolean;
    /**
     * A reference to the currently-controlling animation.
     */
    animation?: AnimationPlaybackControlsWithThen;
    /**
     * A list of MotionValues whose values are computed from this one.
     * This is a rough start to a proper signal-like dirtying system.
     */
    private dependents;
    /**
     * Tracks whether this value should be removed
     */
    liveStyle?: boolean;
    /**
     * @param init - The initiating value
     * @param config - Optional configuration options
     *
     * -  `transformer`: A function to transform incoming values with.
     */
    constructor(init: V, options?: MotionValueOptions);
    setCurrent(current: V): void;
    setPrevFrameValue(prevFrameValue?: V | undefined): void;
    /**
     * Adds a function that will be notified when the `MotionValue` is updated.
     *
     * It returns a function that, when called, will cancel the subscription.
     *
     * When calling `onChange` inside a React component, it should be wrapped with the
     * `useEffect` hook. As it returns an unsubscribe function, this should be returned
     * from the `useEffect` function to ensure you don't add duplicate subscribers..
     *
     * ```jsx
     * export const MyComponent = () => {
     *   const x = useMotionValue(0)
     *   const y = useMotionValue(0)
     *   const opacity = useMotionValue(1)
     *
     *   useEffect(() => {
     *     function updateOpacity() {
     *       const maxXY = Math.max(x.get(), y.get())
     *       const newOpacity = transform(maxXY, [0, 100], [1, 0])
     *       opacity.set(newOpacity)
     *     }
     *
     *     const unsubscribeX = x.on("change", updateOpacity)
     *     const unsubscribeY = y.on("change", updateOpacity)
     *
     *     return () => {
     *       unsubscribeX()
     *       unsubscribeY()
     *     }
     *   }, [])
     *
     *   return <motion.div style={{ x }} />
     * }
     * ```
     *
     * @param subscriber - A function that receives the latest value.
     * @returns A function that, when called, will cancel this subscription.
     *
     * @deprecated
     */
    onChange(subscription: Subscriber<V>): () => void;
    /**
     * An object containing a SubscriptionManager for each active event.
     */
    private events;
    on<EventName extends keyof MotionValueEventCallbacks<V>>(eventName: EventName, callback: MotionValueEventCallbacks<V>[EventName]): VoidFunction;
    clearListeners(): void;
    /**
     * Attaches a passive effect to the `MotionValue`.
     */
    attach(passiveEffect: PassiveEffect<V>, stopPassiveEffect: VoidFunction): void;
    /**
     * Sets the state of the `MotionValue`.
     *
     * @remarks
     *
     * ```jsx
     * const x = useMotionValue(0)
     * x.set(10)
     * ```
     *
     * @param latest - Latest value to set.
     * @param render - Whether to notify render subscribers. Defaults to `true`
     *
     * @public
     */
    set(v: V): void;
    setWithVelocity(prev: V, current: V, delta: number): void;
    /**
     * Set the state of the `MotionValue`, stopping any active animations,
     * effects, and resets velocity to `0`.
     */
    jump(v: V, endAnimation?: boolean): void;
    dirty(): void;
    addDependent(dependent: MotionValue): void;
    removeDependent(dependent: MotionValue): void;
    updateAndNotify: (v: V) => void;
    /**
     * Returns the latest state of `MotionValue`
     *
     * @returns - The latest state of `MotionValue`
     *
     * @public
     */
    get(): NonNullable<V>;
    /**
     * @public
     */
    getPrevious(): V | undefined;
    /**
     * Returns the latest velocity of `MotionValue`
     *
     * @returns - The latest velocity of `MotionValue`. Returns `0` if the state is non-numerical.
     *
     * @public
     */
    getVelocity(): number;
    hasAnimated: boolean;
    /**
     * Registers a new animation to control this `MotionValue`. Only one
     * animation can drive a `MotionValue` at one time.
     *
     * ```jsx
     * value.start()
     * ```
     *
     * @param animation - A function that starts the provided animation
     */
    start(startAnimation: StartAnimation): Promise<void>;
    /**
     * Stop the currently active animation.
     *
     * @public
     */
    stop(): void;
    /**
     * Returns `true` if this value is currently animating.
     *
     * @public
     */
    isAnimating(): boolean;
    private clearAnimation;
    /**
     * Destroy and clean up subscribers to this `MotionValue`.
     *
     * The `MotionValue` hooks like `useMotionValue` and `useTransform` automatically
     * handle the lifecycle of the returned `MotionValue`, so this method is only necessary if you've manually
     * created a `MotionValue` via the `motionValue` function.
     *
     * @public
     */
    destroy(): void;
}
declare function motionValue<V>(init: V, options?: MotionValueOptions): MotionValue<V>;

type UnresolvedKeyframes<T extends AnyResolvedKeyframe> = Array<T | null>;
type ResolvedKeyframes<T extends AnyResolvedKeyframe> = Array<T>;
declare function flushKeyframeResolvers(): void;
type OnKeyframesResolved<T extends AnyResolvedKeyframe> = (resolvedKeyframes: ResolvedKeyframes<T>, finalKeyframe: T, forced: boolean) => void;
declare class KeyframeResolver<T extends AnyResolvedKeyframe = any> {
    name?: string;
    element?: WithRender;
    finalKeyframe?: T;
    suspendedScrollY?: number;
    protected unresolvedKeyframes: UnresolvedKeyframes<AnyResolvedKeyframe>;
    private motionValue?;
    private onComplete;
    state: "pending" | "scheduled" | "complete";
    /**
     * Track whether this resolver is async. If it is, it'll be added to the
     * resolver queue and flushed in the next frame. Resolvers that aren't going
     * to trigger read/write thrashing don't need to be async.
     */
    private isAsync;
    /**
     * Track whether this resolver needs to perform a measurement
     * to resolve its keyframes.
     */
    needsMeasurement: boolean;
    constructor(unresolvedKeyframes: UnresolvedKeyframes<AnyResolvedKeyframe>, onComplete: OnKeyframesResolved<T>, name?: string, motionValue?: MotionValue<T>, element?: WithRender, isAsync?: boolean);
    scheduleResolve(): void;
    readKeyframes(): void;
    setFinalKeyframe(): void;
    measureInitialState(): void;
    renderEndStyles(): void;
    measureEndState(): void;
    complete(isForcedComplete?: boolean): void;
    cancel(): void;
    resume(): void;
}

declare class WithPromise {
    protected _finished: Promise<void>;
    resolve: VoidFunction;
    constructor();
    get finished(): Promise<void>;
    protected updateFinished(): void;
    protected notifyFinished(): void;
    /**
     * Allows the animation to be awaited.
     *
     * @deprecated Use `finished` instead.
     */
    then(onResolve: VoidFunction, onReject?: VoidFunction): Promise<void>;
}

type OptionsWithoutKeyframes<T extends AnyResolvedKeyframe> = Omit<ValueAnimationOptions<T>, "keyframes">;
declare class AsyncMotionValueAnimation<T extends AnyResolvedKeyframe> extends WithPromise implements AnimationPlaybackControls {
    private createdAt;
    private resolvedAt;
    private _animation;
    private pendingTimeline;
    private keyframeResolver;
    private stopTimeline;
    constructor({ autoplay, delay, type, repeat, repeatDelay, repeatType, keyframes, name, motionValue, element, ...options }: ValueAnimationOptions<T>);
    onKeyframesResolved(keyframes: ResolvedKeyframes<T>, finalKeyframe: T, options: OptionsWithoutKeyframes<T>, sync: boolean): void;
    get finished(): Promise<any>;
    then(onResolve: VoidFunction, _onReject?: VoidFunction): Promise<void>;
    get animation(): AnimationPlaybackControls;
    get duration(): number;
    get iterationDuration(): number;
    get time(): number;
    set time(newTime: number);
    get speed(): number;
    get state(): AnimationPlayState;
    set speed(newSpeed: number);
    get startTime(): number | null;
    attachTimeline(timeline: TimelineWithFallback): () => void;
    play(): void;
    pause(): void;
    complete(): void;
    cancel(): void;
    /**
     * Bound to support return animation.stop pattern
     */
    stop: () => void;
}

type AcceptedAnimations = AnimationPlaybackControls;
type GroupedAnimations = AcceptedAnimations[];
declare class GroupAnimation implements AnimationPlaybackControls {
    animations: GroupedAnimations;
    constructor(animations: Array<AcceptedAnimations | undefined>);
    get finished(): Promise<any[]>;
    /**
     * TODO: Filter out cancelled or stopped animations before returning
     */
    private getAll;
    private setAll;
    attachTimeline(timeline: TimelineWithFallback): () => void;
    get time(): number;
    set time(time: number);
    get speed(): number;
    set speed(speed: number);
    get state(): any;
    get startTime(): any;
    get duration(): number;
    get iterationDuration(): number;
    private runAll;
    play(): void;
    pause(): void;
    stop: () => void;
    cancel(): void;
    complete(): void;
}

declare class GroupAnimationWithThen extends GroupAnimation implements AnimationPlaybackControlsWithThen {
    then(onResolve: VoidFunction, _onReject?: VoidFunction): Promise<void>;
}

declare class JSAnimation<T extends number | string> extends WithPromise implements AnimationPlaybackControlsWithThen {
    state: AnimationPlayState;
    startTime: number | null;
    /**
     * The driver that's controlling the animation loop. Normally this is a requestAnimationFrame loop
     * but in tests we can pass in a synchronous loop.
     */
    private driver?;
    private isStopped;
    private generator;
    private calculatedDuration;
    private resolvedDuration;
    private totalDuration;
    private options;
    /**
     * The current time of the animation.
     */
    private currentTime;
    /**
     * The time at which the animation was paused.
     */
    private holdTime;
    /**
     * Playback speed as a factor. 0 would be stopped, -1 reverse and 2 double speed.
     */
    private playbackSpeed;
    private mixKeyframes;
    private mirroredGenerator;
    constructor(options: ValueAnimationOptions<T>);
    initAnimation(): void;
    updateTime(timestamp: number): void;
    tick(timestamp: number, sample?: boolean): AnimationState<T>;
    /**
     * Allows the returned animation to be awaited or promise-chained. Currently
     * resolves when the animation finishes at all but in a future update could/should
     * reject if its cancels.
     */
    then(resolve: VoidFunction, reject?: VoidFunction): Promise<void>;
    get duration(): number;
    get iterationDuration(): number;
    get time(): number;
    set time(newTime: number);
    get speed(): number;
    set speed(newSpeed: number);
    play(): void;
    pause(): void;
    /**
     * This method is bound to the instance to fix a pattern where
     * animation.stop is returned as a reference from a useEffect.
     */
    stop: () => void;
    complete(): void;
    finish(): void;
    cancel(): void;
    private teardown;
    private stopDriver;
    sample(sampleTime: number): AnimationState<T>;
    attachTimeline(timeline: TimelineWithFallback): VoidFunction;
}
declare function animateValue<T extends number | string>(options: ValueAnimationOptions<T>): JSAnimation<T>;

interface NativeAnimationOptions<V extends AnyResolvedKeyframe = number> extends DOMValueAnimationOptions<V> {
    pseudoElement?: string;
    startTime?: number;
}
/**
 * NativeAnimation implements AnimationPlaybackControls for the browser's Web Animations API.
 */
declare class NativeAnimation<T extends AnyResolvedKeyframe> extends WithPromise implements AnimationPlaybackControlsWithThen {
    /**
     * The interfaced Web Animation API animation
     */
    protected animation: Animation;
    protected finishedTime: number | null;
    protected options: NativeAnimationOptions;
    private allowFlatten;
    private isStopped;
    private isPseudoElement;
    constructor(options?: NativeAnimationOptions);
    updateMotionValue?(value?: T): void;
    play(): void;
    pause(): void;
    complete(): void;
    cancel(): void;
    stop(): void;
    /**
     * WAAPI doesn't natively have any interruption capabilities.
     *
     * In this method, we commit styles back to the DOM before cancelling
     * the animation.
     *
     * This is designed to be overridden by NativeAnimationExtended, which
     * will create a renderless JS animation and sample it twice to calculate
     * its current value, "previous" value, and therefore allow
     * Motion to also correctly calculate velocity for any subsequent animation
     * while deferring the commit until the next animation frame.
     */
    protected commitStyles(): void;
    get duration(): number;
    get iterationDuration(): number;
    get time(): number;
    set time(newTime: number);
    /**
     * The playback speed of the animation.
     * 1 = normal speed, 2 = double speed, 0.5 = half speed.
     */
    get speed(): number;
    set speed(newSpeed: number);
    get state(): AnimationPlayState;
    get startTime(): number;
    set startTime(newStartTime: number);
    /**
     * Attaches a timeline to the animation, for instance the `ScrollTimeline`.
     */
    attachTimeline({ timeline, observe }: TimelineWithFallback): VoidFunction;
}

type NativeAnimationOptionsExtended<T extends AnyResolvedKeyframe> = NativeAnimationOptions & ValueAnimationOptions<T> & NativeAnimationOptions;
declare class NativeAnimationExtended<T extends AnyResolvedKeyframe> extends NativeAnimation<T> {
    options: NativeAnimationOptionsExtended<T>;
    constructor(options: NativeAnimationOptionsExtended<T>);
    /**
     * WAAPI doesn't natively have any interruption capabilities.
     *
     * Rather than read commited styles back out of the DOM, we can
     * create a renderless JS animation and sample it twice to calculate
     * its current value, "previous" value, and therefore allow
     * Motion to calculate velocity for any subsequent animation.
     */
    updateMotionValue(value?: T): void;
}

declare class NativeAnimationWrapper<T extends AnyResolvedKeyframe> extends NativeAnimation<T> {
    constructor(animation: Animation);
}

declare const animationMapKey: (name: string, pseudoElement?: string) => string;
declare function getAnimationMap(element: Element): Map<any, any>;

type CSSVariableName = `--${string}`;
type CSSVariableToken = `var(${CSSVariableName})`;
declare const isCSSVariableName: (key?: AnyResolvedKeyframe | null) => key is `--${string}`;
declare const isCSSVariableToken: (value?: string) => value is `var(--${string})`;

declare function parseCSSVariable(current: string): string[] | undefined[];
declare function getVariableValue(current: CSSVariableToken, element: Element, depth?: number): AnyResolvedKeyframe | undefined;

declare function getValueTransition(transition: any, key: string): any;

declare function makeAnimationInstant(options: Partial<{
    duration: ValueAnimationOptions["duration"];
    type: ValueAnimationOptions["type"];
}>): void;

declare function inertia({ keyframes, velocity, power, timeConstant, bounceDamping, bounceStiffness, modifyTarget, min, max, restDelta, restSpeed, }: ValueAnimationOptions<number>): KeyframeGenerator<number>;

declare function defaultEasing(values: any[], easing?: EasingFunction): EasingFunction[];
declare function keyframes<T extends AnyResolvedKeyframe>({ duration, keyframes: keyframeValues, times, ease, }: ValueAnimationOptions<T>): KeyframeGenerator<T>;

declare function spring(optionsOrVisualDuration?: ValueAnimationOptions<number> | number, bounce?: number): KeyframeGenerator<number>;
declare namespace spring {
    var applyToOptions: (options: Transition) => Transition;
}

/**
 * Implement a practical max duration for keyframe generation
 * to prevent infinite loops
 */
declare const maxGeneratorDuration = 20000;
declare function calcGeneratorDuration(generator: KeyframeGenerator<unknown>): number;

/**
 * Create a progress => progress easing function from a generator.
 */
declare function createGeneratorEasing(options: Transition, scale: number | undefined, createGenerator: GeneratorFactory): {
    type: string;
    ease: (progress: number) => number;
    duration: number;
};

declare function isGenerator(type?: AnimationGeneratorType): type is GeneratorFactory;

declare class DOMKeyframesResolver<T extends AnyResolvedKeyframe> extends KeyframeResolver<T> {
    name: string;
    element?: WithRender;
    private removedTransforms?;
    private measuredOrigin?;
    constructor(unresolvedKeyframes: UnresolvedKeyframes<AnyResolvedKeyframe>, onComplete: OnKeyframesResolved<T>, name?: string, motionValue?: MotionValue<T>, element?: WithRender);
    readKeyframes(): void;
    resolveNoneKeyframes(): void;
    measureInitialState(): void;
    measureEndState(): void;
}

declare function defaultOffset(arr: any[]): number[];

declare function fillOffset(offset: number[], remaining: number): void;

declare function convertOffsetToTimes(offset: number[], duration: number): number[];

declare function applyPxDefaults(keyframes: ValueKeyframe[] | UnresolvedValueKeyframe[], name: string): void;

declare function fillWildcards(keyframes: ValueKeyframe[] | UnresolvedValueKeyframe[]): void;

declare const cubicBezierAsString: ([a, b, c, d]: BezierDefinition) => string;

declare function isWaapiSupportedEasing(easing?: Easing | Easing[]): boolean;

declare function mapEasingToNativeEasing(easing: Easing | Easing[] | undefined, duration: number): undefined | string | string[];

declare const supportedWaapiEasing: {
    linear: string;
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    circIn: string;
    circOut: string;
    backIn: string;
    backOut: string;
};

declare function startWaapiAnimation(element: Element, valueName: string, keyframes: ValueKeyframesDefinition, { delay, duration, repeat, repeatType, ease, times, }?: ValueTransition, pseudoElement?: string | undefined): Animation;

declare const supportsPartialKeyframes: () => boolean;

declare function supportsBrowserAnimation<T extends AnyResolvedKeyframe>(options: ValueAnimationOptionsWithRenderContext<T>): any;

/**
 * A list of values that can be hardware-accelerated.
 */
declare const acceleratedValues: Set<string>;

declare function applyGeneratorOptions({ type, ...options }: ValueTransition): ValueTransition;

declare const generateLinearEasing: (easing: EasingFunction, duration: number, resolution?: number) => string;

declare class MotionValueState {
    latest: {
        [name: string]: AnyResolvedKeyframe;
    };
    private values;
    set(name: string, value: MotionValue, render?: VoidFunction, computed?: MotionValue, useDefaultValueType?: boolean): () => void;
    get(name: string): MotionValue | undefined;
    destroy(): void;
}

declare const addAttrValue: (element: HTMLElement | SVGElement, state: MotionValueState, key: string, value: MotionValue) => () => void;
declare const attrEffect: (subject: ElementOrSelector, values: Record<string, MotionValue<any>>) => () => void;

declare const propEffect: (subject: {
    [key: string]: any;
}, values: Record<string, MotionValue<any>>) => VoidFunction;

declare const addStyleValue: (element: HTMLElement | SVGElement, state: MotionValueState, key: string, value: MotionValue) => () => void;
declare const styleEffect: (subject: ElementOrSelector, values: Record<string, MotionValue<any>>) => () => void;

declare const svgEffect: (subject: ElementOrSelector, values: Record<string, MotionValue<any>>) => () => void;

declare const frame: Batcher;
declare const cancelFrame: (process: Process) => void;
declare const frameData: FrameData;
declare const frameSteps: Steps;

type Process = (data: FrameData) => void;
type Schedule = (process: Process, keepAlive?: boolean, immediate?: boolean) => Process;
interface Step {
    schedule: Schedule;
    cancel: (process: Process) => void;
    process: (data: FrameData) => void;
}
type StepId = "setup" | "read" | "resolveKeyframes" | "preUpdate" | "update" | "preRender" | "render" | "postRender";
type CancelProcess = (process: Process) => void;
type Batcher = {
    [key in StepId]: Schedule;
};
type Steps = {
    [key in StepId]: Step;
};
interface FrameData {
    delta: number;
    timestamp: number;
    isProcessing: boolean;
}

declare function createRenderBatcher(scheduleNextBatch: (callback: Function) => void, allowKeepAlive: boolean): {
    schedule: Batcher;
    cancel: (process: Process) => void;
    state: FrameData;
    steps: Steps;
};

declare const microtask: Batcher;
declare const cancelMicrotask: (process: Process) => void;

/**
 * An eventloop-synchronous alternative to performance.now().
 *
 * Ensures that time measurements remain consistent within a synchronous context.
 * Usually calling performance.now() twice within the same synchronous context
 * will return different values which isn't useful for animations when we're usually
 * trying to sync animations to the same frame.
 */
declare const time: {
    now: () => number;
    set: (newTime: number) => void;
};

declare const isDragging: {
    x: boolean;
    y: boolean;
};
declare function isDragActive(): boolean;

declare function setDragLock(axis: boolean | "x" | "y" | "lockDirection"): (() => void) | null;

/**
 * Passed in to pan event handlers like `onPan` the `PanInfo` object contains
 * information about the current state of the tap gesture such as its
 * `point`, `delta`, `offset` and `velocity`.
 *
 * ```jsx
 * <motion.div onPan={(event, info) => {
 *   console.log(info.point.x, info.point.y)
 * }} />
 * ```
 *
 * @public
 */
interface PanInfo {
    /**
     * Contains `x` and `y` values for the current pan position relative
     * to the device or page.
     *
     * ```jsx
     * function onPan(event, info) {
     *   console.log(info.point.x, info.point.y)
     * }
     *
     * <motion.div onPan={onPan} />
     * ```
     *
     * @public
     */
    point: Point;
    /**
     * Contains `x` and `y` values for the distance moved since
     * the last event.
     *
     * ```jsx
     * function onPan(event, info) {
     *   console.log(info.delta.x, info.delta.y)
     * }
     *
     * <motion.div onPan={onPan} />
     * ```
     *
     * @public
     */
    delta: Point;
    /**
     * Contains `x` and `y` values for the distance moved from
     * the first pan event.
     *
     * ```jsx
     * function onPan(event, info) {
     *   console.log(info.offset.x, info.offset.y)
     * }
     *
     * <motion.div onPan={onPan} />
     * ```
     *
     * @public
     */
    offset: Point;
    /**
     * Contains `x` and `y` values for the current velocity of the pointer, in px/ms.
     *
     * ```jsx
     * function onPan(event, info) {
     *   console.log(info.velocity.x, info.velocity.y)
     * }
     *
     * <motion.div onPan={onPan} />
     * ```
     *
     * @public
     */
    velocity: Point;
}
type PanHandler = (event: Event, info: PanInfo) => void;

type DragHandler = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
type DragElastic = boolean | number | Partial<BoundingBox>;
interface ResolvedConstraints {
    x: Partial<Axis>;
    y: Partial<Axis>;
}
interface ResolvedElastic {
    x: Axis;
    y: Axis;
}

type ElementOrSelector = Element | Element[] | NodeListOf<Element> | string;
interface WithQuerySelectorAll {
    querySelectorAll: Element["querySelectorAll"];
}
interface AnimationScope<T = any> {
    readonly current: T;
    animations: any[];
}
interface SelectorCache {
    [key: string]: NodeListOf<Element>;
}
declare function resolveElements(elementOrSelector: ElementOrSelector, scope?: AnimationScope, selectorCache?: SelectorCache): Element[];

/**
 * Options for event listeners.
 *
 * @public
 */
interface EventOptions {
    /**
     * Use passive event listeners. Doing so allows the browser to optimize
     * scrolling performance by not allowing the use of `preventDefault()`.
     *
     * @default true
     */
    passive?: boolean;
    /**
     * Remove the event listener after the first event.
     *
     * @default false
     */
    once?: boolean;
}

/**
 * A function to be called when a hover gesture starts.
 *
 * This function can optionally return a function that will be called
 * when the hover gesture ends.
 *
 * @public
 */
type OnHoverStartEvent = (element: Element, event: PointerEvent) => void | OnHoverEndEvent;
/**
 * A function to be called when a hover gesture ends.
 *
 * @public
 */
type OnHoverEndEvent = (event: PointerEvent) => void;
/**
 * Create a hover gesture. hover() is different to .addEventListener("pointerenter")
 * in that it has an easier syntax, filters out polyfilled touch events, interoperates
 * with drag gestures, and automatically removes the "pointerennd" event listener when the hover ends.
 *
 * @public
 */
declare function hover(elementOrSelector: ElementOrSelector, onHoverStart: OnHoverStartEvent, options?: EventOptions): VoidFunction;

interface PressGestureInfo {
    success: boolean;
}
type OnPressEndEvent = (event: PointerEvent, info: PressGestureInfo) => void;
type OnPressStartEvent = (element: Element, event: PointerEvent) => OnPressEndEvent | void;

interface PointerEventOptions extends EventOptions {
    useGlobalTarget?: boolean;
}
/**
 * Create a press gesture.
 *
 * Press is different to `"pointerdown"`, `"pointerup"` in that it
 * automatically filters out secondary pointer events like right
 * click and multitouch.
 *
 * It also adds accessibility support for keyboards, where
 * an element with a press gesture will receive focus and
 *  trigger on Enter `"keydown"` and `"keyup"` events.
 *
 * This is different to a browser's `"click"` event, which does
 * respond to keyboards but only for the `"click"` itself, rather
 * than the press start and end/cancel. The element also needs
 * to be focusable for this to work, whereas a press gesture will
 * make an element focusable by default.
 *
 * @public
 */
declare function press(targetOrSelector: ElementOrSelector, onPressStart: OnPressStartEvent, options?: PointerEventOptions): VoidFunction;

/**
 * Recursively traverse up the tree to check whether the provided child node
 * is the parent or a descendant of it.
 *
 * @param parent - Element to find
 * @param child - Element to test against parent
 */
declare const isNodeOrChild: (parent: Element | null, child?: Element | null) => boolean;

declare const isPrimaryPointer: (event: PointerEvent) => boolean;

interface EventInfo {
    point: Point;
}
/**
 * A generic set of string/number values
 */
interface ResolvedValues {
    [key: string]: AnyResolvedKeyframe;
}
type AnimationDefinition = VariantLabels | TargetAndTransition | TargetResolver;
/**
 * An object that specifies values to animate to. Each value may be set either as
 * a single value, or an array of values.
 *
 * It may also option contain these properties:
 *
 * - `transition`: Specifies transitions for all or individual values.
 * - `transitionEnd`: Specifies values to set when the animation finishes.
 *
 * ```jsx
 * const target = {
 *   x: "0%",
 *   opacity: 0,
 *   transition: { duration: 1 },
 *   transitionEnd: { display: "none" }
 * }
 * ```
 *
 * @public
 */
type TargetAndTransition = Target & {
    transition?: Transition;
    transitionEnd?: ResolvedValues;
};
type TargetResolver = (custom: any, current: ResolvedValues, velocity: ResolvedValues) => TargetAndTransition | string;
/**
 * Either a string, or array of strings, that reference variants defined via the `variants` prop.
 * @public
 */
type VariantLabels = string | string[];
type Variant = TargetAndTransition | TargetResolver;
interface Variants {
    [key: string]: Variant;
}
/**
 * @deprecated
 */
type LegacyAnimationControls = {
    /**
     * Subscribes a component's animation controls to this.
     *
     * @param controls - The controls to subscribe
     * @returns An unsubscribe function.
     */
    subscribe(visualElement: any): () => void;
    /**
     * Starts an animation on all linked components.
     *
     * @remarks
     *
     * ```jsx
     * controls.start("variantLabel")
     * controls.start({
     *   x: 0,
     *   transition: { duration: 1 }
     * })
     * ```
     *
     * @param definition - Properties or variant label to animate to
     * @param transition - Optional `transition` to apply to a variant
     * @returns - A `Promise` that resolves when all animations have completed.
     *
     * @public
     */
    start(definition: AnimationDefinition, transitionOverride?: Transition): Promise<any>;
    /**
     * Instantly set to a set of properties or a variant.
     *
     * ```jsx
     * // With properties
     * controls.set({ opacity: 0 })
     *
     * // With variants
     * controls.set("hidden")
     * ```
     *
     * @privateRemarks
     * We could perform a similar trick to `.start` where this can be called before mount
     * and we maintain a list of of pending actions that get applied on mount. But the
     * expectation of `set` is that it happens synchronously and this would be difficult
     * to do before any children have even attached themselves. It's also poor practise
     * and we should discourage render-synchronous `.start` calls rather than lean into this.
     *
     * @public
     */
    set(definition: AnimationDefinition): void;
    /**
     * Stops animations on all linked components.
     *
     * ```jsx
     * controls.stop()
     * ```
     *
     * @public
     */
    stop(): void;
    mount(): () => void;
};
interface MotionNodeAnimationOptions {
    /**
     * Properties, variant label or array of variant labels to start in.
     *
     * Set to `false` to initialise with the values in `animate` (disabling the mount animation)
     *
     * ```jsx
     * // As values
     * <motion.div initial={{ opacity: 1 }} />
     *
     * // As variant
     * <motion.div initial="visible" variants={variants} />
     *
     * // Multiple variants
     * <motion.div initial={["visible", "active"]} variants={variants} />
     *
     * // As false (disable mount animation)
     * <motion.div initial={false} animate={{ opacity: 0 }} />
     * ```
     */
    initial?: TargetAndTransition | VariantLabels | boolean;
    /**
     * Values to animate to, variant label(s), or `LegacyAnimationControls`.
     *
     * ```jsx
     * // As values
     * <motion.div animate={{ opacity: 1 }} />
     *
     * // As variant
     * <motion.div animate="visible" variants={variants} />
     *
     * // Multiple variants
     * <motion.div animate={["visible", "active"]} variants={variants} />
     *
     * // LegacyAnimationControls
     * <motion.div animate={animation} />
     * ```
     */
    animate?: TargetAndTransition | VariantLabels | boolean | LegacyAnimationControls;
    /**
     * A target to animate to when this component is removed from the tree.
     *
     * This component **must** be the first animatable child of an `AnimatePresence` to enable this exit animation.
     *
     * This limitation exists because React doesn't allow components to defer unmounting until after
     * an animation is complete. Once this limitation is fixed, the `AnimatePresence` component will be unnecessary.
     *
     * ```jsx
     * import { AnimatePresence, motion } from 'framer-motion'
     *
     * export const MyComponent = ({ isVisible }) => {
     *   return (
     *     <AnimatePresence>
     *        {isVisible && (
     *          <motion.div
     *            initial={{ opacity: 0 }}
     *            animate={{ opacity: 1 }}
     *            exit={{ opacity: 0 }}
     *          />
     *        )}
     *     </AnimatePresence>
     *   )
     * }
     * ```
     */
    exit?: TargetAndTransition | VariantLabels;
    /**
     * Variants allow you to define animation states and organise them by name. They allow
     * you to control animations throughout a component tree by switching a single `animate` prop.
     *
     * Using `transition` options like `delayChildren` and `when`, you can orchestrate
     * when children animations play relative to their parent.

     *
     * After passing variants to one or more `motion` component's `variants` prop, these variants
     * can be used in place of values on the `animate`, `initial`, `whileFocus`, `whileTap` and `whileHover` props.
     *
     * ```jsx
     * const variants = {
     *   active: {
     *       backgroundColor: "#f00"
     *   },
     *   inactive: {
     *     backgroundColor: "#fff",
     *     transition: { duration: 2 }
     *   }
     * }
     *
     * <motion.div variants={variants} animate="active" />
     * ```
     */
    variants?: Variants;
    /**
     * Default transition. If no `transition` is defined in `animate`, it will use the transition defined here.
     * ```jsx
     * const spring = {
     *   type: "spring",
     *   damping: 10,
     *   stiffness: 100
     * }
     *
     * <motion.div transition={spring} animate={{ scale: 1.2 }} />
     * ```
     */
    transition?: Transition;
}
interface MotionNodeEventOptions {
    /**
     * Callback with latest motion values, fired max once per frame.
     *
     * ```jsx
     * function onUpdate(latest) {
     *   console.log(latest.x, latest.opacity)
     * }
     *
     * <motion.div animate={{ x: 100, opacity: 0 }} onUpdate={onUpdate} />
     * ```
     */
    onUpdate?(latest: ResolvedValues): void;
    /**
     * Callback when animation defined in `animate` begins.
     *
     * The provided callback will be called with the triggering animation definition.
     * If this is a variant, it'll be the variant name, and if a target object
     * then it'll be the target object.
     *
     * This way, it's possible to figure out which animation has started.
     *
     * ```jsx
     * function onStart() {
     *   console.log("Animation started")
     * }
     *
     * <motion.div animate={{ x: 100 }} onAnimationStart={onStart} />
     * ```
     */
    onAnimationStart?(definition: AnimationDefinition): void;
    /**
     * Callback when animation defined in `animate` is complete.
     *
     * The provided callback will be called with the triggering animation definition.
     * If this is a variant, it'll be the variant name, and if a target object
     * then it'll be the target object.
     *
     * This way, it's possible to figure out which animation has completed.
     *
     * ```jsx
     * function onComplete() {
     *   console.log("Animation completed")
     * }
     *
     * <motion.div
     *   animate={{ x: 100 }}
     *   onAnimationComplete={definition => {
     *     console.log('Completed animating', definition)
     *   }}
     * />
     * ```
     */
    onAnimationComplete?(definition: AnimationDefinition): void;
    onBeforeLayoutMeasure?(box: Box): void;
    onLayoutMeasure?(box: Box, prevBox: Box): void;
    onLayoutAnimationStart?(): void;
    onLayoutAnimationComplete?(): void;
}
interface MotionNodePanHandlers {
    /**
     * Callback function that fires when the pan gesture is recognised on this element.
     *
     * **Note:** For pan gestures to work correctly with touch input, the element needs
     * touch scrolling to be disabled on either x/y or both axis with the
     * [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action) CSS rule.
     *
     * ```jsx
     * function onPan(event, info) {
     *   console.log(info.point.x, info.point.y)
     * }
     *
     * <motion.div onPan={onPan} />
     * ```
     *
     * @param event - The originating pointer event.
     * @param info - A {@link PanInfo} object containing `x` and `y` values for:
     *
     *   - `point`: Relative to the device or page.
     *   - `delta`: Distance moved since the last event.
     *   - `offset`: Offset from the original pan event.
     *   - `velocity`: Current velocity of the pointer.
     */
    onPan?(event: PointerEvent, info: PanInfo): void;
    /**
     * Callback function that fires when the pan gesture begins on this element.
     *
     * ```jsx
     * function onPanStart(event, info) {
     *   console.log(info.point.x, info.point.y)
     * }
     *
     * <motion.div onPanStart={onPanStart} />
     * ```
     *
     * @param event - The originating pointer event.
     * @param info - A {@link PanInfo} object containing `x`/`y` values for:
     *
     *   - `point`: Relative to the device or page.
     *   - `delta`: Distance moved since the last event.
     *   - `offset`: Offset from the original pan event.
     *   - `velocity`: Current velocity of the pointer.
     */
    onPanStart?(event: PointerEvent, info: PanInfo): void;
    /**
     * Callback function that fires when we begin detecting a pan gesture. This
     * is analogous to `onMouseStart` or `onTouchStart`.
     *
     * ```jsx
     * function onPanSessionStart(event, info) {
     *   console.log(info.point.x, info.point.y)
     * }
     *
     * <motion.div onPanSessionStart={onPanSessionStart} />
     * ```
     *
     * @param event - The originating pointer event.
     * @param info - An {@link EventInfo} object containing `x`/`y` values for:
     *
     *   - `point`: Relative to the device or page.
     */
    onPanSessionStart?(event: PointerEvent, info: EventInfo): void;
    /**
     * Callback function that fires when the pan gesture ends on this element.
     *
     * ```jsx
     * function onPanEnd(event, info) {
     *   console.log(info.point.x, info.point.y)
     * }
     *
     * <motion.div onPanEnd={onPanEnd} />
     * ```
     *
     * @param event - The originating pointer event.
     * @param info - A {@link PanInfo} object containing `x`/`y` values for:
     *
     *   - `point`: Relative to the device or page.
     *   - `delta`: Distance moved since the last event.
     *   - `offset`: Offset from the original pan event.
     *   - `velocity`: Current velocity of the pointer.
     */
    onPanEnd?(event: PointerEvent, info: PanInfo): void;
}
interface MotionNodeHoverHandlers {
    /**
     * Properties or variant label to animate to while the hover gesture is recognised.
     *
     * ```jsx
     * <motion.div whileHover={{ scale: 1.2 }} />
     * ```
     */
    whileHover?: VariantLabels | TargetAndTransition;
    /**
     * Callback function that fires when pointer starts hovering over the component.
     *
     * ```jsx
     * <motion.div onHoverStart={() => console.log('Hover starts')} />
     * ```
     */
    onHoverStart?(event: MouseEvent, info: EventInfo): void;
    /**
     * Callback function that fires when pointer stops hovering over the component.
     *
     * ```jsx
     * <motion.div onHoverEnd={() => console.log("Hover ends")} />
     * ```
     */
    onHoverEnd?(event: MouseEvent, info: EventInfo): void;
}
/**
 * Passed in to tap event handlers like `onTap` the `TapInfo` object contains
 * information about the tap gesture such as it‘s location.
 *
 * ```jsx
 * function onTap(event, info) {
 *   console.log(info.point.x, info.point.y)
 * }
 *
 * <motion.div onTap={onTap} />
 * ```
 *
 * @public
 */
interface TapInfo {
    /**
     * Contains `x` and `y` values for the tap gesture relative to the
     * device or page.
     *
     * ```jsx
     * function onTapStart(event, info) {
     *   console.log(info.point.x, info.point.y)
     * }
     *
     * <motion.div onTapStart={onTapStart} />
     * ```
     *
     * @public
     */
    point: Point;
}
interface MotionNodeTapHandlers {
    /**
     * Callback when the tap gesture successfully ends on this element.
     *
     * ```jsx
     * function onTap(event, info) {
     *   console.log(info.point.x, info.point.y)
     * }
     *
     * <motion.div onTap={onTap} />
     * ```
     *
     * @param event - The originating pointer event.
     * @param info - An {@link TapInfo} object containing `x` and `y` values for the `point` relative to the device or page.
     */
    onTap?(event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo): void;
    /**
     * Callback when the tap gesture starts on this element.
     *
     * ```jsx
     * function onTapStart(event, info) {
     *   console.log(info.point.x, info.point.y)
     * }
     *
     * <motion.div onTapStart={onTapStart} />
     * ```
     *
     * @param event - The originating pointer event.
     * @param info - An {@link TapInfo} object containing `x` and `y` values for the `point` relative to the device or page.
     */
    onTapStart?(event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo): void;
    /**
     * Callback when the tap gesture ends outside this element.
     *
     * ```jsx
     * function onTapCancel(event, info) {
     *   console.log(info.point.x, info.point.y)
     * }
     *
     * <motion.div onTapCancel={onTapCancel} />
     * ```
     *
     * @param event - The originating pointer event.
     * @param info - An {@link TapInfo} object containing `x` and `y` values for the `point` relative to the device or page.
     */
    onTapCancel?(event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo): void;
    /**
     * Properties or variant label to animate to while the component is pressed.
     *
     * ```jsx
     * <motion.div whileTap={{ scale: 0.8 }} />
     * ```
     */
    whileTap?: VariantLabels | TargetAndTransition;
    /**
     * If `true`, the tap gesture will attach its start listener to window.
     *
     * Note: This is not supported publically.
     */
    globalTapTarget?: boolean;
}
/**
 * @deprecated - Use MotionNodeTapHandlers
 */
interface TapHandlers extends MotionNodeTapHandlers {
}
interface MotionNodeFocusHandlers {
    /**
     * Properties or variant label to animate to while the focus gesture is recognised.
     *
     * ```jsx
     * <motion.input whileFocus={{ scale: 1.2 }} />
     * ```
     */
    whileFocus?: VariantLabels | TargetAndTransition;
}
/**
 * TODO: Replace with types from inView()
 */
type ViewportEventHandler = (entry: IntersectionObserverEntry | null) => void;
interface ViewportOptions {
    root?: {
        current: Element | null;
    };
    once?: boolean;
    margin?: string;
    amount?: "some" | "all" | number;
}
interface MotionNodeViewportOptions {
    whileInView?: VariantLabels | TargetAndTransition;
    onViewportEnter?: ViewportEventHandler;
    onViewportLeave?: ViewportEventHandler;
    viewport?: ViewportOptions;
}
interface MotionNodeDraggableOptions {
    /**
     * Enable dragging for this element. Set to `false` by default.
     * Set `true` to drag in both directions.
     * Set `"x"` or `"y"` to only drag in a specific direction.
     *
     * ```jsx
     * <motion.div drag="x" />
     * ```
     */
    drag?: boolean | "x" | "y";
    /**
     * Properties or variant label to animate to while the drag gesture is recognised.
     *
     * ```jsx
     * <motion.div whileDrag={{ scale: 1.2 }} />
     * ```
     */
    whileDrag?: VariantLabels | TargetAndTransition;
    /**
     * If `true`, this will lock dragging to the initially-detected direction. Defaults to `false`.
     *
     * ```jsx
     * <motion.div drag dragDirectionLock />
     * ```
     */
    dragDirectionLock?: boolean;
    /**
     * Allows drag gesture propagation to child components. Set to `false` by
     * default.
     *
     * ```jsx
     * <motion.div drag="x" dragPropagation />
     * ```
     */
    dragPropagation?: boolean;
    /**
     * Applies constraints on the permitted draggable area.
     *
     * It can accept an object of optional `top`, `left`, `right`, and `bottom` values, measured in pixels.
     * This will define a distance from the named edge of the draggable component.
     *
     * Alternatively, it can accept a `ref` to another component created with React's `useRef` hook.
     * This `ref` should be passed both to the draggable component's `dragConstraints` prop, and the `ref`
     * of the component you want to use as constraints.
     *
     * ```jsx
     * // In pixels
     * <motion.div
     *   drag="x"
     *   dragConstraints={{ left: 0, right: 300 }}
     * />
     *
     * // As a ref to another component
     * const MyComponent = () => {
     *   const constraintsRef = useRef(null)
     *
     *   return (
     *      <motion.div ref={constraintsRef}>
     *          <motion.div drag dragConstraints={constraintsRef} />
     *      </motion.div>
     *   )
     * }
     * ```
     */
    dragConstraints?: false | Partial<BoundingBox> | {
        current: Element | null;
    };
    /**
     * The degree of movement allowed outside constraints. 0 = no movement, 1 =
     * full movement.
     *
     * Set to `0.5` by default. Can also be set as `false` to disable movement.
     *
     * By passing an object of `top`/`right`/`bottom`/`left`, individual values can be set
     * per constraint. Any missing values will be set to `0`.
     *
     * ```jsx
     * <motion.div
     *   drag
     *   dragConstraints={{ left: 0, right: 300 }}
     *   dragElastic={0.2}
     * />
     * ```
     */
    dragElastic?: DragElastic;
    /**
     * Apply momentum from the pan gesture to the component when dragging
     * finishes. Set to `true` by default.
     *
     * ```jsx
     * <motion.div
     *   drag
     *   dragConstraints={{ left: 0, right: 300 }}
     *   dragMomentum={false}
     * />
     * ```
     */
    dragMomentum?: boolean;
    /**
     * Allows you to change dragging inertia parameters.
     * When releasing a draggable Frame, an animation with type `inertia` starts. The animation is based on your dragging velocity. This property allows you to customize it.
     * See {@link https://motion.dev/docs/react-motion-component#dragtransition | Inertia} for all properties you can use.
     *
     * ```jsx
     * <motion.div
     *   drag
     *   dragTransition={{ bounceStiffness: 600, bounceDamping: 10 }}
     * />
     * ```
     */
    dragTransition?: InertiaOptions;
    /**
     * Usually, dragging is initiated by pressing down on a component and moving it. For some
     * use-cases, for instance clicking at an arbitrary point on a video scrubber, we
     * might want to initiate dragging from a different component than the draggable one.
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
     */
    dragControls?: any;
    /**
     * If true, element will snap back to its origin when dragging ends.
     *
     * Enabling this is the equivalent of setting all `dragConstraints` axes to `0`
     * with `dragElastic={1}`, but when used together `dragConstraints` can define
     * a wider draggable area and `dragSnapToOrigin` will ensure the element
     * animates back to its origin on release.
     */
    dragSnapToOrigin?: boolean;
    /**
     * By default, if `drag` is defined on a component then an event listener will be attached
     * to automatically initiate dragging when a user presses down on it.
     *
     * By setting `dragListener` to `false`, this event listener will not be created.
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
     *     <motion.div
     *       drag="x"
     *       dragControls={dragControls}
     *       dragListener={false}
     *     />
     *   </>
     * )
     * ```
     */
    dragListener?: boolean;
    /**
     * If `dragConstraints` is set to a React ref, this callback will call with the measured drag constraints.
     *
     * @public
     */
    onMeasureDragConstraints?: (constraints: BoundingBox) => BoundingBox | void;
    /**
     * Usually, dragging uses the layout project engine, and applies transforms to the underlying VisualElement.
     * Passing MotionValues as _dragX and _dragY instead applies drag updates to these motion values.
     * This allows you to manually control how updates from a drag gesture on an element is applied.
     *
     * @public
     */
    _dragX?: MotionValue<number>;
    /**
     * Usually, dragging uses the layout project engine, and applies transforms to the underlying VisualElement.
     * Passing MotionValues as _dragX and _dragY instead applies drag updates to these motion values.
     * This allows you to manually control how updates from a drag gesture on an element is applied.
     *
     * @public
     */
    _dragY?: MotionValue<number>;
}
interface MotionNodeDragHandlers {
    /**
     * Callback function that fires when dragging starts.
     *
     * ```jsx
     * <motion.div
     *   drag
     *   onDragStart={
     *     (event, info) => console.log(info.point.x, info.point.y)
     *   }
     * />
     * ```
     *
     * @public
     */
    onDragStart?(event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void;
    /**
     * Callback function that fires when dragging ends.
     *
     * ```jsx
     * <motion.div
     *   drag
     *   onDragEnd={
     *     (event, info) => console.log(info.point.x, info.point.y)
     *   }
     * />
     * ```
     *
     * @public
     */
    onDragEnd?(event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void;
    /**
     * Callback function that fires when the component is dragged.
     *
     * ```jsx
     * <motion.div
     *   drag
     *   onDrag={
     *     (event, info) => console.log(info.point.x, info.point.y)
     *   }
     * />
     * ```
     *
     * @public
     */
    onDrag?(event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void;
    /**
     * Callback function that fires a drag direction is determined.
     *
     * ```jsx
     * <motion.div
     *   drag
     *   dragDirectionLock
     *   onDirectionLock={axis => console.log(axis)}
     * />
     * ```
     *
     * @public
     */
    onDirectionLock?(axis: "x" | "y"): void;
    /**
     * Callback function that fires when drag momentum/bounce transition finishes.
     *
     * ```jsx
     * <motion.div
     *   drag
     *   onDragTransitionEnd={() => console.log('Drag transition complete')}
     * />
     * ```
     *
     * @public
     */
    onDragTransitionEnd?(): void;
}
interface MotionNodeLayoutOptions {
    /**
     * If `true`, this component will automatically animate to its new position when
     * its layout changes.
     *
     * ```jsx
     * <motion.div layout />
     * ```
     *
     * This will perform a layout animation using performant transforms. Part of this technique
     * involved animating an element's scale. This can introduce visual distortions on children,
     * `boxShadow` and `borderRadius`.
     *
     * To correct distortion on immediate children, add `layout` to those too.
     *
     * `boxShadow` and `borderRadius` will automatically be corrected if they are already being
     * animated on this component. Otherwise, set them directly via the `initial` prop.
     *
     * If `layout` is set to `"position"`, the size of the component will change instantly and
     * only its position will animate.
     *
     * If `layout` is set to `"size"`, the position of the component will change instantly and
     * only its size will animate.
     *
     * If `layout` is set to `"preserve-aspect"`, the component will animate size & position if
     * the aspect ratio remains the same between renders, and just position if the ratio changes.
     *
     * @public
     */
    layout?: boolean | "position" | "size" | "preserve-aspect";
    /**
     * Enable shared layout transitions between different components with the same `layoutId`.
     *
     * When a component with a layoutId is removed from the React tree, and then
     * added elsewhere, it will visually animate from the previous component's bounding box
     * and its latest animated values.
     *
     * ```jsx
     *   {items.map(item => (
     *      <motion.li layout>
     *         {item.name}
     *         {item.isSelected && <motion.div layoutId="underline" />}
     *      </motion.li>
     *   ))}
     * ```
     *
     * If the previous component remains in the tree it will crossfade with the new component.
     *
     * @public
     */
    layoutId?: string;
    /**
     * A callback that will fire when a layout animation on this component starts.
     *
     * @public
     */
    onLayoutAnimationStart?(): void;
    /**
     * A callback that will fire when a layout animation on this component completes.
     *
     * @public
     */
    onLayoutAnimationComplete?(): void;
    /**
     * @public
     */
    layoutDependency?: any;
    /**
     * Whether a projection node should measure its scroll when it or its descendants update their layout.
     *
     * @public
     */
    layoutScroll?: boolean;
    /**
     * Whether an element should be considered a "layout root", where
     * all children will be forced to resolve relatively to it.
     * Currently used for `position: sticky` elements in Framer.
     */
    layoutRoot?: boolean;
    /**
     * Attached to a portal root to ensure we attach the child to the document root and don't
     * perform scale correction on it.
     */
    "data-framer-portal-id"?: string;
    /**
     * By default, shared layout elements will crossfade. By setting this
     * to `false`, this element will take its default opacity throughout the animation.
     */
    layoutCrossfade?: boolean;
}
/**
 * @deprecated - Use MotionNodeDragHandlers/MotionNodeDraggableOptions
 */
interface DraggableProps extends MotionNodeDragHandlers, MotionNodeDraggableOptions {
}
type TransformTemplate = (transform: TransformProperties, generatedTransform: string) => string;
interface MotionNodeAdvancedOptions {
    /**
     * Custom data to use to resolve dynamic variants differently for each animating component.
     *
     * ```jsx
     * const variants = {
     *   visible: (custom) => ({
     *     opacity: 1,
     *     transition: { delay: custom * 0.2 }
     *   })
     * }
     *
     * <motion.div custom={0} animate="visible" variants={variants} />
     * <motion.div custom={1} animate="visible" variants={variants} />
     * <motion.div custom={2} animate="visible" variants={variants} />
     * ```
     *
     * @public
     */
    custom?: any;
    /**
     * @public
     * Set to `false` to prevent inheriting variant changes from its parent.
     */
    inherit?: boolean;
    /**
     * @public
     * Set to `false` to prevent throwing an error when a `motion` component is used within a `LazyMotion` set to strict.
     */
    ignoreStrict?: boolean;
    /**
     * Provide a set of motion values to perform animations on.
     */
    values?: {
        [key: string]: MotionValue<number> | MotionValue<string>;
    };
    /**
     * By default, Motion generates a `transform` property with a sensible transform order. `transformTemplate`
     * can be used to create a different order, or to append/preprend the automatically generated `transform` property.
     *
     * ```jsx
     * <motion.div
     *   style={{ x: 0, rotate: 180 }}
     *   transformTemplate={
     *     ({ x, rotate }) => `rotate(${rotate}deg) translateX(${x}px)`
     *   }
     * />
     * ```
     *
     * @param transform - The latest animated transform props.
     * @param generatedTransform - The transform string as automatically generated by Motion
     *
     * @public
     */
    transformTemplate?: TransformTemplate;
    "data-framer-appear-id"?: string;
}
interface MotionNodeOptions extends MotionNodeAnimationOptions, MotionNodeEventOptions, MotionNodePanHandlers, MotionNodeTapHandlers, MotionNodeHoverHandlers, MotionNodeFocusHandlers, MotionNodeViewportOptions, MotionNodeDragHandlers, MotionNodeDraggableOptions, MotionNodeLayoutOptions, MotionNodeAdvancedOptions {
}

declare function defaultTransformValue(name: string): number;
declare function parseValueFromTransform(transform: string | undefined, name: string): number;
declare const readTransformValue: (instance: HTMLElement, name: string) => number;

declare function getComputedStyle(element: HTMLElement | SVGElement, name: string): string;

declare function setStyle(element: HTMLElement | SVGElement, name: string, value: AnyResolvedKeyframe): void;

declare const positionalKeys: Set<string>;

/**
 * Generate a list of every possible transform key.
 */
declare const transformPropOrder: string[];
/**
 * A quick lookup for transform props.
 */
declare const transformProps: Set<string>;

interface ResizeInfo {
    width: number;
    height: number;
}
type ResizeHandler<I> = (element: I, info: ResizeInfo) => void;
type WindowResizeHandler = (info: ResizeInfo) => void;

declare function resize(onResize: WindowResizeHandler): VoidFunction;
declare function resize(target: ElementOrSelector, onResize: ResizeHandler<Element>): VoidFunction;

type Update = (progress: number) => void;
declare function observeTimeline(update: Update, timeline: ProgressTimeline): () => void;

declare const stepsOrder: StepId[];
type StepNames = (typeof stepsOrder)[number];

interface Summary {
    min: number;
    max: number;
    avg: number;
}
type FrameloopStatNames = "rate" | StepNames;
interface Stats<T> {
    frameloop: {
        [key in FrameloopStatNames]: T;
    };
    animations: {
        mainThread: T;
        waapi: T;
        layout: T;
    };
    layoutProjection: {
        nodes: T;
        calculatedTargetDeltas: T;
        calculatedProjections: T;
    };
}
type StatsBuffer = number[];
type FrameStats = Stats<number>;
type StatsRecording = Stats<StatsBuffer>;
type StatsSummary = Stats<Summary>;

declare function reportStats(): StatsSummary;
declare function recordStats(): typeof reportStats;

declare const activeAnimations: {
    layout: number;
    mainThread: number;
    waapi: number;
};

type InactiveStatsBuffer = {
    value: null;
    addProjectionMetrics: null;
};
type ActiveStatsBuffer = {
    value: StatsRecording;
    addProjectionMetrics: (metrics: {
        nodes: number;
        calculatedTargetDeltas: number;
        calculatedProjections: number;
    }) => void;
};
declare const statsBuffer: InactiveStatsBuffer | ActiveStatsBuffer;

type Mixer<T> = (p: number) => T;
type MixerFactory<T> = (a: T, b: T) => Mixer<T>;

interface InterpolateOptions<T> {
    clamp?: boolean;
    ease?: EasingFunction | EasingFunction[];
    mixer?: MixerFactory<T>;
}
/**
 * Create a function that maps from a numerical input array to a generic output array.
 *
 * Accepts:
 *   - Numbers
 *   - Colors (hex, hsl, hsla, rgb, rgba)
 *   - Complex (combinations of one or more numbers or strings)
 *
 * ```jsx
 * const mixColor = interpolate([0, 1], ['#fff', '#000'])
 *
 * mixColor(0.5) // 'rgba(128, 128, 128, 1)'
 * ```
 *
 * TODO Revisit this approach once we've moved to data models for values,
 * probably not needed to pregenerate mixer functions.
 *
 * @public
 */
declare function interpolate<T>(input: number[], output: T[], { clamp: isClamp, ease, mixer }?: InterpolateOptions<T>): (v: number) => T;

/**
 * Checks if an element is an HTML element in a way
 * that works across iframes
 */
declare function isHTMLElement(element: unknown): element is HTMLElement;

/**
 * Checks if an element is an SVG element in a way
 * that works across iframes
 */
declare function isSVGElement(element: unknown): element is SVGElement;

/**
 * Checks if an element is specifically an SVGSVGElement (the root SVG element)
 * in a way that works across iframes
 */
declare function isSVGSVGElement(element: unknown): element is SVGSVGElement;

declare function mix<T>(from: T, to: T): Mixer<T>;
declare function mix(from: number, to: number, p: number): number;

type Transformer = (v: any) => any;
type ValueType = {
    test: (v: any) => boolean;
    parse: (v: any) => any;
    transform?: Transformer;
    createTransformer?: (template: string) => Transformer;
    default?: any;
    getAnimatableNone?: (v: any) => any;
};
type NumberMap = {
    [key: string]: number;
};
type RGBA = {
    red: number;
    green: number;
    blue: number;
    alpha: number;
};
type HSLA = {
    hue: number;
    saturation: number;
    lightness: number;
    alpha: number;
};
type Color = HSLA | RGBA;

declare const mixLinearColor: (from: number, to: number, v: number) => number;
declare const mixColor: (from: Color | string, to: Color | string) => (p: number) => string | Color;

type MixableArray = Array<number | RGBA | HSLA | string>;
interface MixableObject {
    [key: string]: AnyResolvedKeyframe | RGBA | HSLA;
}
declare function getMixer<T>(a: T): ((from: string | Color, to: string | Color) => (p: number) => string | Color) | ((origin: AnyResolvedKeyframe, target: AnyResolvedKeyframe) => Function) | typeof mixArray | typeof mixObject;
declare function mixArray(a: MixableArray, b: MixableArray): (p: number) => (string | number | RGBA | HSLA)[];
declare function mixObject(a: MixableObject, b: MixableObject): (v: number) => {
    [x: string]: AnyResolvedKeyframe | RGBA | HSLA;
};
declare const mixComplex: (origin: AnyResolvedKeyframe, target: AnyResolvedKeyframe) => Function;

declare function mixImmediate<T>(a: T, b: T): (p: number) => T;

declare const mixNumber: (from: number, to: number, progress: number) => number;

declare const invisibleValues: Set<string>;
/**
 * Returns a function that, when provided a progress value between 0 and 1,
 * will return the "none" or "hidden" string only when the progress is that of
 * the origin or target.
 */
declare function mixVisibility(origin: string, target: string): (p: number) => string;

type StaggerOrigin = "first" | "last" | "center" | number;
type StaggerOptions = {
    startDelay?: number;
    from?: StaggerOrigin;
    ease?: Easing;
};
declare function getOriginIndex(from: StaggerOrigin, total: number): number;
declare function stagger(duration?: number, { startDelay, from, ease }?: StaggerOptions): DynamicOption<number>;

/**
 * Add the ability for test suites to manually set support flags
 * to better test more environments.
 */
declare const supportsFlags: Record<string, boolean | undefined>;

declare const supportsLinearEasing: () => boolean;

declare global {
    interface Window {
        ScrollTimeline: ScrollTimeline;
    }
}
declare class ScrollTimeline implements ProgressTimeline {
    constructor(options: ScrollOptions);
    currentTime: null | {
        value: number;
    };
    cancel?: VoidFunction;
}
declare const supportsScrollTimeline: () => boolean;

/**
 * @public
 */
interface TransformOptions<T> {
    /**
     * Clamp values to within the given range. Defaults to `true`
     *
     * @public
     */
    clamp?: boolean;
    /**
     * Easing functions to use on the interpolations between each value in the input and output ranges.
     *
     * If provided as an array, the array must be one item shorter than the input and output ranges, as the easings apply to the transition **between** each.
     *
     * @public
     */
    ease?: EasingFunction | EasingFunction[];
    /**
     * Provide a function that can interpolate between any two values in the provided range.
     *
     * @public
     */
    mixer?: (from: T, to: T) => (v: number) => any;
}
/**
 * Transforms numbers into other values by mapping them from an input range to an output range.
 * Returns the type of the input provided.
 *
 * @remarks
 *
 * Given an input range of `[0, 200]` and an output range of
 * `[0, 1]`, this function will return a value between `0` and `1`.
 * The input range must be a linear series of numbers. The output range
 * can be any supported value type, such as numbers, colors, shadows, arrays, objects and more.
 * Every value in the output range must be of the same type and in the same format.
 *
 * ```jsx
 * export function MyComponent() {
 *    const inputRange = [0, 200]
 *    const outputRange = [0, 1]
 *    const output = transform(100, inputRange, outputRange)
 *
 *    // Returns 0.5
 *    return <div>{output}</div>
 * }
 * ```
 *
 * @param inputValue - A number to transform between the input and output ranges.
 * @param inputRange - A linear series of numbers (either all increasing or decreasing).
 * @param outputRange - A series of numbers, colors, strings, or arrays/objects of those. Must be the same length as `inputRange`.
 * @param options - Clamp: Clamp values to within the given range. Defaults to `true`.
 *
 * @public
 */
declare function transform<T>(inputValue: number, inputRange: number[], outputRange: T[], options?: TransformOptions<T>): T;
/**
 *
 * Transforms numbers into other values by mapping them from an input range to an output range.
 *
 * Given an input range of `[0, 200]` and an output range of
 * `[0, 1]`, this function will return a value between `0` and `1`.
 * The input range must be a linear series of numbers. The output range
 * can be any supported value type, such as numbers, colors, shadows, arrays, objects and more.
 * Every value in the output range must be of the same type and in the same format.
 *
 * ```jsx
 * export function MyComponent() {
 *     const inputRange = [-200, -100, 100, 200]
 *     const outputRange = [0, 1, 1, 0]
 *     const convertRange = transform(inputRange, outputRange)
 *     const output = convertRange(-150)
 *
 *     // Returns 0.5
 *     return <div>{output}</div>
 * }
 *
 * ```
 *
 * @param inputRange - A linear series of numbers (either all increasing or decreasing).
 * @param outputRange - A series of numbers, colors or strings. Must be the same length as `inputRange`.
 * @param options - Clamp: clamp values to within the given range. Defaults to `true`.
 *
 * @public
 */
declare function transform<T>(inputRange: number[], outputRange: T[], options?: TransformOptions<T>): (inputValue: number) => T;

type MapInputRange = number[];
/**
 * Create a `MotionValue` that maps the output of another `MotionValue` by
 * mapping it from one range of values into another.
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
 * The input range must be a linear series of numbers. The output range
 * can be any value type supported by Motion: numbers, colors, shadows, etc.
 *
 * Every value in the output range must be of the same type and in the same format.
 *
 * ```jsx
 * const x = motionValue(0)
 * const xRange = [-200, -100, 100, 200]
 * const opacityRange = [0, 1, 1, 0]
 * const opacity = mapValue(x, xRange, opacityRange)
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
declare function mapValue<O>(inputValue: MotionValue<number>, inputRange: MapInputRange, outputRange: O[], options?: TransformOptions<O>): MotionValue<O>;

/**
 * Create a `MotionValue` that animates to its latest value using a spring.
 * Can either be a value or track another `MotionValue`.
 *
 * ```jsx
 * const x = motionValue(0)
 * const y = transformValue(() => x.get() * 2) // double x
 * ```
 *
 * @param transformer - A transform function. This function must be pure with no side-effects or conditional statements.
 * @returns `MotionValue`
 *
 * @public
 */
declare function springValue<T extends AnyResolvedKeyframe>(source: T | MotionValue<T>, options?: SpringOptions): MotionValue<T>;
declare function attachSpring<T extends AnyResolvedKeyframe>(value: MotionValue<T>, source: T | MotionValue<T>, options?: SpringOptions): VoidFunction;

type TransformInputRange = number[];
type SingleTransformer<I, O> = (input: I) => O;
type MultiTransformer<I, O> = (input: I[]) => O;
type ValueTransformer<I, O> = SingleTransformer<I, O> | MultiTransformer<I, O>;
/**
 * Create a `MotionValue` that transforms the output of other `MotionValue`s by
 * passing their latest values through a transform function.
 *
 * Whenever a `MotionValue` referred to in the provided function is updated,
 * it will be re-evaluated.
 *
 * ```jsx
 * const x = motionValue(0)
 * const y = transformValue(() => x.get() * 2) // double x
 * ```
 *
 * @param transformer - A transform function. This function must be pure with no side-effects or conditional statements.
 * @returns `MotionValue`
 *
 * @public
 */
declare function transformValue<O>(transform: () => O): MotionValue<O>;

declare const color: {
    test: (v: any) => boolean;
    parse: (v: any) => RGBA | HSLA;
    transform: (v: HSLA | RGBA | string) => string;
    getAnimatableNone: (v: string) => string;
};

declare function parseHex(v: string): RGBA;
declare const hex: {
    test: (v: any) => boolean;
    parse: typeof parseHex;
    transform: ({ red, green, blue, alpha }: RGBA) => string;
};

declare const hsla: {
    test: (v: any) => boolean;
    parse: (v: string | Color) => HSLA;
    transform: ({ hue, saturation, lightness, alpha }: HSLA) => string;
};

declare function hslaToRgba({ hue, saturation, lightness, alpha }: HSLA): RGBA;

declare const rgbUnit: {
    transform: (v: number) => number;
    test: (v: number) => boolean;
    parse: typeof parseFloat;
};
declare const rgba: {
    test: (v: any) => boolean;
    parse: (v: string | Color) => RGBA;
    transform: ({ red, green, blue, alpha }: RGBA) => string;
};

declare function test(v: any): boolean;
type ComplexValues = Array<CSSVariableToken | AnyResolvedKeyframe | Color>;
interface ValueIndexes {
    color: number[];
    number: number[];
    var: number[];
}
interface ComplexValueInfo {
    values: ComplexValues;
    split: string[];
    indexes: ValueIndexes;
    types: Array<keyof ValueIndexes>;
}
declare function analyseComplexValue(value: AnyResolvedKeyframe): ComplexValueInfo;
declare function parseComplexValue(v: AnyResolvedKeyframe): ComplexValues;
declare function createTransformer(source: AnyResolvedKeyframe): (v: Array<CSSVariableToken | Color | number | string>) => string;
declare function getAnimatableNone$1(v: AnyResolvedKeyframe): string;
declare const complex: {
    test: typeof test;
    parse: typeof parseComplexValue;
    createTransformer: typeof createTransformer;
    getAnimatableNone: typeof getAnimatableNone$1;
};

/**
 * A list of value types commonly used for dimensions
 */
declare const dimensionValueTypes: ({
    test: (v: number) => boolean;
    parse: typeof parseFloat;
    transform: (v: number) => number;
} | {
    test: (v: AnyResolvedKeyframe) => boolean;
    parse: typeof parseFloat;
    transform: (v: string | number) => string;
} | ValueType)[];
/**
 * Tests a dimensional value against the list of dimension ValueTypes
 */
declare const findDimensionValueType: (v: any) => {
    test: (v: number) => boolean;
    parse: typeof parseFloat;
    transform: (v: number) => number;
} | {
    test: (v: AnyResolvedKeyframe) => boolean;
    parse: typeof parseFloat;
    transform: (v: string | number) => string;
} | ValueType | undefined;

interface ValueTypeMap {
    [key: string]: ValueType;
}

/**
 * A map of default value types for common values
 */
declare const defaultValueTypes: ValueTypeMap;
/**
 * Gets the default ValueType for the provided value key
 */
declare const getDefaultValueType: (key: string) => ValueType;

declare const numberValueTypes: ValueTypeMap;

declare const transformValueTypes: ValueTypeMap;

declare const number: {
    test: (v: number) => boolean;
    parse: typeof parseFloat;
    transform: (v: number) => number;
};
declare const alpha: {
    transform: (v: number) => number;
    test: (v: number) => boolean;
    parse: typeof parseFloat;
};
declare const scale: {
    default: number;
    test: (v: number) => boolean;
    parse: typeof parseFloat;
    transform: (v: number) => number;
};

declare const degrees: {
    test: (v: AnyResolvedKeyframe) => boolean;
    parse: typeof parseFloat;
    transform: (v: number | string) => string;
};
declare const percent: {
    test: (v: AnyResolvedKeyframe) => boolean;
    parse: typeof parseFloat;
    transform: (v: number | string) => string;
};
declare const px: {
    test: (v: AnyResolvedKeyframe) => boolean;
    parse: typeof parseFloat;
    transform: (v: number | string) => string;
};
declare const vh: {
    test: (v: AnyResolvedKeyframe) => boolean;
    parse: typeof parseFloat;
    transform: (v: number | string) => string;
};
declare const vw: {
    test: (v: AnyResolvedKeyframe) => boolean;
    parse: typeof parseFloat;
    transform: (v: number | string) => string;
};
declare const progressPercentage: {
    parse: (v: string) => number;
    transform: (v: number) => string;
    test: (v: AnyResolvedKeyframe) => boolean;
};

/**
 * Tests a provided value against a ValueType
 */
declare const testValueType: (v: any) => (type: ValueType) => boolean;

declare function getAnimatableNone(key: string, value: string): any;

/**
 * Tests a value against the list of ValueTypes
 */
declare const findValueType: (v: any) => {
    test: (v: number) => boolean;
    parse: typeof parseFloat;
    transform: (v: number) => number;
} | {
    test: (v: AnyResolvedKeyframe) => boolean;
    parse: typeof parseFloat;
    transform: (v: string | number) => string;
} | ValueType | {
    test: (v: any) => boolean;
    parse: (v: any) => RGBA | HSLA;
    transform: (v: string | RGBA | HSLA) => string;
    getAnimatableNone: (v: string) => string;
} | {
    test: (v: any) => boolean;
    parse: (v: AnyResolvedKeyframe) => ComplexValues;
    createTransformer: (source: AnyResolvedKeyframe) => (v: (string | number | Color)[]) => string;
    getAnimatableNone: (v: AnyResolvedKeyframe) => string;
} | undefined;

/**
 * Provided a value and a ValueType, returns the value as that value type.
 */
declare const getValueAsType: (value: any, type?: ValueType) => any;

declare const isMotionValue: (value: any) => value is MotionValue<any>;

type ViewTransitionAnimationDefinition = {
    keyframes: DOMKeyframesDefinition;
    options: AnimationOptions;
};
type ViewTransitionTarget = {
    layout?: ViewTransitionAnimationDefinition;
    enter?: ViewTransitionAnimationDefinition;
    exit?: ViewTransitionAnimationDefinition;
    new?: ViewTransitionAnimationDefinition;
    old?: ViewTransitionAnimationDefinition;
};
type ViewTransitionOptions = AnimationOptions & {
    interrupt?: "wait" | "immediate";
};
type ViewTransitionTargetDefinition = string | Element;

declare class ViewTransitionBuilder {
    private currentSubject;
    targets: Map<ViewTransitionTargetDefinition, ViewTransitionTarget>;
    update: () => void | Promise<void>;
    options: ViewTransitionOptions;
    notifyReady: (value: GroupAnimation) => void;
    private readyPromise;
    constructor(update: () => void | Promise<void>, options?: ViewTransitionOptions);
    get(subject: ViewTransitionTargetDefinition): this;
    layout(keyframes: DOMKeyframesDefinition, options?: AnimationOptions): this;
    new(keyframes: DOMKeyframesDefinition, options?: AnimationOptions): this;
    old(keyframes: DOMKeyframesDefinition, options?: AnimationOptions): this;
    enter(keyframes: DOMKeyframesDefinition, options?: AnimationOptions): this;
    exit(keyframes: DOMKeyframesDefinition, options?: AnimationOptions): this;
    crossfade(options?: AnimationOptions): this;
    updateTarget(target: "enter" | "exit" | "layout" | "new" | "old", keyframes: DOMKeyframesDefinition, options?: AnimationOptions): void;
    then(resolve: () => void, reject?: () => void): Promise<void>;
}
declare function animateView(update: () => void | Promise<void>, defaultOptions?: ViewTransitionOptions): ViewTransitionBuilder;

declare function getViewAnimationLayerInfo(pseudoElement: string): {
    layer: string;
    type: string;
} | null;

declare function getViewAnimations(): Animation[];

/**
 * @deprecated
 *
 * Import as `frame` instead.
 */
declare const sync: Batcher;
/**
 * @deprecated
 *
 * Use cancelFrame(callback) instead.
 */
declare const cancelSync: Record<string, (process: Process) => void>;

export { type AcceptedAnimations, type ActiveStatsBuffer, type AnimationDefinition, type AnimationGeneratorName, type AnimationGeneratorType, type AnimationOptions, type AnimationOrchestrationOptions, type AnimationPlaybackControls, type AnimationPlaybackControlsWithThen, type AnimationPlaybackLifecycles, type AnimationPlaybackOptions, type AnimationScope, type AnimationState, type AnyResolvedKeyframe, AsyncMotionValueAnimation, type Batcher, type CSSStyleDeclarationWithTransform, type CSSVariableName, type CSSVariableToken, type CancelProcess, type Color, type ComplexValueInfo, type ComplexValues, type DOMKeyframesDefinition, DOMKeyframesResolver, type DOMValueAnimationOptions, type DecayOptions, type DragElastic, type DragHandler, type DraggableProps, type DurationSpringOptions, type DynamicOption, type ElementOrSelector, type EventInfo, type EventOptions, type FrameData, type FrameStats, type GeneratorFactory, type GeneratorFactoryFunction, GroupAnimation, GroupAnimationWithThen, type GroupedAnimations, type HSLA, type InactiveStatsBuffer, type InertiaOptions, type InterpolateOptions, JSAnimation, type KeyframeGenerator, type KeyframeOptions, KeyframeResolver, type LegacyAnimationControls, type MapInputRange, type Mixer, type MixerFactory, type MotionNodeAdvancedOptions, type MotionNodeAnimationOptions, type MotionNodeDragHandlers, type MotionNodeDraggableOptions, type MotionNodeEventOptions, type MotionNodeFocusHandlers, type MotionNodeHoverHandlers, type MotionNodeLayoutOptions, type MotionNodeOptions, type MotionNodePanHandlers, type MotionNodeTapHandlers, type MotionNodeViewportOptions, MotionValue, type MotionValueEventCallbacks, type MotionValueOptions, type MultiTransformer, NativeAnimation, NativeAnimationExtended, type NativeAnimationOptions, type NativeAnimationOptionsExtended, NativeAnimationWrapper, type NumberMap, type OnHoverEndEvent, type OnHoverStartEvent, type OnKeyframesResolved, type OnPressEndEvent, type OnPressStartEvent, type Owner, type PanHandler, type PanInfo, type PassiveEffect, type PointerEventOptions, type PressGestureInfo, type Process, type ProgressTimeline, type RGBA, type RepeatType, type ResolvedConstraints, type ResolvedElastic, type ResolvedKeyframes, type ResolvedValueKeyframe, type ResolvedValues, type SVGAttributes, type SVGForcedAttrKeyframesDefinition, type SVGForcedAttrProperties, type SVGForcedAttrTransitions, type SVGKeyframesDefinition, type SVGPathKeyframesDefinition, type SVGPathProperties, type SVGPathTransitions, type SVGTransitions, type Schedule, type SelectorCache, type SingleTransformer, type Spring, type SpringOptions, type StaggerOptions, type StaggerOrigin, type StartAnimation, type Stats, type StatsBuffer, type StatsRecording, type StatsSummary, type Step, type StepId, type Steps, type StyleKeyframesDefinition, type StyleTransitions, type Subscriber, type Summary, type TapHandlers, type TapInfo, type Target, type TargetAndTransition, type TargetResolver, type TimelineWithFallback, type TransformInputRange, type TransformOptions, type TransformProperties, type TransformTemplate, type Transformer, type Transition, type TransitionWithValueOverrides, type Tween, type UnresolvedKeyframes, type UnresolvedValueKeyframe, type ValueAnimationOptions, type ValueAnimationOptionsWithRenderContext, type ValueAnimationTransition, type ValueAnimationWithDynamicDelay, type ValueIndexes, type ValueKeyframe, type ValueKeyframesDefinition, type ValueTransformer, type ValueTransition, type ValueType, type ValueTypeMap, type VariableKeyframesDefinition, type VariableTransitions, type Variant, type VariantLabels, type Variants, type VelocityOptions, type ViewTransitionAnimationDefinition, ViewTransitionBuilder, type ViewTransitionOptions, type ViewTransitionTarget, type ViewTransitionTargetDefinition, type ViewportEventHandler, type ViewportOptions, type WithQuerySelectorAll, acceleratedValues, activeAnimations, addAttrValue, addStyleValue, alpha, analyseComplexValue, animateValue, animateView, animationMapKey, applyGeneratorOptions, applyPxDefaults, attachSpring, attrEffect, calcGeneratorDuration, cancelFrame, cancelMicrotask, cancelSync, collectMotionValues, color, complex, convertOffsetToTimes, createGeneratorEasing, createRenderBatcher, cubicBezierAsString, defaultEasing, defaultOffset, defaultTransformValue, defaultValueTypes, degrees, dimensionValueTypes, fillOffset, fillWildcards, findDimensionValueType, findValueType, flushKeyframeResolvers, frame, frameData, frameSteps, generateLinearEasing, getAnimatableNone, getAnimationMap, getComputedStyle, getDefaultValueType, getMixer, getOriginIndex, getValueAsType, getValueTransition, getVariableValue, getViewAnimationLayerInfo, getViewAnimations, hex, hover, hsla, hslaToRgba, inertia, interpolate, invisibleValues, isCSSVariableName, isCSSVariableToken, isDragActive, isDragging, isGenerator, isHTMLElement, isMotionValue, isNodeOrChild, isPrimaryPointer, isSVGElement, isSVGSVGElement, isWaapiSupportedEasing, keyframes, makeAnimationInstant, mapEasingToNativeEasing, mapValue, maxGeneratorDuration, microtask, mix, mixArray, mixColor, mixComplex, mixImmediate, mixLinearColor, mixNumber, mixObject, mixVisibility, motionValue, number, numberValueTypes, observeTimeline, parseCSSVariable, parseValueFromTransform, percent, positionalKeys, press, progressPercentage, propEffect, px, readTransformValue, recordStats, resize, resolveElements, rgbUnit, rgba, scale, setDragLock, setStyle, spring, springValue, stagger, startWaapiAnimation, statsBuffer, styleEffect, supportedWaapiEasing, supportsBrowserAnimation, supportsFlags, supportsLinearEasing, supportsPartialKeyframes, supportsScrollTimeline, svgEffect, sync, testValueType, time, transform, transformPropOrder, transformProps, transformValue, transformValueTypes, vh, vw };
