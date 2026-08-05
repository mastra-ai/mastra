# @internal/core

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
