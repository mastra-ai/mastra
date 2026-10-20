---
'@mastra/docker': minor
---

Added build progress reporting to `DockerTemplate.build()`. Pass `onProgress` to receive step starts and completions (including cache hits), raw command output, and a `reused` event when an existing image is used. Failed results now include `failedStep`, the most recent `output` (capped by `maxOutputBytes`, default 64 KiB), and `outputTruncated`. `DockerSandbox` accepts `onTemplateBuildProgress` to follow template builds triggered by `start()`.

```typescript
const result = await template.build({
  onProgress: event => {
    if (event.type === 'step-start') console.log(event.step.name, event.step.cached ? '(cached)' : '');
  },
});
if (result.status === 'failed') console.error(result.failedStep?.name, result.output);
```
