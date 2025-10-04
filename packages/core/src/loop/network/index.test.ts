import { describe, it, expect } from 'vitest';
import { getLastMessage } from '.';

describe('getLastMessage', () => {
  it('should return an empty string when input is an empty array', () => {
    // Arrange: Create an empty array of messages
    const messages = [];

    // Act: Get the last message from empty array
    const result = getLastMessage(messages);

    // Assert: Should return empty string
    expect(result).toBe('');
  });

  it('should return an empty string when message content is missing or empty (no property, null, undefined, or empty string)', () => {
    // Arrange: Create test cases for various invalid content scenarios
    const testCases = [
      {}, // no content property
      { content: null }, // null content
      { content: undefined }, // undefined content
      { content: '' }, // empty string content
    ];

    // Act & Assert: Test each case
    testCases.forEach(message => {
      expect(getLastMessage([message])).toBe('');
    });
  });

  it('should return empty string when message has empty content array', () => {
    // Arrange: Create a message object with content as an empty array
    const message = {
      content: [],
    };

    // Act: Get the last message from the object
    const result = getLastMessage(message);

    // Assert: Verify that an empty string is returned since there are no content parts to extract text from
    expect(result).toBe('');
  });

  it('should return the input string directly when messages parameter is a string', () => {
    // Arrange: Create a simple string message
    const directMessage = 'This is a direct string message';

    // Act: Pass string directly to getLastMessage
    const result = getLastMessage(directMessage);

    // Assert: Verify the same string is returned unchanged
    expect(result).toBe('This is a direct string message');
  });

  it('should return the message from the last element when input is an array', () => {
    // Arrange: Create an array of messages with string and object messages
    const messages = ['first message', { content: 'second message' }, 'last message'];

    // Act: Get the last message from the array
    const result = getLastMessage(messages);

    // Assert: Should return the string from the last element
    expect(result).toBe('last message');
  });

  it('should extract text from the last text part when content is an array', () => {
    // Arrange: Create a message object with content as an array of different parts
    const message = {
      content: [
        { type: 'image', url: 'https://example.com/image.jpg' },
        { type: 'text', text: 'first text part' },
        { type: 'text', text: 'last text part' },
      ],
    };

    // Act: Get the last message from the object
    const result = getLastMessage(message);

    // Assert: Should return the text from the last text part
    expect(result).toBe('last text part');
  });

  it('should return empty string when content array has no text elements', () => {
    // Arrange: Create a message object with content array containing only non-text elements
    const messageWithNoText = {
      content: [
        { type: 'image', url: 'https://example.com/image1.jpg' },
        { type: 'video', url: 'https://example.com/video.mp4' },
        { type: 'image', url: 'https://example.com/image2.jpg' },
      ],
    };

    // Act: Pass the message object to getLastMessage
    const result = getLastMessage(messageWithNoText);

    // Assert: Verify an empty string is returned since no text elements exist
    expect(result).toBe('');
  });

  it('should return empty string when content array has text elements but last element is not text', () => {
    // Arrange: Create a message object with content array containing text elements but ending with non-text
    const message = {
      content: [
        { type: 'text', text: 'first text message' },
        { type: 'text', text: 'second text message' },
        { type: 'image', url: 'https://example.com/image.jpg' },
      ],
    };

    // Act: Get the last message from the object
    const result = getLastMessage(message);

    // Assert: Should return empty string since last element is not text
    expect(result).toBe('');
  });

  it('returns the content of the last element when it is an object', () => {
    // Arrange: Create an array with last element being an object containing content
    const messages = ['first message', { content: 'middle message' }, { content: 'last object message' }];

    // Act: Get the last message from the array
    const result = getLastMessage(messages);

    // Assert: Should return the content string from the last object
    expect(result).toBe('last object message');
  });

  it('returns content when input is a single message object', () => {
    // Arrange: Create a single object with content property
    const message = {
      content: 'direct object message',
    };

    // Act: Get message from single object
    const result = getLastMessage(message);

    // Assert: Should return the content string from the object
    expect(result).toBe('direct object message');
  });
});
