https://discord.com/channels/1309558646228779139/1356553049539346432/1356589641259679845
Ninapepite
OP
— 4:22 AM
Hi @Ward !

I don't see a endpoint /api/chat on swagger, only /stream or /generate.

I use Nuxt, no NextJS.

https://github.com/Killian-Aidalinfo/grandoral-agent-maalsi/blob/develop/front-go-cesi/components/internal/components/ChatComponent.vue

https://github.com/Killian-Aidalinfo/grandoral-agent-maalsi/blob/develop/mastra/src/mastra/agents/index.ts

GitHub
grandoral-agent-maalsi/front-go-cesi/components/internal/components...
Contribute to Killian-Aidalinfo/grandoral-agent-maalsi development by creating an account on GitHub.
grandoral-agent-maalsi/front-go-cesi/components/internal/components...

GitHub
grandoral-agent-maalsi/mastra/src/mastra/agents/index.ts at develop...
Contribute to Killian-Aidalinfo/grandoral-agent-maalsi development by creating an account on GitHub.
grandoral-agent-maalsi/mastra/src/mastra/agents/index.ts at develop...
And I can't use :
// Memory is automatically used in agent interactions when resourceId and threadId are added
const response = await myAgent.generate(
"What were we discussing earlier about performance?",
{
resourceId: "user_123",
threadId: "thread_456",
},
);

Because mastra is only use with API mode. Frontend request /api endpoint to mastra
Ward — 6:37 AM
useChat is something i need to figure out if the docs are wrong but I'm not understanding why you can't use resourceId or threadId?
you can pass it as part of the body, like you do with messages
Tyler — 8:28 AM
There is no /api/chat - that's typically created in your code. You can add resourceId and threadId in the post body to stream or generate endpoints
