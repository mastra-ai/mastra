---
'mastracode': patch
---

Allow typing a custom model string in `/om` (Observational Memory settings). The observer and reflector model pickers now use the same picker as `/models` — type a model id like `deepseek/deepseek-v4-flash` to use it directly if it's not in the list.

Observer and reflector model overrides are now persisted independently — changing one in `/om` no longer overwrites the other. Legacy `omModelOverride` is preserved as a shared fallback for settings files written before this change.
