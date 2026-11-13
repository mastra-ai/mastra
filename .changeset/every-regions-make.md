---
'@mastra/core': patch
---

Fixed tool validation errors being passed to `toModelOutput`. When a tool that defines `toModelOutput` fails input, request context or output validation, the agent now skips `toModelOutput` and sends the model the validation error, marked as an error result, so the model can see what went wrong and retry. Before, a mapper written for successful output turned the error into an empty result such as `{}`. This matches the `toModelOutput` type, which only receives the tool's output. Fixes #30211.

Because `toModelOutput` is where a tool keeps fields out of the prompt, the error sent in its place leaves out the raw values the full error quotes: for input errors the model gets each issue but not the `Provided arguments` excerpt or the rejected value an issue message quotes (such as `received 'x'`), and for output, request context and suspend data errors it gets only the names of the fields that failed. Only validation errors that Mastra itself produced skip `toModelOutput`; a tool result or client tool result that merely has `error: true` and `validationErrors` fields is mapped as before. The tool result your code receives still holds the full error, and tools without `toModelOutput` are unchanged.
