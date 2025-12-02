'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var jsxRuntime = require('react/jsx-runtime');
var motionUtils = require('motion-utils');
var react = require('react');
var motionDom = require('motion-dom');

const LayoutGroupContext = react.createContext({});

const LazyContext = react.createContext({ strict: false });

/**
 * @public
 */
const MotionConfigContext = react.createContext({
    transformPagePoint: (p) => p,
    isStatic: false,
    reducedMotion: "never",
});

const MotionContext = /* @__PURE__ */ react.createContext({});

function isAnimationControls(v) {
    return (v !== null &&
        typeof v === "object" &&
        typeof v.start === "function");
}

/**
 * Decides if the supplied variable is variant label
 */
function isVariantLabel(v) {
    return typeof v === "string" || Array.isArray(v);
}

const variantPriorityOrder = [
    "animate",
    "whileInView",
    "whileFocus",
    "whileHover",
    "whileTap",
    "whileDrag",
    "exit",
];
const variantProps = ["initial", ...variantPriorityOrder];

function isControllingVariants(props) {
    return (isAnimationControls(props.animate) ||
        variantProps.some((name) => isVariantLabel(props[name])));
}
function isVariantNode(props) {
    return Boolean(isControllingVariants(props) || props.variants);
}

function getCurrentTreeVariants(props, context) {
    if (isControllingVariants(props)) {
        const { initial, animate } = props;
        return {
            initial: initial === false || isVariantLabel(initial)
                ? initial
                : undefined,
            animate: isVariantLabel(animate) ? animate : undefined,
        };
    }
    return props.inherit !== false ? context : {};
}

function useCreateMotionContext(props) {
    const { initial, animate } = getCurrentTreeVariants(props, react.useContext(MotionContext));
    return react.useMemo(() => ({ initial, animate }), [variantLabelsAsDependency(initial), variantLabelsAsDependency(animate)]);
}
function variantLabelsAsDependency(prop) {
    return Array.isArray(prop) ? prop.join(" ") : prop;
}

const scaleCorrectors = {};

function isForcedMotionValue(key, { layout, layoutId }) {
    return (motionDom.transformProps.has(key) ||
        key.startsWith("origin") ||
        ((layout || layoutId !== undefined) &&
            (!!scaleCorrectors[key] || key === "opacity")));
}

const translateAlias = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective",
};
const numTransforms = motionDom.transformPropOrder.length;
/**
 * Build a CSS transform style from individual x/y/scale etc properties.
 *
 * This outputs with a default order of transforms/scales/rotations, this can be customised by
 * providing a transformTemplate function.
 */
function buildTransform(latestValues, transform, transformTemplate) {
    // The transform string we're going to build into.
    let transformString = "";
    let transformIsDefault = true;
    /**
     * Loop over all possible transforms in order, adding the ones that
     * are present to the transform string.
     */
    for (let i = 0; i < numTransforms; i++) {
        const key = motionDom.transformPropOrder[i];
        const value = latestValues[key];
        if (value === undefined)
            continue;
        let valueIsDefault = true;
        if (typeof value === "number") {
            valueIsDefault = value === (key.startsWith("scale") ? 1 : 0);
        }
        else {
            valueIsDefault = parseFloat(value) === 0;
        }
        if (!valueIsDefault || transformTemplate) {
            const valueAsType = motionDom.getValueAsType(value, motionDom.numberValueTypes[key]);
            if (!valueIsDefault) {
                transformIsDefault = false;
                const transformName = translateAlias[key] || key;
                transformString += `${transformName}(${valueAsType}) `;
            }
            if (transformTemplate) {
                transform[key] = valueAsType;
            }
        }
    }
    transformString = transformString.trim();
    // If we have a custom `transform` template, pass our transform values and
    // generated transformString to that before returning
    if (transformTemplate) {
        transformString = transformTemplate(transform, transformIsDefault ? "" : transformString);
    }
    else if (transformIsDefault) {
        transformString = "none";
    }
    return transformString;
}

function buildHTMLStyles(state, latestValues, transformTemplate) {
    const { style, vars, transformOrigin } = state;
    // Track whether we encounter any transform or transformOrigin values.
    let hasTransform = false;
    let hasTransformOrigin = false;
    /**
     * Loop over all our latest animated values and decide whether to handle them
     * as a style or CSS variable.
     *
     * Transforms and transform origins are kept separately for further processing.
     */
    for (const key in latestValues) {
        const value = latestValues[key];
        if (motionDom.transformProps.has(key)) {
            // If this is a transform, flag to enable further transform processing
            hasTransform = true;
            continue;
        }
        else if (motionDom.isCSSVariableName(key)) {
            vars[key] = value;
            continue;
        }
        else {
            // Convert the value to its default value type, ie 0 -> "0px"
            const valueAsType = motionDom.getValueAsType(value, motionDom.numberValueTypes[key]);
            if (key.startsWith("origin")) {
                // If this is a transform origin, flag and enable further transform-origin processing
                hasTransformOrigin = true;
                transformOrigin[key] =
                    valueAsType;
            }
            else {
                style[key] = valueAsType;
            }
        }
    }
    if (!latestValues.transform) {
        if (hasTransform || transformTemplate) {
            style.transform = buildTransform(latestValues, state.transform, transformTemplate);
        }
        else if (style.transform) {
            /**
             * If we have previously created a transform but currently don't have any,
             * reset transform style to none.
             */
            style.transform = "none";
        }
    }
    /**
     * Build a transformOrigin style. Uses the same defaults as the browser for
     * undefined origins.
     */
    if (hasTransformOrigin) {
        const { originX = "50%", originY = "50%", originZ = 0, } = transformOrigin;
        style.transformOrigin = `${originX} ${originY} ${originZ}`;
    }
}

const createHtmlRenderState = () => ({
    style: {},
    transform: {},
    transformOrigin: {},
    vars: {},
});

function copyRawValuesOnly(target, source, props) {
    for (const key in source) {
        if (!motionDom.isMotionValue(source[key]) && !isForcedMotionValue(key, props)) {
            target[key] = source[key];
        }
    }
}
function useInitialMotionValues({ transformTemplate }, visualState) {
    return react.useMemo(() => {
        const state = createHtmlRenderState();
        buildHTMLStyles(state, visualState, transformTemplate);
        return Object.assign({}, state.vars, state.style);
    }, [visualState]);
}
function useStyle(props, visualState) {
    const styleProp = props.style || {};
    const style = {};
    /**
     * Copy non-Motion Values straight into style
     */
    copyRawValuesOnly(style, styleProp, props);
    Object.assign(style, useInitialMotionValues(props, visualState));
    return style;
}
function useHTMLProps(props, visualState) {
    // The `any` isn't ideal but it is the type of createElement props argument
    const htmlProps = {};
    const style = useStyle(props, visualState);
    if (props.drag && props.dragListener !== false) {
        // Disable the ghost element when a user drags
        htmlProps.draggable = false;
        // Disable text selection
        style.userSelect =
            style.WebkitUserSelect =
                style.WebkitTouchCallout =
                    "none";
        // Disable scrolling on the draggable direction
        style.touchAction =
            props.drag === true
                ? "none"
                : `pan-${props.drag === "x" ? "y" : "x"}`;
    }
    if (props.tabIndex === undefined &&
        (props.onTap || props.onTapStart || props.whileTap)) {
        htmlProps.tabIndex = 0;
    }
    htmlProps.style = style;
    return htmlProps;
}

