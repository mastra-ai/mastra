---
'@mastra/deployer': patch
---

Fix `injectStudioHtmlConfig` corrupting Studio config values that contain `$`. Values such as request context presets are now injected into the HTML verbatim instead of being mangled by `String.prototype.replace` special patterns (`$$`, `$&`, etc.). Closes #18685.
