# React

Use these rules for React components and hooks, frontend data fetching, rendering, and bundles. Also read [general code](general.md), [TypeScript](typescript.md) for typed code, and [UI states](ui.md) when the change affects what users see.

## Component Structure

- [Give each domain component or hook one responsibility](rules/structure-single-responsibility.md).
- [Use components for JSX-returning helpers](rules/structure-component-naming.md).
- [Use early render branches without duplicating the layout](rules/structure-early-return-render-branches.md).
- [Compose fixed UI items explicitly instead of mapping configuration objects](rules/structure-composition-over-config.md).

## Client Data Fetching

- [Use TanStack Query for deduplication and typed dependent queries](rules/client-request-dedupe.md).

## Re-renders and State

- [Initialize expensive state lazily](rules/rerender-lazy-state-init.md).
- [Use transitions for non-urgent updates](rules/rerender-transitions.md).
- [Reserve Effect Events for effect-fired logic](rules/rerender-useeffect-function-calls.md).
- [Remount stateful branches instead of resetting state in an effect](rules/rerender-no-useeffect-state-reset.md).
- [Leave useMemo and useCallback decisions to developers with profiler evidence](rules/rerender-no-usememo-usecallback.md).
- [Derive values or change state ownership instead of setting state during render or effects](rules/rerender-no-setstate-in-render-or-effect.md).

## Rendering

- [Animate SVG wrappers](rules/rendering-animate-svg-wrapper.md).
- [Use content-visibility for long lists](rules/rendering-content-visibility.md).

## Bundles

- [Avoid barrel file imports](rules/bundle-barrel-imports.md).
- [Defer non-critical third-party libraries](rules/bundle-defer-third-party.md).

## Testing

- [Drive the real client and React Query stack, mocking only the network](rules/testing-bdd-no-mocks.md).
- [Assert behavior instead of class names](rules/testing-no-classname-assertions.md).
