---
'@mastra/playground-ui': patch
---

Migrated the Slider component to base-ui with a refined neutral visual design.

**What changed**

- Replaced `@radix-ui/react-slider` with `@base-ui/react/slider` as the underlying primitive
- Refreshed visuals: thin rounded thumb with white border and neutral inside, opacity-based track that adapts to any surface, neutral filled indicator (no green/accent color)
- Larger click target via padded `Slider.Control` and an invisible hit area on the thumb so it is easier to grab
- Added `cursor-pointer` on the control and `cursor-not-allowed` when disabled
- Removed the now unused `@radix-ui/react-slider` and `@radix-ui/react-tabs` dependencies

**API compatibility**

The public API is preserved. `onValueChange` and `onValueCommitted` are wrapped so consumers always receive `number[]`, even though base-ui returns `number | number[]` internally. Existing call sites like `<Slider value={[temperature]} onValueChange={value => setTemperature(value[0])} />` continue to work without changes.
