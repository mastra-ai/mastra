"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { warning, invariant } from 'motion-utils';
import { forwardRef, useContext } from 'react';
import { LayoutGroupContext } from '../context/LayoutGroupContext.mjs';
import { LazyContext } from '../context/LazyContext.mjs';
import { MotionConfigContext } from '../context/MotionConfigContext.mjs';
import { MotionContext } from '../context/MotionContext/index.mjs';
import { useCreateMotionContext } from '../context/MotionContext/create.mjs';
import { useRender } from '../render/dom/use-render.mjs';
import { isSVGComponent } from '../render/dom/utils/is-svg-component.mjs';
import { useHTMLVisualState } from '../render/html/use-html-visual-state.mjs';
import { useSVGVisualState } from '../render/svg/use-svg-visual-state.mjs';
import { isBrowser } from '../utils/is-browser.mjs';
import { featureDefinitions } from './features/definitions.mjs';
import { loadFeatures } from './features/load-features.mjs';
import { motionComponentSymbol } from './utils/symbol.mjs';
import { useMotionRef } from './utils/use-motion-ref.mjs';
import { useVisualElement } from './utils/use-visual-element.mjs';

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
    preloadedFeatures && loadFeatures(preloadedFeatures);
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
            ...useContext(MotionConfigContext),
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
        return (jsxs(MotionContext.Provider, { value: context, children: [MeasureLayout && context.visualElement ? (jsx(MeasureLayout, { visualElement: context.visualElement, ...configAndProps })) : null, useRender(Component, props, useMotionRef(visualState, context.visualElement, externalRef), visualState, isStatic, forwardMotionProps)] }));
    }
    MotionDOMComponent.displayName = `motion.${typeof Component === "string"
        ? Component
        : `create(${Component.displayName ?? Component.name ?? ""})`}`;
    const ForwardRefMotionComponent = forwardRef(MotionDOMComponent);
    ForwardRefMotionComponent[motionComponentSymbol] = Component;
    return ForwardRefMotionComponent;
}
function useLayoutId({ layoutId }) {
    const layoutGroupId = useContext(LayoutGroupContext).id;
    return layoutGroupId && layoutId !== undefined
        ? layoutGroupId + "-" + layoutId
        : layoutId;
}
function useStrictMode(configAndProps, preloadedFeatures) {
    const isStrict = useContext(LazyContext).strict;
    /**
     * If we're in development mode, check to make sure we're not rendering a motion component
     * as a child of LazyMotion, as this will break the file-size benefits of using it.
     */
    if (process.env.NODE_ENV !== "production" &&
        preloadedFeatures &&
        isStrict) {
        const strictMessage = "You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead.";
        configAndProps.ignoreStrict
            ? warning(false, strictMessage, "lazy-strict-mode")
            : invariant(false, strictMessage, "lazy-strict-mode");
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

export { createMotionComponent };
