https://github.com/mastra-ai/mastra/issues/2838
juspky
opened last month · edited by juspky
Versions I am using { "@mastra/core": "^0.5.0-alpha.8",
"@mastra/memory": "^0.2.0-alpha.8",
"@mastra/pg": "^0.1.8-alpha.8",
"mastra": "^0.2.9-alpha.8",
}

From reading the docs its not exactly clear to me how the memory template works.

If I use the weatherAgent example and put a template in there like this:

export const weatherAgent = new Agent({
name: "Weather Agent",
instructions: `
You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Use Celsius and other metric units
      - Keep responses concise but informative

      Use the weatherTool to fetch current weather data.

`,
  memory: pgMemory({
    lastMessages: false,
    semanticRecall: false,
    workingMemory: {
      enabled: true,
      template: `<user>
<location></location>
</user>`,
},
}),
model: ollamaModel,
tools: { weatherTool },
});
It seems to put things I did not specify in the template into working memory too?

Image

Is the memory template just a suggestion and the AI decides to put extra information in there on its own? If so, it would be great to learn that in the documentation.

Anyways. Since it does not follow the template it seems to mess up the next memory read. If I ask it in the next question "What is the weather in my location?" (Message disappears, I added it back in the screenshot for clarification)

Image

I also realized that since it decides itself what to put into working memory it puts the tools response into working memory too (which seems to not mess up the location memory read since it decided to put it into a different tag). Essentially caching the response and causing data to be used from memory instead of the API.

Image

I think it is great if the model itself decides what is important and should be put into working memory but I would like to have an option to disable that behavior and force it to use just the template if it fits my use case.
Activity
github-actions
added
bug
Something isn't working

Documentation
Improvements or additions to documentation

Memory
Issue with Mastra's memory store

question
Further information is requested
last month
TylerBarnes
TylerBarnes commented last month
TylerBarnes
last month · edited by TylerBarnes
Member
Hey @juspky , thanks for the feedback!
I'll look at how I can make things clearer in the docs.
The template is indeed a suggestion and we can't currently force the llm to use it. As a new feature we could support taking a zod schema (when using working memory via tool calls) to enforce the structure, but right now it doesn't work that way. Working memory is a stored string that the agent can update. This part of it was modeled after a piece of the MemGPT whitepaper.
Adding system instructions on how to update working memory is often helpful in ensuring the agent does the right thing.

That's interesting that it tried to use it to cache the tool result and also tried to pass working memory tags into the next tool call. Which model are you using? Some models don't do very well with tool calling
TylerBarnes
self-assigned thislast month
juspky
juspky commented last month
juspky
last month
Contributor
Author
Alright I understand. I just looked into the working memory code and realized that its a prompt and a tool. I thought it was more code heavy.

Maybe we could add a toggle in saveWorkingMemory that compares the template XML with the parsedXML and delete everything that is not part of the templateXMLs structure before storing the memory. I could maybe write a PR for that if that approach sounds good to you.

What about the error in the second screenshot? I don't understand how that came to be

I'm using ollama.com/library/llama3.1 8b
TylerBarnes
TylerBarnes commented last month
TylerBarnes
last month · edited by TylerBarnes
Member
Yeah I can see how the current docs are lacking here - perhaps I'll make a diagram that shows how it's stored/updated when the llm responds and then how it's injected back into the system prompt before the next completion.

I like where you're going with the xml idea but I don't think we should parse xml - mainly we used that format to make it easier to parse in a stream output (vs partial json) but we don't want a second way to validate agent schemas.

For enforcing schemas the way to go is with tool calls (when using the new use: "tool-call" option for working memory) and exposing a way to set the input schema for the working memory tool call mastra.ai/docs/agents/02-adding-tools#parameter-schemas. But this doesn't exist yet, we would need to create an API like this:

Ex:

new Memory({
options: {
workingMemory: {
enabled: true,
use: "tool-call",
inputSchema: z.object({...}) // or maybe still template: z.object({...})?
}
}
})
TylerBarnes
TylerBarnes commented last month
TylerBarnes
last month · edited by TylerBarnes
Member
Oh forgot to mention, with the current setup you can also try encouraging it to store a certain format in your agent instructions.

[...]
Anytime you receive X information, store it in your working memory. Make sure you format it this way: ...
This is very important and the user is expecting you to do this.
I had good success with this when I was testing working memory with llama3.1 in the past
juspky
juspky commented 3 weeks ago
juspky
3 weeks ago
Contributor
Author
Thanks for clarification, the updated working memory as a tool call looks neat for the future.
TylerBarnes
TylerBarnes commented 3 weeks ago
TylerBarnes
3 weeks ago
Member
It's out in alpha right now, but not with the input schema feature, only new Memory({ options: { workingMemory: { use: "tool-call" }} }). Worth trying it out to see if your agent does a better job handling it that way! I was playing with LMStudio, mastra, and tool calling and found that Qwen2.5 7b/14b do a really great job with tool calling. huggingface.co/mlx-community/Qwen2.5-14B-Instruct-4bit
