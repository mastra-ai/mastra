---
'mastra': patch
---

Fixed Factory board settings losing a condition value that was typed but never saved. Save was disabled until the value field lost focus, and clicking the disabled Save doesn't move focus, so the change went nowhere. A reload then put the old condition back without warning. Save now works as soon as a value is typed, Escape puts back the value from before typing, and reloading or closing the tab with unsaved board changes asks first.
