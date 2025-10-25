import { mastra } from "@/src/mastra";
import Chat from "./chat";

const myAgent = mastra.getAgent("weatherAgent");
const memory = await myAgent.getMemory();

export default async function Page() {
  const result = await memory?.query({
    threadId: "2",
  });

  const messages = result?.uiMessages || [];

  return <Chat initialMessages={messages} />;
}
