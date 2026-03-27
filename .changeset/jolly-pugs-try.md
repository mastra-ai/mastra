---
'@mastra/core': patch
---

Improved tool architecture by separating concerns between Mastra-native tool format and AI SDK conversion. Tools are now normalized to Mastra format first (with `standardSchema` for input/output), then converted to AI SDK format only at the model boundary. This provides better type safety and clearer ownership boundaries. The `CoreToolBuilder` class has been renamed to `AISDKToolConverter` to better reflect its purpose.
