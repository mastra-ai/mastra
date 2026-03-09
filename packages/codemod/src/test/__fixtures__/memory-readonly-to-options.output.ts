// @ts-nocheck
// Test: basic readOnly migration
agent.stream('Hello', {
  memory: {
    thread: threadId,
    resource: resourceId,

    options: {
      readOnly: true
    }
  },
});

// Test: readOnly with existing options
agent.generate('Hello', {
  memory: {
    thread: threadId,
    resource: resourceId,

    options: {
      lastMessages: 10,
      readOnly: true
    }
  },
});

// Test: readOnly false
agent.stream('Hello', {
  memory: {
    thread: 'thread-1',
    resource: 'user-1',

    options: {
      readOnly: false
    }
  },
});

// Test: no readOnly (should not change)
agent.stream('Hello', {
  memory: {
    thread: threadId,
    resource: resourceId,
  },
});
