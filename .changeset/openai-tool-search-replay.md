---
'@mastra/core': patch
---

Fixed replay of OpenAI-hosted `tool_search` across turns. The Responses API gives a hosted search's call and its output distinct item ids (`tsc_…` / `tso_…`); Mastra now keeps both on the stored tool part and splits them back apart when building a prompt, so each side replays as its own `item_reference` instead of the same one twice. Hosted searches are also kept provider-executed through a round trip, so their result is no longer re-serialized as a client-mode `tool_search_output`.

Conversations recorded before this fix kept only one of the two ids, so that hosted search pair can no longer be replayed faithfully — the single id would be referenced twice. A completed hosted search (succeeded or errored) with only one id is now omitted when building a prompt, and the model rediscovers the tool on the next turn; the rest of the conversation is unaffected and the part is still retained in response messages, so nothing is deleted from stored history. In-flight searches, which legitimately carry only a call id, and client-executed tools named `tool_search` are untouched.