const dashKeys = {
    offset: "stroke-dashoffset",
    array: "stroke-dasharray",
};
const camelKeys = {
    offset: "strokeDashoffset",
    array: "strokeDasharray",
};
/**
 * Build SVG path properties. Uses the path's measured length to convert
 * our custom pathLength, pathSpacing and pathOffset into stroke-dashoffset
 * and stroke-dasharray attributes.
 *
 * This function is mutative to reduce per-frame GC.
 */
function buildSVGPath(attrs, length, spacing = 1, offset = 0, useDashCase = true) {
    // Normalise path length by setting SVG attribute pathLength to 1
    attrs.pathLength = 1;
    // We use dash case when setting attributes directly to the DOM node and camel case
    // when defining props on a React component.
    const keys = useDashCase ? dashKeys : camelKeys;
    // Build the dash offset
    attrs[keys.offset] = motionDom.px.transform(-offset);
    // Build the dash array
    const pathLength = motionDom.px.transform(length);
    const pathSpacing = motionDom.px.transform(spacing);
    attrs[keys.array] = `${pathLength} ${pathSpacing}`;
}

/**
 * Build SVG visual attributes, like cx and style.transform
 */
function buildSVGAttrs(state, { attrX, attrY, attrScale, pathLength, pathSpacing = 1, pathOffset = 0, 
// This is object creation, which we try to avoid per-frame.
...latest }, isSVGTag, transformTemplate, styleProp) {
    buildHTMLStyles(state, latest, transformTemplate);
    /**
     * For svg tags we just want to make sure viewBox is animatable and treat all the styles
     * as normal HTML tags.
     */
    if (isSVGTag) {
        if (state.style.viewBox) {
            state.attrs.viewBox = state.style.viewBox;
        }
        return;
    }
    state.attrs = state.style;
    state.style = {};
    const { attrs, style } = state;
    /**
     * However, we apply transforms as CSS transforms.
     * So if we detect a transform, transformOrigin we take it from attrs and copy it into style.
     */
    if (attrs.transform) {
        style.transform = attrs.transform;
        delete attrs.transform;
    }
    if (style.transform || attrs.transformOrigin) {
        style.transformOrigin = attrs.transformOrigin ?? "50% 50%";
        delete attrs.transformOrigin;
    }
    if (style.transform) {
        /**
         * SVG's element transform-origin uses its own median as a reference.
         * Therefore, transformBox becomes a fill-box
         */
        style.transformBox = styleProp?.transformBox ?? "fill-box";
        delete attrs.transformBox;
    }
    // Render attrX/attrY/attrScale as attributes
    if (attrX !== undefined)
        attrs.x = attrX;
    if (attrY !== undefined)
        attrs.y = attrY;
    if (attrScale !== undefined)
        attrs.scale = attrScale;
    // Build SVG path if one has been defined
    if (pathLength !== undefined) {
        buildSVGPath(attrs, pathLength, pathSpacing, pathOffset, false);
    }
}

const createSvgRenderState = () => ({
    ...createHtmlRenderState(),
    attrs: {},
});

const isSVGTag = (tag) => typeof tag === "string" && tag.toLowerCase() === "svg";

function useSVGProps(props, visualState, _isStatic, Component) {
    const visualProps = react.useMemo(() => {
        const state = createSvgRenderState();
        buildSVGAttrs(state, visualState, isSVGTag(Component), props.transformTemplate, props.style);
        return {
            ...state.attrs,
            style: { ...state.style },
        };
    }, [visualState]);
    if (props.style) {
        const rawStyles = {};
        copyRawValuesOnly(rawStyles, props.style, props);
        visualProps.style = { ...rawStyles, ...visualProps.style };
    }
    return visualProps;
}

/**
 * A list of all valid MotionProps.
 *
 * @privateRemarks
 * This doesn't throw if a `MotionProp` name is missing - it should.
 */
const validMotionProps = new Set([
    "animate",
    "exit",
    "variants",
    "initial",
    "style",
    "values",
    "variants",
    "transition",
    "transformTemplate",
    "custom",
    "inherit",
    "onBeforeLayoutMeasure",
    "onAnimationStart",
    "onAnimationComplete",
    "onUpdate",
    "onDragStart",
    "onDrag",
    "onDragEnd",
    "onMeasureDragConstraints",
    "onDirectionLock",
    "onDragTransitionEnd",
    "_dragX",
    "_dragY",
    "onHoverStart",
    "onHoverEnd",
    "onViewportEnter",
    "onViewportLeave",
    "globalTapTarget",
    "ignoreStrict",
    "viewport",
]);
/**
 * Check whether a prop name is a valid `MotionProp` key.
 *
 * @param key - Name of the property to check
 * @returns `true` is key is a valid `MotionProp`.
 *
 * @public
 */
function isValidMotionProp(key) {
    return (key.startsWith("while") ||
        (key.startsWith("drag") && key !== "draggable") ||
        key.startsWith("layout") ||
        key.startsWith("onTap") ||
        key.startsWith("onPan") ||
        key.startsWith("onLayout") ||
        validMotionProps.has(key));
}

let shouldForward = (key) => !isValidMotionProp(key);
function loadExternalIsValidProp(isValidProp) {
    if (typeof isValidProp !== "function")
        return;
    // Explicitly filter our events
    shouldForward = (key) => key.startsWith("on") ? !isValidMotionProp(key) : isValidProp(key);
}
/**
 * Emotion and Styled Components both allow users to pass through arbitrary props to their components
 * to dynamically generate CSS. They both use the `@emotion/is-prop-valid` package to determine which
 * of these should be passed to the underlying DOM node.
 *
 * However, when styling a Motion component `styled(motion.div)`, both packages pass through *all* props
 * as it's seen as an arbitrary component rather than a DOM node. Motion only allows arbitrary props
 * passed through the `custom` prop so it doesn't *need* the payload or computational overhead of
 * `@emotion/is-prop-valid`, however to fix this problem we need to use it.
 *
 * By making it an optionalDependency we can offer this functionality only in the situations where it's
 * actually required.
 */
