---
'mastracode': patch
'@mastra/code-sdk': patch
---

Added viewport control to the `/browser` command. The setup wizard now prompts for a viewport with named presets (Desktop 1280x720, Desktop Large 1440x900, Laptop 1366x768, Tablet 768x1024, Mobile 390x844), a Custom `<width>x<height>` option, and a Match window option that follows the real browser window instead of emulating a fixed size.

You can also configure it non-interactively:

```text
/browser set viewport 1440x900   # fixed dimensions
/browser set viewport window     # match the real browser window
/browser clear viewport          # reset to the 1280x720 default
```

`/browser status` now shows the configured viewport. Existing saved settings keep working — a viewport that was never set still defaults to 1280x720.
