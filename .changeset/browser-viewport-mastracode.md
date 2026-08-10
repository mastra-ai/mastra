---
'mastracode': patch
---

Add `/browser set viewport` and `/browser clear viewport`. Pass a preset (`desktop`, `desktop-hd`, `laptop`, `tablet`, `mobile`), a custom `WIDTHxHEIGHT` size, or `window` to match the real browser window; omit the value to pick a preset from a list. `window` is rejected on providers that cannot honor it.