try {
    /**
     * We attempt to import this package but require won't be defined in esm environments, in that case
     * isPropValid will have to be provided via `MotionContext`. In a 6.0.0 this should probably be removed
     * in favour of explicit injection.
     */
    loadExternalIsValidProp(require("@emotion/is-prop-valid").default);
}
catch {
    // We don't need to actually do anything here - the fallback is the existing `isPropValid`.
}
function filterProps(props, isDom, forwardMotionProps) {
    const filteredProps = {};
    for (const key in props) {
        /**
         * values is considered a valid prop by Emotion, so if it's present
         * this will be rendered out to the DOM unless explicitly filtered.
         *
         * We check the type as it could be used with the `feColorMatrix`
         * element, which we support.
         */
        if (key === "values" && typeof props.values === "object")
            continue;
        if (shouldForward(key) ||
            (forwardMotionProps === true && isValidMotionProp(key)) ||
            (!isDom && !isValidMotionProp(key)) ||
            // If trying to use native HTML drag events, forward drag listeners
            (props["draggable"] &&
                key.startsWith("onDrag"))) {
            filteredProps[key] =
                props[key];
        }
    }
    return filteredProps;
}

/**
 * We keep these listed separately as we use the lowercase tag names as part
 * of the runtime bundle to detect SVG components
 */
const lowercaseSVGElements = [
    "animate",
    "circle",
    "defs",
    "desc",
    "ellipse",
    "g",
    "image",
    "line",
    "filter",
    "marker",
    "mask",
    "metadata",
    "path",
    "pattern",
    "polygon",
    "polyline",
    "rect",
    "stop",
    "switch",
    "symbol",
    "svg",
    "text",
    "tspan",
    "use",
    "view",
];

function isSVGComponent(Component) {
    if (
    /**
     * If it's not a string, it's a custom React component. Currently we only support
     * HTML custom React components.
     */
    typeof Component !== "string" ||
        /**
         * If it contains a dash, the element is a custom HTML webcomponent.
         */
        Component.includes("-")) {
        return false;
    }
    else if (
    /**
     * If it's in our list of lowercase SVG tags, it's an SVG component
     */
    lowercaseSVGElements.indexOf(Component) > -1 ||
        /**
         * If it contains a capital letter, it's an SVG component
         */
        /[A-Z]/u.test(Component)) {
        return true;
    }
    return false;
}

function useRender(Component, props, ref, { latestValues, }, isStatic, forwardMotionProps = false) {
    const useVisualProps = isSVGComponent(Component)
        ? useSVGProps
        : useHTMLProps;
    const visualProps = useVisualProps(props, latestValues, isStatic, Component);
    const filteredProps = filterProps(props, typeof Component === "string", forwardMotionProps);
    const elementProps = Component !== react.Fragment ? { ...filteredProps, ...visualProps, ref } : {};
    /**
     * If component has been handed a motion value as its child,
     * memoise its initial value and render that. Subsequent updates
     * will be handled by the onChange handler
     */
    const { children } = props;
    const renderedChildren = react.useMemo(() => (motionDom.isMotionValue(children) ? children.get() : children), [children]);
    return react.createElement(Component, {
        ...elementProps,
        children: renderedChildren,
    });
}

/**
 * @public
 */
const PresenceContext = 
/* @__PURE__ */ react.createContext(null);

function getValueState(visualElement) {
    const state = [{}, {}];
    return state;
}
function resolveVariantFromProps(props, definition, custom, visualElement) {
    /**
     * If the variant definition is a function, resolve.
     */
    if (typeof definition === "function") {
        const [current, velocity] = getValueState();
        definition = definition(props.custom, current, velocity);
    }
    /**
     * If the variant definition is a variant label, or
     * the function returned a variant label, resolve.
     */
    if (typeof definition === "string") {
        definition = props.variants && props.variants[definition];
    }
    /**
     * At this point we've resolved both functions and variant labels,
     * but the resolved variant label might itself have been a function.
     * If so, resolve. This can only have returned a valid target object.
     */
    if (typeof definition === "function") {
        const [current, velocity] = getValueState();
        definition = definition(props.custom, current, velocity);
    }
    return definition;
}

/**
 * Creates a constant value over the lifecycle of a component.
 *
 * Even if `useMemo` is provided an empty array as its final argument, it doesn't offer
 * a guarantee that it won't re-run for performance reasons later on. By using `useConstant`
 * you can ensure that initialisers don't execute twice or more.
 */
function useConstant(init) {
    const ref = react.useRef(null);
    if (ref.current === null) {
        ref.current = init();
    }
    return ref.current;
}

/**
 * If the provided value is a MotionValue, this returns the actual value, otherwise just the value itself
 *
 * TODO: Remove and move to library
 */
function resolveMotionValue(value) {
    return motionDom.isMotionValue(value) ? value.get() : value;
}

function makeState({ scrapeMotionValuesFromProps, createRenderState, }, props, context, presenceContext) {
    const state = {
        latestValues: makeLatestValues(props, context, presenceContext, scrapeMotionValuesFromProps),
        renderState: createRenderState(),
    };
    return state;
}
function makeLatestValues(props, context, presenceContext, scrapeMotionValues) {
    const values = {};
    const motionValues = scrapeMotionValues(props, {});
    for (const key in motionValues) {
        values[key] = resolveMotionValue(motionValues[key]);
    }
    let { initial, animate } = props;
    const isControllingVariants$1 = isControllingVariants(props);
    const isVariantNode$1 = isVariantNode(props);
    if (context &&
        isVariantNode$1 &&
        !isControllingVariants$1 &&
        props.inherit !== false) {
        if (initial === undefined)
            initial = context.initial;
        if (animate === undefined)
            animate = context.animate;
    }
    let isInitialAnimationBlocked = presenceContext
        ? presenceContext.initial === false
        : false;
    isInitialAnimationBlocked = isInitialAnimationBlocked || initial === false;
    const variantToSet = isInitialAnimationBlocked ? animate : initial;
    if (variantToSet &&
        typeof variantToSet !== "boolean" &&
        !isAnimationControls(variantToSet)) {
        const list = Array.isArray(variantToSet) ? variantToSet : [variantToSet];
        for (let i = 0; i < list.length; i++) {
            const resolved = resolveVariantFromProps(props, list[i]);
            if (resolved) {
                const { transitionEnd, transition, ...target } = resolved;
                for (const key in target) {
                    let valueTarget = target[key];
                    if (Array.isArray(valueTarget)) {
                        /**
                         * Take final keyframe if the initial animation is blocked because
                         * we want to initialise at the end of that blocked animation.
                         */
                        const index = isInitialAnimationBlocked
                            ? valueTarget.length - 1
                            : 0;
                        valueTarget = valueTarget[index];
                    }
                    if (valueTarget !== null) {
                        values[key] = valueTarget;
                    }
                }
                for (const key in transitionEnd) {
                    values[key] = transitionEnd[key];
                }
            }
        }
    }
    return values;
}
const makeUseVisualState = (config) => (props, isStatic) => {
    const context = react.useContext(MotionContext);
    const presenceContext = react.useContext(PresenceContext);
    const make = () => makeState(config, props, context, presenceContext);
    return isStatic ? make() : useConstant(make);
};

