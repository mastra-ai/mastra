---
'@mastra/server': patch
'@mastra/client-js': patch
---

Fixed Agent Controller HTTP routes returning 404 ("agent controller not found") when a controller's `id` differs from the key it's registered under. Routes now resolve controllers by `id` and fall back to the registration key, so both of these reach the same controller:

```ts
const controller = new AgentController({ id: 'support-controller', modes });
const mastra = new Mastra({ agentControllers: { controller } });

client.getAgentController('support-controller'); // now works
client.getAgentController('controller'); // still works
```

`GET /agent-controller` (`client.listAgentControllers()`) now returns each controller's real `id` plus its registration `key`. Previously the `id` field contained the registration key.
