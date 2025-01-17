# Mastra Reference Documentation

This is a guide for LLMs for creating explanatory text for examples. When you are writing a new example, you can use this guide to create the text.

---

## Prompt

Write 2-3 sentences describing the purpose of the code, or providing an overview of a topic. Be friendly (not too friendly!), but concise. You are providing documentation to software engineers.

The first sentence or two should describe the problem that is being solved by the concept that is being described. Avoid third-party words like "developers" in favor of second person words like "you."

## Examples

**Topic: Describing an image**

**Purpose Sentence:** "Vision-enabled language models can process both text and images, but sending both requires specific message formatting."

**Topic: Calling Google Gemini**

**Purpose Sentence:** "Mastra provides a unified interface for working with various LLM providers, handling the complexity of different API implementations."

**Topic: Streaming Objects**

**Purpose Setence:** "By streaming the output, you can display partial results as they arrive, providing immediate feedback to users."

The last sentence should describe the purpose of the code.

The text should be to the point, without flourishes ("shows" rather than "demonstrates").

Avoid referencing a specific model unless it is part of the title of the page.

**Topic: Streaming Object**

**Description sentence:** This example shows how to stream JSON-formatted responses using a Zod schema.
