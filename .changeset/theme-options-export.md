---
'@mastra/playground-ui': minor
---

Added `THEME_OPTIONS`, the System, Light, and Dark choices that `ThemeToggle` shows. Use it to offer the same theme choices inside a menu, where a segmented control does not fit.

```tsx
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { THEME_OPTIONS } from '@mastra/playground-ui/components/ThemeToggle';

function ThemeMenuItem() {
  const { theme, setTheme } = useTheme();
  return <DropdownMenu.RadioSub label="Theme" options={THEME_OPTIONS} value={theme} onValueChange={setTheme} />;
}
```
