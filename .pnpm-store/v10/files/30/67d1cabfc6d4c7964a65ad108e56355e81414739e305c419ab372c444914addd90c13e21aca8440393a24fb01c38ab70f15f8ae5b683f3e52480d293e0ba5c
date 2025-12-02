"use client";
import { jsx } from 'react/jsx-runtime';
import * as React from 'react';
import { useId, useMemo } from 'react';
import { PresenceContext } from '../../context/PresenceContext.mjs';
import { useConstant } from '../../utils/use-constant.mjs';
import { PopChild } from './PopChild.mjs';

const PresenceChild = ({ children, initial, isPresent, onExitComplete, custom, presenceAffectsLayout, mode, anchorX, root }) => {
    const presenceChildren = useConstant(newChildrenMap);
    const id = useId();
    let isReusedContext = true;
    let context = useMemo(() => {
        isReusedContext = false;
        return {
            id,
            initial,
            isPresent,
            custom,
            onExitComplete: (childId) => {
                presenceChildren.set(childId, true);
                for (const isComplete of presenceChildren.values()) {
                    if (!isComplete)
                        return; // can stop searching when any is incomplete
                }
                onExitComplete && onExitComplete();
            },
            register: (childId) => {
                presenceChildren.set(childId, false);
                return () => presenceChildren.delete(childId);
            },
        };
    }, [isPresent, presenceChildren, onExitComplete]);
    /**
     * If the presence of a child affects the layout of the components around it,
     * we want to make a new context value to ensure they get re-rendered
     * so they can detect that layout change.
     */
    if (presenceAffectsLayout && isReusedContext) {
        context = { ...context };
    }
    useMemo(() => {
        presenceChildren.forEach((_, key) => presenceChildren.set(key, false));
    }, [isPresent]);
    /**
     * If there's no `motion` components to fire exit animations, we want to remove this
     * component immediately.
     */
    React.useEffect(() => {
        !isPresent &&
            !presenceChildren.size &&
            onExitComplete &&
            onExitComplete();
    }, [isPresent]);
    if (mode === "popLayout") {
        children = (jsx(PopChild, { isPresent: isPresent, anchorX: anchorX, root: root, children: children }));
    }
    return (jsx(PresenceContext.Provider, { value: context, children: children }));
};
function newChildrenMap() {
    return new Map();
}

export { PresenceChild };
