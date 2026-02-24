---
'@mastra/core': patch
---

Fixed a crash where the Node.js process would terminate with an unhandled TypeError when an LLM stream encountered an error. The ReadableStreamDefaultController would throw "Controller is already closed" when chunks were enqueued after a downstream consumer cancelled or terminated the stream. All controller.enqueue(), controller.close(), and controller.error() calls now check if the controller is still open before attempting operations. (https://github.com/mastra-ai/mastra/issues/13107)
