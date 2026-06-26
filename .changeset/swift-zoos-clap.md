---
'@mastra/core': minor
---

Surface step `providerMetadata` to output-step processors

Output-step processors now receive the finishing step's provider-specific metadata through the new optional `providerMetadata` field on `ProcessOutputStepArgs`. This lets observability and guardrail processors attribute a model response to the provider data behind it — most notably an AWS Bedrock guardrail trace on a `content-filter` block, where the completed-steps array is empty and the assessment was previously unreachable.

The field is present whenever the underlying model step produced provider metadata, in both streaming and non-streaming generation. Behaviour is unchanged for steps without provider metadata.

```ts
class MyProcessor implements Processor {
  async processOutputStep({ finishReason, providerMetadata }: ProcessOutputStepArgs) {
    if (finishReason === 'content-filter') {
      const guardrail = providerMetadata?.bedrock?.trace?.guardrail;
      // attribute the block to the responsible policy/topic/filter
    }
  }
}
```
