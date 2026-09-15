# @internal/core

## 0.1.2

### Patch Changes

- Improved observability traces: RequestContext objects and arrays now preserve their nested structure instead of appearing as `[object]`. ([#20520](https://github.com/mastra-ai/mastra/pull/20520))

- Fixed `RequestContext.toJSON()` so nested contexts reached through shared-reference graphs no longer block the event loop. The serialization safety budget is now shared across nested probes within one serialization, so such values are handled in bounded time — and filtered when they exceed the budget — instead of blocking for seconds. ([#20730](https://github.com/mastra-ai/mastra/pull/20730))

## 0.1.2-alpha.1

### Patch Changes

- Fixed `RequestContext.toJSON()` so nested contexts reached through shared-reference graphs no longer block the event loop. The serialization safety budget is now shared across nested probes within one serialization, so such values are handled in bounded time — and filtered when they exceed the budget — instead of blocking for seconds. ([#20730](https://github.com/mastra-ai/mastra/pull/20730))

## 0.1.2-alpha.0

### Patch Changes

- Improved observability traces: RequestContext objects and arrays now preserve their nested structure instead of appearing as `[object]`. ([#20520](https://github.com/mastra-ai/mastra/pull/20520))

## 0.1.1

### Patch Changes

- Fixed `RequestContext.toJSON()` so deeply shared object graphs no longer block the event loop during serialization. Values that exceed the serialization safety limit are filtered instead. ([#20375](https://github.com/mastra-ai/mastra/pull/20375))

## 0.1.1-alpha.0

### Patch Changes

- Fixed `RequestContext.toJSON()` so deeply shared object graphs no longer block the event loop during serialization. Values that exceed the serialization safety limit are filtered instead. ([#20375](https://github.com/mastra-ai/mastra/pull/20375))

## 0.1.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

## 0.1.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))
