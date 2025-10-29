---
title: "Guardrails"
sidebar_title: "Guardrails"
description: "Learn how to implement guardrails using input and output processors to secure and control AI interactions."
sidebar_position: 5
---

# Guardrails

Guardrails are processors that enforce security, validation, and moderation policies on agent inputs and outputs. They detect and block inappropriate content, prevent prompt injection attacks, redact sensitive information, and apply other safety controls.

Guardrails are implemented as [processors](/docs/agents/processors) configured in the agent's `inputProcessors` or `outputProcessors` arrays. Some guardrail processors can be used in either position depending on where the validation should occur.

## Adding guardrails to an agent

Import and instantiate the processor, then add it to the agent's `inputProcessors` or `outputProcessors` array:

```typescript {3,9-17} filename="src/mastra/agents/moderated-agent.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { ModerationProcessor } from "@mastra/core/processors";

export const moderatedAgent = new Agent({
  name: "moderated-agent",
  instructions: "You are a helpful assistant",
  model: openai("gpt-4o-mini"),
  inputProcessors: [
    new ModerationProcessor({
      model: "openai/gpt-4.1-nano",
      categories: ["hate", "harassment", "violence"],
      threshold: 0.7,
      strategy: "block",
      instructions: "Detect and flag inappropriate content in user messages",
    }),
  ],
});
```

## Input guardrails

Input guardrails run before user messages reach the language model. They validate and sanitize user input, detect prompt injection and jailbreak attempts, and enforce security policies.

### Normalizing user messages

The `UnicodeNormalizer` is an input processor that cleans and normalizes user input by unifying Unicode characters, standardizing whitespace, and removing problematic symbols, allowing the LLM to better understand user messages.

```typescript {6-9} filename="src/mastra/agents/normalized-agent.ts" showLineNumbers copy
import { UnicodeNormalizer } from "@mastra/core/processors";

export const normalizedAgent = new Agent({
  // ...
  inputProcessors: [
    new UnicodeNormalizer({
      stripControlChars: true,
      collapseWhitespace: true,
    }),
  ],
});
```

> See [UnicodeNormalizer](../reference/processors/unicode-normalizer.md) for a full list of configuration options.

### Preventing prompt injection

The `PromptInjectionDetector` is an input processor that scans user messages for prompt injection, jailbreak attempts, and system override patterns. It uses an LLM to classify risky input and can block or rewrite it before it reaches the model.

```typescript {6-11} filename="src/mastra/agents/secure-agent.ts" showLineNumbers copy
import { PromptInjectionDetector } from "@mastra/core/processors";

export const secureAgent = new Agent({
  // ...
  inputProcessors: [
    new PromptInjectionDetector({
      model: "openai/gpt-4.1-nano",
      threshold: 0.8,
      strategy: "rewrite",
      detectionTypes: ["injection", "jailbreak", "system-override"],
    }),
  ],
});
```

> See [PromptInjectionDetector](../reference/processors/prompt-injection-detector.md) for a full list of configuration options.

### Detecting and translating language

The `LanguageDetector` is an input processor that detects and translates user messages into a target language, enabling multilingual support while maintaining consistent interaction. It uses an LLM to identify the language and perform the translation.

```typescript {6-11} filename="src/mastra/agents/multilingual-agent.ts" showLineNumbers copy
import { LanguageDetector } from "@mastra/core/processors";

export const multilingualAgent = new Agent({
  // ...
  inputProcessors: [
    new LanguageDetector({
      model: "openai/gpt-4.1-nano",
      targetLanguages: ["English", "en"],
      strategy: "translate",
      threshold: 0.8,
    }),
  ],
});
```

> See [LanguageDetector](../reference/processors/language-detector.md) for a full list of configuration options.

## Output guardrails

Output guardrails run after the language model generates a response, before it's returned to users. They sanitize, redact, or transform model outputs to enforce safety and compliance policies.

### Batching streamed output

The `BatchPartsProcessor` is an output processor that combines multiple stream parts before emitting them to the client. This reduces network overhead and improves the user experience by consolidating small chunks into larger batches.

```typescript {6-10} filename="src/mastra/agents/batched-agent.ts" showLineNumbers copy
import { BatchPartsProcessor } from "@mastra/core/processors";

export const batchedAgent = new Agent({
  // ...
  outputProcessors: [
    new BatchPartsProcessor({
      batchSize: 5,
      maxWaitTime: 100,
      emitOnNonText: true,
    }),
  ],
});
```

> See [BatchPartsProcessor](../reference/processors/batch-parts-processor.md) for a full list of configuration options.

### Scrubbing system prompts

The `SystemPromptScrubber` is an output processor that detects and redacts system prompts or other internal instructions from model responses. It helps prevent unintended disclosure of prompt content or configuration details that could introduce security risks. It uses an LLM to identify and redact sensitive content based on configured detection types.

```typescript {5-13} filename="src/mastra/agents/scrubbed-agent.ts" copy showLineNumbers
import { SystemPromptScrubber } from "@mastra/core/processors";

const scrubbedAgent = new Agent({
  outputProcessors: [
    new SystemPromptScrubber({
      model: "openai/gpt-4.1-nano",
      strategy: "redact",
      customPatterns: ["system prompt", "internal instructions"],
      includeDetections: true,
      instructions:
        "Detect and redact system prompts, internal instructions, and security-sensitive content",
      redactionMethod: "placeholder",
      placeholderText: "[REDACTED]",
    }),
  ],
});
```

