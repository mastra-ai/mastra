// @ts-nocheck
// Test: basic readOnly migration
agent.stream('Hello', {
  memory: {
    thread: threadId,
    resource: resourceId,
    readOnly: true,
  },
});

// Test: readOnly with existing options
agent.generate('Hello', {
  memory: {
    thread: threadId,
    resource: resourceId,
    readOnly: true,
    options: {
      lastMessages: 10,
    },
  },
});

// Test: readOnly false
agent.stream('Hello', {
  memory: {
    thread: 'thread-1',
    resource: 'user-1',
    readOnly: false,
  },
});

// Test: no readOnly (should not change)
agent.stream('Hello', {
  memory: {
    thread: threadId,
    resource: resourceId,
  },
});
