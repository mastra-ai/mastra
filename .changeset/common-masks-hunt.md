---
'@mastra/playground-ui': minor
---

Added thinking-level controls for picking a model's reasoning level. `ThinkingLevelPicker` is a signal-bars button that sits next to a model picker in a `ButtonsGroup` and opens a ramp of the model's levels in a popover. When the model has no levels, it shows as disabled with a tooltip that explains why. `ThinkingLevelRamp` and the compact `ThinkingLevelSlider` save when you let go, and hold the dropped level until the save finishes.

```tsx
import { ThinkingLevelPicker } from '@mastra/playground-ui/components/ThinkingLevel';

<ThinkingLevelPicker
  label="Thinking"
  options={[
    { value: 'off', label: 'Off', emphasis: 'muted' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High', emphasis: 'warning' },
  ]}
  value={level}
  onChange={setLevel}
/>;
```
