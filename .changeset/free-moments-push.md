---
'@mastra/livekit': major
---

Raised the minimum supported LiveKit Agents and optional LiveKit/Silero plugin versions to 1.9.3 within 1.x. Update Agents and installed plugins together; LiveKit now requires RTC 1.1.0 or newer within 1.x. The older Agents 1.7.1 / RTC 0.13.x combination is no longer supported.

**Before:**

```sh
npm install @livekit/agents@1.7.1 @livekit/agents-plugin-livekit@1.7.1 @livekit/agents-plugin-silero@1.7.1 @livekit/rtc-node@0.13.34
```

**After:**

```sh
npm install @livekit/agents@1.9.3 @livekit/agents-plugin-livekit@1.9.3 @livekit/agents-plugin-silero@1.9.3 @livekit/rtc-node@1.1.0
```

The plugins remain optional; include the ones your worker uses. This establishes the tested stable LiveKit stack as the release baseline without changing the Mastra integration API or Zod 3/4 support. Updated Server SDK to 2.19.1 and protocol to 1.52.1; the installation guide describes upstream token, telemetry, and transport changes.
