"use server";

import { mastra } from "@/src/mastra";
import { createStreamableValue } from "@ai-sdk/rsc";

const myAgent = mastra.getAgent("weatherAgent");
const memory = await myAgent.getMemory();

export async function chat(message: string) {
  const responseStream = createStreamableValue("");

  // Asynchronously read from the stream and update the streamable value
  (async () => {
    const agentStream = await myAgent.streamVNext(message, {
      memory: {
        thread: "2",
        resource: "1",
      },
    });

    for await (const chunk of agentStream.textStream) {
      responseStream.append(chunk);
    }

    responseStream.done();
  })();

  const history = await memory?.query({
    threadId: "2",
  });

  return { history: history?.uiMessages || [], text: responseStream.value };
}
