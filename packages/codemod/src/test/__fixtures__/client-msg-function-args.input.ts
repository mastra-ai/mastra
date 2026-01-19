// @ts-nocheck

import { MastraClient } from "@mastra/client-js";

export const mastraClient = new MastraClient({
  baseUrl: "http://localhost:4111/",
});

const agent = mastraClient.getAgent('weather-agent');

const test = agent.generate({
  messages: 'Weather in Seoul',
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test2 = agent.stream({
  messages: 'Weather in Seoul',
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test3 = agent.network({
  messages: 'Weather in Seoul',
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test4 = agent.generate({
  messages: [{ role: "user", content: "Weather in Seoul" }],
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test5 = agent.stream({
  messages: [{ role: "user", content: "Weather in Seoul" }],
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test6 = agent.network({
  messages: [{ role: "user", content: "Weather in Seoul" }],
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})
