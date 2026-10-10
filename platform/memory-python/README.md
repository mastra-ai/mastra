# mastra-platform-memory

Python client for Mastra Platform hosted Memory. No dependencies.

```python
from mastra_platform_memory import PlatformMemory

memory = PlatformMemory()  # MASTRA_PLATFORM_ACCESS_TOKEN, MASTRA_MEMORY_INSTANCE_ID
context = memory.get_context("chat-1", resource_id="user-ada")
messages = context.as_chat_messages() + [{"role": "user", "content": "Where do I live?"}]
# ...call your model with `messages`, then:
memory.save_messages("chat-1", resource_id="user-ada", messages=[
    {"role": "user", "content": "Where do I live?"},
    {"role": "assistant", "content": reply},
])
```

Observation and reflection run on the Platform; `get_context` returns observations as a system
block plus the messages not yet observed.
