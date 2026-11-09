---
'@mastra/deployer': patch
---

Fixed `mastra build` and `mastra dev` on Windows writing deep imports such as `lodash/fp/get` with backslashes, which made the server fail at startup with `ERR_INVALID_MODULE_SPECIFIER`. ([#29571](https://github.com/mastra-ai/mastra/issues/29571))
