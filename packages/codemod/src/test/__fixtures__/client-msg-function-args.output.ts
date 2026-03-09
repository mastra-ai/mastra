// @ts-nocheck

import { MastraClient } from "@mastra/client-js";

export const mastraClient = new MastraClient({
  baseUrl: "http://localhost:4111/",
});

const agent = mastraClient.getAgent('weather-agent');

// POSITIVE TEST CASES - Single string message
const test1 = agent.generate('Weather in Seoul', {
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

// POSITIVE TEST CASES - MessageInput[] (array of message objects)
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

// POSITIVE TEST CASES - string[] (array of strings)
const test7 = agent.generate(['Hello', 'What is the weather?'], {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test8 = agent.stream(['Hello', 'What is the weather?'], {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test9 = agent.network(['Hello', 'What is the weather?'], {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

// POSITIVE TEST CASES - Single MessageInput object
const test10 = agent.generate({ role: "user", content: "Weather in Seoul" }, {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test11 = agent.stream({ role: "user", content: "Weather in Seoul" }, {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

const test12 = agent.network({ role: "user", content: "Weather in Seoul" }, {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

// POSITIVE TEST CASE - messages only (no other options)
const test13 = agent.generate('Just a message')

const test14 = agent.stream('Just a message')

const test15 = agent.network('Just a message')

// POSITIVE TEST CASE - messages with variable
const myMessages = [{ role: "user", content: "Hello" }];
const test16 = agent.generate(myMessages, {
  memory: {
    resource: 'resource-id',
    thread: 'thread-id',
  }
})

// NEGATIVE TEST CASE - Should NOT transform: different object with similar methods
const otherObj = {
  generate: (opts) => opts,
  stream: (opts) => opts,
  network: (opts) => opts,
};
const negativeTest1 = otherObj.generate({
  messages: 'Should not transform',
  memory: { resource: 'r', thread: 't' }
});
const negativeTest2 = otherObj.stream({
  messages: 'Should not transform',
  memory: { resource: 'r', thread: 't' }
});
const negativeTest3 = otherObj.network({
  messages: 'Should not transform',
  memory: { resource: 'r', thread: 't' }
});

// NEGATIVE TEST CASE - Should NOT transform: class with similar methods
class MyAgent {
  generate(opts) { return opts; }
  stream(opts) { return opts; }
  network(opts) { return opts; }
}
const myAgent = new MyAgent();
const negativeTest4 = myAgent.generate({
  messages: 'Should not transform',
  memory: { resource: 'r', thread: 't' }
});
const negativeTest5 = myAgent.stream({
  messages: 'Should not transform',
  memory: { resource: 'r', thread: 't' }
});
const negativeTest6 = myAgent.network({
  messages: 'Should not transform',
  memory: { resource: 'r', thread: 't' }
});