function scrapeMotionValuesFromProps$1(props, prevProps, visualElement) {
    const { style } = props;
    const newValues = {};
    for (const key in style) {
        if (motionDom.isMotionValue(style[key]) ||
            (prevProps.style &&
                motionDom.isMotionValue(prevProps.style[key])) ||
            isForcedMotionValue(key, props) ||
            visualElement?.getValue(key)?.liveStyle !== undefined) {
            newValues[key] = style[key];
        }
    }
    return newValues;
}

const useHTMLVisualState = /*@__PURE__*/ makeUseVisualState({
    scrapeMotionValuesFromProps: scrapeMotionValuesFromProps$1,
    createRenderState: createHtmlRenderState,
});

function scrapeMotionValuesFromProps(props, prevProps, visualElement) {
    const newValues = scrapeMotionValuesFromProps$1(props, prevProps, visualElement);
    for (const key in props) {
        if (motionDom.isMotionValue(props[key]) ||
            motionDom.isMotionValue(prevProps[key])) {
            const targetKey = motionDom.transformPropOrder.indexOf(key) !== -1
                ? "attr" + key.charAt(0).toUpperCase() + key.substring(1)
                : key;
            newValues[targetKey] = props[key];
        }
    }
    return newValues;
}

const useSVGVisualState = /*@__PURE__*/ makeUseVisualState({
    scrapeMotionValuesFromProps: scrapeMotionValuesFromProps,
    createRenderState: createSvgRenderState,
});

const isBrowser = typeof window !== "undefined";

const featureProps = {
    animation: [
        "animate",
        "variants",
        "whileHover",
        "whileTap",
        "exit",
        "whileInView",
        "whileFocus",
        "whileDrag",
    ],
    exit: ["exit"],
    drag: ["drag", "dragControls"],
    focus: ["whileFocus"],
    hover: ["whileHover", "onHoverStart", "onHoverEnd"],
    tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
    pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
    inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
    layout: ["layout", "layoutId"],
};
const featureDefinitions = {};
for (const key in featureProps) {
    featureDefinitions[key] = {
        isEnabled: (props) => featureProps[key].some((name) => !!props[name]),
    };
}

const motionComponentSymbol = Symbol.for("motionComponentSymbol");

function isRefObject(ref) {
    return (ref &&
        typeof ref === "object" &&
        Object.prototype.hasOwnProperty.call(ref, "current"));
}

/**
 * Creates a ref function that, when called, hydrates the provided
 * external ref and VisualElement.
 */
function useMotionRef(visualState, visualElement, externalRef) {
    return react.useCallback((instance) => {
        if (instance) {
            visualState.onMount && visualState.onMount(instance);
        }
        if (visualElement) {
            if (instance) {
                visualElement.mount(instance);
            }
            else {
                visualElement.unmount();
            }
        }
        if (externalRef) {
            if (typeof externalRef === "function") {
                externalRef(instance);
            }
            else if (isRefObject(externalRef)) {
                externalRef.current = instance;
            }
        }
    }, 
    /**
     * Include externalRef in dependencies to ensure the callback updates
     * when the ref changes, allowing proper ref forwarding.
     */
    [visualElement]);
}

/**
 * Convert camelCase to dash-case properties.
 */
const camelToDash = (str) => str.replace(/([a-z])([A-Z])/gu, "$1-$2").toLowerCase();

const optimizedAppearDataId = "framerAppearId";
const optimizedAppearDataAttribute = "data-" + camelToDash(optimizedAppearDataId);

/**
 * Internal, exported only for usage in Framer
 */
const SwitchLayoutGroupContext = react.createContext({});

const useIsomorphicLayoutEffect = isBrowser ? react.useLayoutEffect : react.useEffect;