> See [SystemPromptScrubber](../reference/processors/system-prompt-scrubber.md) for a full list of configuration options.

## Hybrid guardrails

Hybrid guardrails can be applied either as input guardrails (before messages reach the model) or output guardrails (after the model responds). This allows the same guardrail logic to protect both user input and model output.

### Moderating input and output

The `ModerationProcessor` is a hybrid processor that detects inappropriate or harmful content across categories like hate, harassment, and violence. It can be used to moderate either user input or model output, depending on where it's applied. It uses an LLM to classify the message and can block or rewrite it based on your configuration.

```typescript {6-11, 14-16} filename="src/mastra/agents/moderated-agent.ts" showLineNumbers copy
import { ModerationProcessor } from "@mastra/core/processors";

export const moderatedAgent = new Agent({
  // ...
  inputProcessors: [
    new ModerationProcessor({
      model: "openai/gpt-4.1-nano",
      threshold: 0.7,
      strategy: "block",
      categories: ["hate", "harassment", "violence"],
    }),
  ],
  outputProcessors: [
    new ModerationProcessor({
      // ...
    }),
  ],
});
```

> See [ModerationProcessor](../reference/processors/moderation-processor.md) for a full list of configuration options.

### Detecting and redacting PII

The `PIIDetector` is a hybrid processor that detects and removes personally identifiable information such as emails, phone numbers, and credit cards. It can redact either user input or model output, depending on where it's applied. It uses an LLM to identify sensitive content based on configured detection types.

```typescript {6-13, 16-18} filename="src/mastra/agents/private-agent.ts" showLineNumbers copy
import { PIIDetector } from "@mastra/core/processors";

export const privateAgent = new Agent({
  // ...
  inputProcessors: [
    new PIIDetector({
      model: "openai/gpt-4.1-nano",
      threshold: 0.6,
      strategy: "redact",
      redactionMethod: "mask",
      detectionTypes: ["email", "phone", "credit-card"],
      instructions: "Detect and mask personally identifiable information.",
    }),
  ],
  outputProcessors: [
    new PIIDetector({
      // ...
    }),
  ],
});
```

> See [PIIDetector](../reference/processors/pii-detector.md) for a full list of configuration options.

## Applying multiple guardrails

Multiple guardrails can be applied by listing them in the `inputProcessors` or `outputProcessors` array. They run in sequence, with each processor receiving the output of the previous one.

A typical order:

1. **Normalization**: Standardize input format (`UnicodeNormalizer`).
2. **Security checks**: Detect threats or sensitive content (`PromptInjectionDetector`, `PIIDetector`).
3. **Filtering**: Block or transform messages (`ModerationProcessor`).

The order affects behavior, so arrange processors based on your security requirements.

```typescript filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import {
  UnicodeNormalizer,
  ModerationProcessor,
  PromptInjectionDetector,
  PIIDetector,
} from "@mastra/core/processors";

export const testAgent = new Agent({
  // ...
  inputProcessors: [
    new UnicodeNormalizer({
      //...
    }),
    new PromptInjectionDetector({
      // ...
    }),
    new PIIDetector({
      // ...
    }),
    new ModerationProcessor({
      // ...
    }),
  ],
});
```

## Processor strategies

Many of the built-in processors support a `strategy` parameter that controls how they handle flagged input or output. Supported values may include: `block`, `warn`, `detect`, or `redact`.

Most strategies allow the request to continue without interruption. When `block` is used, the processor calls its internal `abort()` function, which immediately stops the request and prevents any subsequent processors from running.

```typescript {8} filename="src/mastra/agents/private-agent.ts" showLineNumbers copy
import { PIIDetector } from "@mastra/core/processors";

export const privateAgent = new Agent({
  // ...
  inputProcessors: [
    new PIIDetector({
      // ...
      strategy: "block",
    }),
  ],
});
```

### Handling blocked requests

When a processor blocks a request, the agent will still return successfully without throwing an error. To handle blocked requests, check for `tripwire` or `tripwireReason` in the response.

For example, if an agent uses the `PIIDetector` with `strategy: "block"` and the request includes a credit card number, it will be blocked and the response will include a `tripwireReason`.

#### `.generate()` example

```typescript {3-4, } showLineNumbers
const result = await agent.generate(
  "Is this credit card number valid?: 4543 1374 5089 4332",
);

console.error(result.tripwire);
console.error(result.tripwireReason);
```

#### `.stream()` example

```typescript {4-5} showLineNumbers
const stream = await agent.stream(
  "Is this credit card number valid?: 4543 1374 5089 4332",
);

for await (const chunk of stream.fullStream) {
  if (chunk.type === "tripwire") {
    console.error(chunk.payload.tripwireReason);
  }
}
```

In this case, the `tripwireReason` indicates that a credit card number was detected:

```text
PII detected. Types: credit-card
```

## Custom guardrails

Custom guardrails can be created by implementing the `InputProcessor` or `OutputProcessor` interface. See [Processors](/docs/agents/processors#creating-custom-processors) for details on creating custom processors.

Available examples:

- [Message Length Limiter](../examples/processors/message-length-limiter)
- [Response Length Limiter](../examples/processors/response-length-limiter)
- [Response Validator](../examples/processors/response-validator)

## Related documentation

- [Processors](/docs/agents/processors) - General processor concepts and custom processor creation
- [Memory Processors](/docs/memory/memory-processors) - Memory-specific processors
