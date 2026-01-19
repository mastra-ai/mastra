// @ts-nocheck

import { MastraClient } from "@mastra/client-js";

export const mastraClient = new MastraClient({
  baseUrl: "http://localhost:4111/",
});

const agent = mastraClient.getAgent('weather-agent');

const test = agent.generate('Weather in Seoul', {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test2 = agent.stream('Weather in Seoul', {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test3 = agent.network('Weather in Seoul', {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test4 = agent.generate([{ role: "user", content: "Weather in Seoul" }], {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test5 = agent.stream([{ role: "user", content: "Weather in Seoul" }], {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test6 = agent.network([{ role: "user", content: "Weather in Seoul" }], {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