function useVisualElement(Component, visualState, props, createVisualElement, ProjectionNodeConstructor) {
    const { visualElement: parent } = react.useContext(MotionContext);
    const lazyContext = react.useContext(LazyContext);
    const presenceContext = react.useContext(PresenceContext);
    const reducedMotionConfig = react.useContext(MotionConfigContext).reducedMotion;
    const visualElementRef = react.useRef(null);
    /**
     * If we haven't preloaded a renderer, check to see if we have one lazy-loaded
     */
    createVisualElement =
        createVisualElement ||
            lazyContext.renderer;
    if (!visualElementRef.current && createVisualElement) {
        visualElementRef.current = createVisualElement(Component, {
            visualState,
            parent,
            props,
            presenceContext,
            blockInitialAnimation: presenceContext
                ? presenceContext.initial === false
                : false,
            reducedMotionConfig,
        });
    }
    const visualElement = visualElementRef.current;
    /**
     * Load Motion gesture and animation features. These are rendered as renderless
     * components so each feature can optionally make use of React lifecycle methods.
     */
    const initialLayoutGroupConfig = react.useContext(SwitchLayoutGroupContext);
    if (visualElement &&
        !visualElement.projection &&
        ProjectionNodeConstructor &&
        (visualElement.type === "html" || visualElement.type === "svg")) {
        createProjectionNode(visualElementRef.current, props, ProjectionNodeConstructor, initialLayoutGroupConfig);
    }
    const isMounted = react.useRef(false);
    react.useInsertionEffect(() => {
        /**
         * Check the component has already mounted before calling
         * `update` unnecessarily. This ensures we skip the initial update.
         */
        if (visualElement && isMounted.current) {
            visualElement.update(props, presenceContext);
        }
    });
    /**
     * Cache this value as we want to know whether HandoffAppearAnimations
     * was present on initial render - it will be deleted after this.
     */
    const optimisedAppearId = props[optimizedAppearDataAttribute];
    const wantsHandoff = react.useRef(Boolean(optimisedAppearId) &&
        !window.MotionHandoffIsComplete?.(optimisedAppearId) &&
        window.MotionHasOptimisedAnimation?.(optimisedAppearId));
    useIsomorphicLayoutEffect(() => {
        if (!visualElement)
            return;
        isMounted.current = true;
        window.MotionIsMounted = true;
        visualElement.updateFeatures();
        visualElement.scheduleRenderMicrotask();
        /**
         * Ideally this function would always run in a useEffect.
         *
         * However, if we have optimised appear animations to handoff from,
         * it needs to happen synchronously to ensure there's no flash of
         * incorrect styles in the event of a hydration error.
         *
         * So if we detect a situtation where optimised appear animations
         * are running, we use useLayoutEffect to trigger animations.
         */
        if (wantsHandoff.current && visualElement.animationState) {
            visualElement.animationState.animateChanges();
        }
    });
    react.useEffect(() => {
        if (!visualElement)
            return;
        if (!wantsHandoff.current && visualElement.animationState) {
            visualElement.animationState.animateChanges();
        }
        if (wantsHandoff.current) {
            // This ensures all future calls to animateChanges() in this component will run in useEffect
            queueMicrotask(() => {
                window.MotionHandoffMarkAsComplete?.(optimisedAppearId);
            });
            wantsHandoff.current = false;
        }
        /**
         * Now we've finished triggering animations for this element we
         * can wipe the enteringChildren set for the next render.
         */
        visualElement.enteringChildren = undefined;
    });
    return visualElement;
}
function createProjectionNode(visualElement, props, ProjectionNodeConstructor, initialPromotionConfig) {
    const { layoutId, layout, drag, dragConstraints, layoutScroll, layoutRoot, layoutCrossfade, } = props;
    visualElement.projection = new ProjectionNodeConstructor(visualElement.latestValues, props["data-framer-portal-id"]
        ? undefined
        : getClosestProjectingNode(visualElement.parent));
    visualElement.projection.setOptions({
        layoutId,
        layout,
        alwaysMeasureLayout: Boolean(drag) || (dragConstraints && isRefObject(dragConstraints)),
        visualElement,
        /**
         * TODO: Update options in an effect. This could be tricky as it'll be too late
         * to update by the time layout animations run.
         * We also need to fix this safeToRemove by linking it up to the one returned by usePresence,
         * ensuring it gets called if there's no potential layout animations.
         *
         */
        animationType: typeof layout === "string" ? layout : "both",
        initialPromotionConfig,
        crossfade: layoutCrossfade,
        layoutScroll,
        layoutRoot,
    });
}
function getClosestProjectingNode(visualElement) {
    if (!visualElement)
        return undefined;
    return visualElement.options.allowProjection !== false
        ? visualElement.projection
        : getClosestProjectingNode(visualElement.parent);
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
function createMotionComponent(Component, { forwardMotionProps = false } = {}, preloadedFeatures, createVisualElement) {
    const useVisualState = isSVGComponent(Component)
        ? useSVGVisualState
        : useHTMLVisualState;
    function MotionDOMComponent(props, externalRef) {
        /**
         * If we need to measure the element we load this functionality in a
         * separate class component in order to gain access to getSnapshotBeforeUpdate.
         */
        let MeasureLayout;
        const configAndProps = {
            ...react.useContext(MotionConfigContext),
            ...props,
            layoutId: useLayoutId(props),
        };
        const { isStatic } = configAndProps;
        const context = useCreateMotionContext(props);
        const visualState = useVisualState(props, isStatic);
        if (!isStatic && isBrowser) {
            useStrictMode(configAndProps, preloadedFeatures);
            const layoutProjection = getProjectionFunctionality(configAndProps);
            MeasureLayout = layoutProjection.MeasureLayout;
            /**
             * Create a VisualElement for this component. A VisualElement provides a common
             * interface to renderer-specific APIs (ie DOM/Three.js etc) as well as
             * providing a way of rendering to these APIs outside of the React render loop
             * for more performant animations and interactions
             */
            context.visualElement = useVisualElement(Component, visualState, configAndProps, createVisualElement, layoutProjection.ProjectionNode);
        }
        /**
         * The mount order and hierarchy is specific to ensure our element ref
         * is hydrated by the time features fire their effects.
         */
        return (jsxRuntime.jsxs(MotionContext.Provider, { value: context, children: [MeasureLayout && context.visualElement ? (jsxRuntime.jsx(MeasureLayout, { visualElement: context.visualElement, ...configAndProps })) : null, useRender(Component, props, useMotionRef(visualState, context.visualElement, externalRef), visualState, isStatic, forwardMotionProps)] }));
    }
    MotionDOMComponent.displayName = `motion.${typeof Component === "string"
        ? Component
        : `create(${Component.displayName ?? Component.name ?? ""})`}`;
    const ForwardRefMotionComponent = react.forwardRef(MotionDOMComponent);
    ForwardRefMotionComponent[motionComponentSymbol] = Component;
    return ForwardRefMotionComponent;
}
function useLayoutId({ layoutId }) {
    const layoutGroupId = react.useContext(LayoutGroupContext).id;
    return layoutGroupId && layoutId !== undefined
        ? layoutGroupId + "-" + layoutId
        : layoutId;
}
function useStrictMode(configAndProps, preloadedFeatures) {
    const isStrict = react.useContext(LazyContext).strict;
    /**
     * If we're in development mode, check to make sure we're not rendering a motion component
     * as a child of LazyMotion, as this will break the file-size benefits of using it.
     */
    if (process.env.NODE_ENV !== "production" &&
        preloadedFeatures &&
        isStrict) {
        const strictMessage = "You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead.";
        configAndProps.ignoreStrict
            ? motionUtils.warning(false, strictMessage, "lazy-strict-mode")
            : motionUtils.invariant(false, strictMessage, "lazy-strict-mode");
    }
}
function getProjectionFunctionality(props) {
    const { drag, layout } = featureDefinitions;
    if (!drag && !layout)
        return {};
    const combined = { ...drag, ...layout };
    return {
        MeasureLayout: drag?.isEnabled(props) || layout?.isEnabled(props)
            ? combined.MeasureLayout
            : undefined,
        ProjectionNode: combined.ProjectionNode,
    };
}

function createMinimalMotionComponent(Component, options) {
    return createMotionComponent(Component, options);
}

/**
 * HTML components
 */
const MotionA = /*@__PURE__*/ createMinimalMotionComponent("a");
const MotionAbbr = /*@__PURE__*/ createMinimalMotionComponent("abbr");
const MotionAddress = 
/*@__PURE__*/ createMinimalMotionComponent("address");
const MotionArea = /*@__PURE__*/ createMinimalMotionComponent("area");
const MotionArticle = 
/*@__PURE__*/ createMinimalMotionComponent("article");
const MotionAside = /*@__PURE__*/ createMinimalMotionComponent("aside");
const MotionAudio = /*@__PURE__*/ createMinimalMotionComponent("audio");
const MotionB = /*@__PURE__*/ createMinimalMotionComponent("b");
const MotionBase = /*@__PURE__*/ createMinimalMotionComponent("base");
const MotionBdi = /*@__PURE__*/ createMinimalMotionComponent("bdi");
const MotionBdo = /*@__PURE__*/ createMinimalMotionComponent("bdo");
const MotionBig = /*@__PURE__*/ createMinimalMotionComponent("big");
const MotionBlockquote = 
/*@__PURE__*/ createMinimalMotionComponent("blockquote");
const MotionBody = /*@__PURE__*/ createMinimalMotionComponent("body");
const MotionButton = /*@__PURE__*/ createMinimalMotionComponent("button");
const MotionCanvas = /*@__PURE__*/ createMinimalMotionComponent("canvas");
const MotionCaption = 
/*@__PURE__*/ createMinimalMotionComponent("caption");
const MotionCite = /*@__PURE__*/ createMinimalMotionComponent("cite");
const MotionCode = /*@__PURE__*/ createMinimalMotionComponent("code");
const MotionCol = /*@__PURE__*/ createMinimalMotionComponent("col");
const MotionColgroup = 
/*@__PURE__*/ createMinimalMotionComponent("colgroup");
const MotionData = /*@__PURE__*/ createMinimalMotionComponent("data");
const MotionDatalist = 
/*@__PURE__*/ createMinimalMotionComponent("datalist");
const MotionDd = /*@__PURE__*/ createMinimalMotionComponent("dd");
const MotionDel = /*@__PURE__*/ createMinimalMotionComponent("del");
const MotionDetails = 
/*@__PURE__*/ createMinimalMotionComponent("details");
const MotionDfn = /*@__PURE__*/ createMinimalMotionComponent("dfn");
const MotionDialog = /*@__PURE__*/ createMinimalMotionComponent("dialog");
const MotionDiv = /*@__PURE__*/ createMinimalMotionComponent("div");
const MotionDl = /*@__PURE__*/ createMinimalMotionComponent("dl");
const MotionDt = /*@__PURE__*/ createMinimalMotionComponent("dt");
const MotionEm = /*@__PURE__*/ createMinimalMotionComponent("em");
const MotionEmbed = /*@__PURE__*/ createMinimalMotionComponent("embed");
const MotionFieldset = 
/*@__PURE__*/ createMinimalMotionComponent("fieldset");
const MotionFigcaption = 
/*@__PURE__*/ createMinimalMotionComponent("figcaption");
const MotionFigure = /*@__PURE__*/ createMinimalMotionComponent("figure");
const MotionFooter = /*@__PURE__*/ createMinimalMotionComponent("footer");
const MotionForm = /*@__PURE__*/ createMinimalMotionComponent("form");
const MotionH1 = /*@__PURE__*/ createMinimalMotionComponent("h1");
const MotionH2 = /*@__PURE__*/ createMinimalMotionComponent("h2");
const MotionH3 = /*@__PURE__*/ createMinimalMotionComponent("h3");
const MotionH4 = /*@__PURE__*/ createMinimalMotionComponent("h4");
const MotionH5 = /*@__PURE__*/ createMinimalMotionComponent("h5");
const MotionH6 = /*@__PURE__*/ createMinimalMotionComponent("h6");
const MotionHead = /*@__PURE__*/ createMinimalMotionComponent("head");
const MotionHeader = /*@__PURE__*/ createMinimalMotionComponent("header");
const MotionHgroup = /*@__PURE__*/ createMinimalMotionComponent("hgroup");
const MotionHr = /*@__PURE__*/ createMinimalMotionComponent("hr");
const MotionHtml = /*@__PURE__*/ createMinimalMotionComponent("html");
const MotionI = /*@__PURE__*/ createMinimalMotionComponent("i");
const MotionIframe = /*@__PURE__*/ createMinimalMotionComponent("iframe");
const MotionImg = /*@__PURE__*/ createMinimalMotionComponent("img");
const MotionInput = /*@__PURE__*/ createMinimalMotionComponent("input");
const MotionIns = /*@__PURE__*/ createMinimalMotionComponent("ins");
const MotionKbd = /*@__PURE__*/ createMinimalMotionComponent("kbd");
const MotionKeygen = /*@__PURE__*/ createMinimalMotionComponent("keygen");
const MotionLabel = /*@__PURE__*/ createMinimalMotionComponent("label");
const MotionLegend = /*@__PURE__*/ createMinimalMotionComponent("legend");
const MotionLi = /*@__PURE__*/ createMinimalMotionComponent("li");
const MotionLink = /*@__PURE__*/ createMinimalMotionComponent("link");
const MotionMain = /*@__PURE__*/ createMinimalMotionComponent("main");
const MotionMap = /*@__PURE__*/ createMinimalMotionComponent("map");
const MotionMark = /*@__PURE__*/ createMinimalMotionComponent("mark");
const MotionMenu = /*@__PURE__*/ createMinimalMotionComponent("menu");
const MotionMenuitem = 
/*@__PURE__*/ createMinimalMotionComponent("menuitem");
const MotionMeter = /*@__PURE__*/ createMinimalMotionComponent("meter");
const MotionNav = /*@__PURE__*/ createMinimalMotionComponent("nav");
const MotionObject = /*@__PURE__*/ createMinimalMotionComponent("object");
const MotionOl = /*@__PURE__*/ createMinimalMotionComponent("ol");
const MotionOptgroup = 
/*@__PURE__*/ createMinimalMotionComponent("optgroup");
const MotionOption = /*@__PURE__*/ createMinimalMotionComponent("option");
const MotionOutput = /*@__PURE__*/ createMinimalMotionComponent("output");
const MotionP = /*@__PURE__*/ createMinimalMotionComponent("p");
const MotionParam = /*@__PURE__*/ createMinimalMotionComponent("param");
const MotionPicture = 
/*@__PURE__*/ createMinimalMotionComponent("picture");
const MotionPre = /*@__PURE__*/ createMinimalMotionComponent("pre");
const MotionProgress = 
/*@__PURE__*/ createMinimalMotionComponent("progress");
const MotionQ = /*@__PURE__*/ createMinimalMotionComponent("q");
const MotionRp = /*@__PURE__*/ createMinimalMotionComponent("rp");
const MotionRt = /*@__PURE__*/ createMinimalMotionComponent("rt");
const MotionRuby = /*@__PURE__*/ createMinimalMotionComponent("ruby");
const MotionS = /*@__PURE__*/ createMinimalMotionComponent("s");
const MotionSamp = /*@__PURE__*/ createMinimalMotionComponent("samp");
const MotionScript = /*@__PURE__*/ createMinimalMotionComponent("script");
const MotionSection = 
/*@__PURE__*/ createMinimalMotionComponent("section");
const MotionSelect = /*@__PURE__*/ createMinimalMotionComponent("select");
const MotionSmall = /*@__PURE__*/ createMinimalMotionComponent("small");
const MotionSource = /*@__PURE__*/ createMinimalMotionComponent("source");
const MotionSpan = /*@__PURE__*/ createMinimalMotionComponent("span");
const MotionStrong = /*@__PURE__*/ createMinimalMotionComponent("strong");
const MotionStyle = /*@__PURE__*/ createMinimalMotionComponent("style");
const MotionSub = /*@__PURE__*/ createMinimalMotionComponent("sub");
const MotionSummary = 
/*@__PURE__*/ createMinimalMotionComponent("summary");
const MotionSup = /*@__PURE__*/ createMinimalMotionComponent("sup");
const MotionTable = /*@__PURE__*/ createMinimalMotionComponent("table");
const MotionTbody = /*@__PURE__*/ createMinimalMotionComponent("tbody");
const MotionTd = /*@__PURE__*/ createMinimalMotionComponent("td");
const MotionTextarea = 
/*@__PURE__*/ createMinimalMotionComponent("textarea");
const MotionTfoot = /*@__PURE__*/ createMinimalMotionComponent("tfoot");
const MotionTh = /*@__PURE__*/ createMinimalMotionComponent("th");
const MotionThead = /*@__PURE__*/ createMinimalMotionComponent("thead");
const MotionTime = /*@__PURE__*/ createMinimalMotionComponent("time");
const MotionTitle = /*@__PURE__*/ createMinimalMotionComponent("title");
const MotionTr = /*@__PURE__*/ createMinimalMotionComponent("tr");
const MotionTrack = /*@__PURE__*/ createMinimalMotionComponent("track");
const MotionU = /*@__PURE__*/ createMinimalMotionComponent("u");
const MotionUl = /*@__PURE__*/ createMinimalMotionComponent("ul");
const MotionVideo = /*@__PURE__*/ createMinimalMotionComponent("video");
const MotionWbr = /*@__PURE__*/ createMinimalMotionComponent("wbr");
const MotionWebview = 
/*@__PURE__*/ createMinimalMotionComponent("webview");
/**
 * SVG components
 */
const MotionAnimate = 
/*@__PURE__*/ createMinimalMotionComponent("animate");
const MotionCircle = /*@__PURE__*/ createMinimalMotionComponent("circle");
const MotionDefs = /*@__PURE__*/ createMinimalMotionComponent("defs");
const MotionDesc = /*@__PURE__*/ createMinimalMotionComponent("desc");
const MotionEllipse = 
/*@__PURE__*/ createMinimalMotionComponent("ellipse");
const MotionG = /*@__PURE__*/ createMinimalMotionComponent("g");
const MotionImage = /*@__PURE__*/ createMinimalMotionComponent("image");
const MotionLine = /*@__PURE__*/ createMinimalMotionComponent("line");
const MotionFilter = /*@__PURE__*/ createMinimalMotionComponent("filter");
const MotionMarker = /*@__PURE__*/ createMinimalMotionComponent("marker");
const MotionMask = /*@__PURE__*/ createMinimalMotionComponent("mask");
const MotionMetadata = 
/*@__PURE__*/ createMinimalMotionComponent("metadata");
const MotionPath = /*@__PURE__*/ createMinimalMotionComponent("path");
const MotionPattern = 
/*@__PURE__*/ createMinimalMotionComponent("pattern");
const MotionPolygon = 
/*@__PURE__*/ createMinimalMotionComponent("polygon");
const MotionPolyline = 
/*@__PURE__*/ createMinimalMotionComponent("polyline");
const MotionRect = /*@__PURE__*/ createMinimalMotionComponent("rect");
const MotionStop = /*@__PURE__*/ createMinimalMotionComponent("stop");
const MotionSvg = /*@__PURE__*/ createMinimalMotionComponent("svg");
const MotionSymbol = /*@__PURE__*/ createMinimalMotionComponent("symbol");
const MotionText = /*@__PURE__*/ createMinimalMotionComponent("text");
const MotionTspan = /*@__PURE__*/ createMinimalMotionComponent("tspan");
const MotionUse = /*@__PURE__*/ createMinimalMotionComponent("use");
const MotionView = /*@__PURE__*/ createMinimalMotionComponent("view");
const MotionClipPath = 
/*@__PURE__*/ createMinimalMotionComponent("clipPath");
const MotionFeBlend = 
/*@__PURE__*/ createMinimalMotionComponent("feBlend");
const MotionFeColorMatrix = 
/*@__PURE__*/ createMinimalMotionComponent("feColorMatrix");
const MotionFeComponentTransfer = 
/*@__PURE__*/ createMinimalMotionComponent("feComponentTransfer");
const MotionFeComposite = 
/*@__PURE__*/ createMinimalMotionComponent("feComposite");
const MotionFeConvolveMatrix = 
/*@__PURE__*/ createMinimalMotionComponent("feConvolveMatrix");
const MotionFeDiffuseLighting = 
/*@__PURE__*/ createMinimalMotionComponent("feDiffuseLighting");
const MotionFeDisplacementMap = 
/*@__PURE__*/ createMinimalMotionComponent("feDisplacementMap");
const MotionFeDistantLight = 
/*@__PURE__*/ createMinimalMotionComponent("feDistantLight");
const MotionFeDropShadow = 
/*@__PURE__*/ createMinimalMotionComponent("feDropShadow");
const MotionFeFlood = 
/*@__PURE__*/ createMinimalMotionComponent("feFlood");
const MotionFeFuncA = 
/*@__PURE__*/ createMinimalMotionComponent("feFuncA");
const MotionFeFuncB = 
/*@__PURE__*/ createMinimalMotionComponent("feFuncB");
const MotionFeFuncG = 
/*@__PURE__*/ createMinimalMotionComponent("feFuncG");
const MotionFeFuncR = 
/*@__PURE__*/ createMinimalMotionComponent("feFuncR");
const MotionFeGaussianBlur = 
/*@__PURE__*/ createMinimalMotionComponent("feGaussianBlur");
const MotionFeImage = 
/*@__PURE__*/ createMinimalMotionComponent("feImage");
const MotionFeMerge = 
/*@__PURE__*/ createMinimalMotionComponent("feMerge");
const MotionFeMergeNode = 
/*@__PURE__*/ createMinimalMotionComponent("feMergeNode");
const MotionFeMorphology = 
/*@__PURE__*/ createMinimalMotionComponent("feMorphology");
const MotionFeOffset = 
/*@__PURE__*/ createMinimalMotionComponent("feOffset");
const MotionFePointLight = 
/*@__PURE__*/ createMinimalMotionComponent("fePointLight");
const MotionFeSpecularLighting = 
/*@__PURE__*/ createMinimalMotionComponent("feSpecularLighting");
const MotionFeSpotLight = 
/*@__PURE__*/ createMinimalMotionComponent("feSpotLight");
const MotionFeTile = /*@__PURE__*/ createMinimalMotionComponent("feTile");
const MotionFeTurbulence = 
/*@__PURE__*/ createMinimalMotionComponent("feTurbulence");
const MotionForeignObject = 
/*@__PURE__*/ createMinimalMotionComponent("foreignObject");
const MotionLinearGradient = 
/*@__PURE__*/ createMinimalMotionComponent("linearGradient");
const MotionRadialGradient = 
/*@__PURE__*/ createMinimalMotionComponent("radialGradient");
const MotionTextPath = 
/*@__PURE__*/ createMinimalMotionComponent("textPath");

exports.a = MotionA;
exports.abbr = MotionAbbr;
exports.address = MotionAddress;
exports.animate = MotionAnimate;
exports.area = MotionArea;
exports.article = MotionArticle;
exports.aside = MotionAside;
exports.audio = MotionAudio;
exports.b = MotionB;
exports.base = MotionBase;
exports.bdi = MotionBdi;
exports.bdo = MotionBdo;
exports.big = MotionBig;
exports.blockquote = MotionBlockquote;
exports.body = MotionBody;
exports.button = MotionButton;
exports.canvas = MotionCanvas;
exports.caption = MotionCaption;
exports.circle = MotionCircle;
exports.cite = MotionCite;
exports.clipPath = MotionClipPath;
exports.code = MotionCode;
exports.col = MotionCol;
exports.colgroup = MotionColgroup;
exports.create = createMinimalMotionComponent;
exports.data = MotionData;
exports.datalist = MotionDatalist;
exports.dd = MotionDd;
exports.defs = MotionDefs;
exports.del = MotionDel;
exports.desc = MotionDesc;
exports.details = MotionDetails;
exports.dfn = MotionDfn;
exports.dialog = MotionDialog;
exports.div = MotionDiv;
exports.dl = MotionDl;
exports.dt = MotionDt;
exports.ellipse = MotionEllipse;
exports.em = MotionEm;
exports.embed = MotionEmbed;
exports.feBlend = MotionFeBlend;
exports.feColorMatrix = MotionFeColorMatrix;
exports.feComponentTransfer = MotionFeComponentTransfer;
exports.feComposite = MotionFeComposite;
exports.feConvolveMatrix = MotionFeConvolveMatrix;
exports.feDiffuseLighting = MotionFeDiffuseLighting;
exports.feDisplacementMap = MotionFeDisplacementMap;
exports.feDistantLight = MotionFeDistantLight;
exports.feDropShadow = MotionFeDropShadow;
exports.feFlood = MotionFeFlood;
exports.feFuncA = MotionFeFuncA;
exports.feFuncB = MotionFeFuncB;
exports.feFuncG = MotionFeFuncG;
exports.feFuncR = MotionFeFuncR;
exports.feGaussianBlur = MotionFeGaussianBlur;
exports.feImage = MotionFeImage;
exports.feMerge = MotionFeMerge;
exports.feMergeNode = MotionFeMergeNode;
exports.feMorphology = MotionFeMorphology;
exports.feOffset = MotionFeOffset;
exports.fePointLight = MotionFePointLight;
exports.feSpecularLighting = MotionFeSpecularLighting;
exports.feSpotLight = MotionFeSpotLight;
exports.feTile = MotionFeTile;
exports.feTurbulence = MotionFeTurbulence;
exports.fieldset = MotionFieldset;
exports.figcaption = MotionFigcaption;
exports.figure = MotionFigure;
exports.filter = MotionFilter;
exports.footer = MotionFooter;
exports.foreignObject = MotionForeignObject;
exports.form = MotionForm;
exports.g = MotionG;
exports.h1 = MotionH1;
exports.h2 = MotionH2;
exports.h3 = MotionH3;
exports.h4 = MotionH4;
exports.h5 = MotionH5;
exports.h6 = MotionH6;
exports.head = MotionHead;
exports.header = MotionHeader;
exports.hgroup = MotionHgroup;
exports.hr = MotionHr;
exports.html = MotionHtml;
exports.i = MotionI;
exports.iframe = MotionIframe;
exports.image = MotionImage;
exports.img = MotionImg;
exports.input = MotionInput;
exports.ins = MotionIns;
exports.kbd = MotionKbd;
exports.keygen = MotionKeygen;
exports.label = MotionLabel;
exports.legend = MotionLegend;
exports.li = MotionLi;
exports.line = MotionLine;
exports.linearGradient = MotionLinearGradient;
exports.link = MotionLink;
exports.main = MotionMain;
exports.map = MotionMap;
exports.mark = MotionMark;
exports.marker = MotionMarker;
exports.mask = MotionMask;
exports.menu = MotionMenu;
exports.menuitem = MotionMenuitem;
exports.metadata = MotionMetadata;
exports.meter = MotionMeter;
exports.nav = MotionNav;
exports.object = MotionObject;
exports.ol = MotionOl;
exports.optgroup = MotionOptgroup;
exports.option = MotionOption;
exports.output = MotionOutput;
exports.p = MotionP;
exports.param = MotionParam;
exports.path = MotionPath;
exports.pattern = MotionPattern;
exports.picture = MotionPicture;
exports.polygon = MotionPolygon;
exports.polyline = MotionPolyline;
exports.pre = MotionPre;
exports.progress = MotionProgress;
exports.q = MotionQ;
exports.radialGradient = MotionRadialGradient;
exports.rect = MotionRect;
exports.rp = MotionRp;
exports.rt = MotionRt;
exports.ruby = MotionRuby;
exports.s = MotionS;
exports.samp = MotionSamp;
exports.script = MotionScript;
exports.section = MotionSection;
exports.select = MotionSelect;
exports.small = MotionSmall;
exports.source = MotionSource;
exports.span = MotionSpan;
exports.stop = MotionStop;
exports.strong = MotionStrong;
exports.style = MotionStyle;
exports.sub = MotionSub;
exports.summary = MotionSummary;
exports.sup = MotionSup;
exports.svg = MotionSvg;
exports.symbol = MotionSymbol;
exports.table = MotionTable;
exports.tbody = MotionTbody;
exports.td = MotionTd;
exports.text = MotionText;
exports.textPath = MotionTextPath;
exports.textarea = MotionTextarea;
exports.tfoot = MotionTfoot;
exports.th = MotionTh;
exports.thead = MotionThead;
exports.time = MotionTime;
exports.title = MotionTitle;
exports.tr = MotionTr;
exports.track = MotionTrack;
exports.tspan = MotionTspan;
exports.u = MotionU;
exports.ul = MotionUl;
exports.use = MotionUse;
exports.video = MotionVideo;
exports.view = MotionView;
exports.wbr = MotionWbr;
exports.webview = MotionWebview;
