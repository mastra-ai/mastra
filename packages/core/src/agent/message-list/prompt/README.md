This `prompt` directory was copied from Vercel AI SDK and adapted to work to convert UIMessages to Mastra messages that closely resemble AI SDK CoreMessages (but are slightly different). This was needed as the regular converToCoreMessage() function from AI SDK didn't work to convert to the CoreMessage-like format we've stored in our storage adapter DBs.

./convert-to-mastra-v1.ts has been heavily modified to work with this codebase
