---
'mastracode': minor
---

Added a separate export path for the TUI at `mastracode/tui`, so consumers can cleanly import MastraTUI and related components without reaching into internals.

```ts
import { MastraTUI, type MastraTUIOptions } from 'mastracode/tui';
import { theme, setTheme, ModelSelectorComponent } from 'mastracode/tui';
```
