import { RuntimeContext } from '@mastra/core/runtime-context';
import { describe, it, expect } from 'vitest';
import { completionsHandler } from './completions';

describe('completionsHandler - Integration Tests', () => {
    // Skip tests if no OpenAI API key
    const skipIfNoApiKey = !process.env.OPENAI_API_KEY ? it.skip : it;

    skipIfNoApiKey('should convert Mastra response to OpenAI-compatible format', async () => {
        let body = {
            model: 'openai/gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful assistant. Be concise.' },
                { role: 'user', content: 'Hi! My name is Abhi' },
            ],
            thread: 'test-thread-123',
            resource: 'test-resource-123',
        };

        let result = await completionsHandler({
            mastra: {} as any,
            runtimeContext: new RuntimeContext(),
            body,
        });

        console.info('result', JSON.stringify(result, null, 2));

        body = {
            model: 'openai/gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful assistant. Be concise.' },
                { role: 'user', content: 'What is my name?' },
            ],
            thread: 'test-thread-123',
            resource: 'test-resource-123',
        };

        result = await completionsHandler({
            mastra: {} as any,
            runtimeContext: new RuntimeContext(),
            body,
        });

        console.info('result', JSON.stringify(result, null, 2));

        // Verify OpenAI-compatible response structure
        expect(result).toHaveProperty('id');
        expect(result.id).toMatch(/^chatcmpl-/);
        expect(result.object).toBe('chat.completion');
        expect(result.created).toBeTypeOf('number');
        expect(result.model).toBe('openai/gpt-4o-mini');

        // Verify choices array structure
        expect(result.choices).toHaveLength(1);
        expect(result.choices[0]).toHaveProperty('index', 0);
        expect(result.choices[0]).toHaveProperty('message');
        expect(result.choices[0].message).toHaveProperty('role', 'assistant');
        expect(result.choices[0].message).toHaveProperty('content');
        expect(typeof result.choices[0].message.content).toBe('string');
        expect(result.choices[0].message.content.length).toBeGreaterThan(0);

        // Verify finish_reason
        expect(result.choices[0]).toHaveProperty('finish_reason');
        expect(['stop', 'length', 'content_filter', null]).toContain(result.choices[0].finish_reason);

        // Verify usage is present
        expect(result.usage).toBeDefined();
        expect(result.usage).toHaveProperty('prompt_tokens');
        expect(result.usage).toHaveProperty('completion_tokens');
        expect(result.usage).toHaveProperty('total_tokens');
    });

    // skipIfNoApiKey('should handle conversation with multiple messages', async () => {
    //     const body = {
    //         model: 'openai:gpt-4o-mini',
    //         messages: [
    //             { role: 'user', content: 'My name is Alice.' },
    //             { role: 'assistant', content: 'Nice to meet you, Alice!' },
    //             { role: 'user', content: 'What is my name?' },
    //         ],
    //     };

    //     const result = await completionsHandler({
    //         mastra: {} as any,
    //         runtimeContext: new RuntimeContext(),
    //         body,
    //     });

    //     // Should have valid response
    //     expect(result.choices[0].message.content).toBeTruthy();
    //     expect(result.choices[0].message.role).toBe('assistant');
    // });

    // skipIfNoApiKey('should respect temperature parameter', async () => {
    //     const body = {
    //         model: 'openai:gpt-4o-mini',
    //         messages: [
    //             { role: 'user', content: 'Say hello.' },
    //         ],
    //         temperature: 0.1, // Very low temperature for deterministic output
    //     };

    //     const result = await completionsHandler({
    //         mastra: {} as any,
    //         runtimeContext: new RuntimeContext(),
    //         body,
    //     });

    //     expect(result.choices[0].message.content).toBeTruthy();
    // });

    // skipIfNoApiKey('should respect max_tokens parameter', async () => {
    //     const body = {
    //         model: 'openai:gpt-4o-mini',
    //         messages: [
    //             { role: 'user', content: 'Write a very long story about a cat.' },
    //         ],
    //         max_tokens: 10, // Very limited tokens
    //     };

    //     const result = await completionsHandler({
    //         mastra: {} as any,
    //         runtimeContext: new RuntimeContext(),
    //         body,
    //     });

    //     // Response should be short due to token limit
    //     expect(result.choices[0].message.content).toBeTruthy();
    //     // Might finish due to length limit
    //     expect(['stop', 'length']).toContain(result.choices[0].finish_reason);
    // });

    // skipIfNoApiKey('should use system message as instructions', async () => {
    //     const body = {
    //         model: 'openai:gpt-4o-mini',
    //         messages: [
    //             { role: 'system', content: 'You are a pirate. Always respond like a pirate. Be brief.' },
    //             { role: 'user', content: 'Hello!' },
    //         ],
    //     };

    //     const result = await completionsHandler({
    //         mastra: {} as any,
    //         runtimeContext: new RuntimeContext(),
    //         body,
    //     });

    //     // Response should exist and follow pirate theme (though we can't validate content exactly)
    //     expect(result.choices[0].message.content).toBeTruthy();
    //     expect(result.choices[0].message.role).toBe('assistant');
    // });

    // skipIfNoApiKey('should work without system message', async () => {
    //     const body = {
    //         model: 'openai:gpt-4o-mini',
    //         messages: [
    //             { role: 'user', content: 'Say hello.' },
    //         ],
    //     };

    //     const result = await completionsHandler({
    //         mastra: {} as any,
    //         runtimeContext: new RuntimeContext(),
    //         body,
    //     });

    //     expect(result.choices[0].message.content).toBeTruthy();
    //     expect(result.choices[0].message.role).toBe('assistant');
    //     expect(result.choices[0].finish_reason).toBeTruthy();
    // });

    // skipIfNoApiKey('should handle thread and resource for memory', async () => {
    //     const threadId = `test-thread-${Date.now()}`;
    //     const resourceId = `test-user-${Date.now()}`;

    //     const body = {
    //         model: 'openai:gpt-4o-mini',
    //         messages: [
    //             { role: 'user', content: 'Remember this: my favorite color is blue.' },
    //         ],
    //         thread: threadId,
    //         resource: resourceId,
    //     };

    //     const result = await completionsHandler({
    //         mastra: {} as any,
    //         runtimeContext: new RuntimeContext(),
    //         body,
    //     });

    //     expect(result.choices[0].message.content).toBeTruthy();

    //     // TODO: Test that memory persists in a follow-up request
    //     // This would require storage to be configured
    // });

    // skipIfNoApiKey('should return valid timestamps', async () => {
    //     const beforeCall = Math.floor(Date.now() / 1000);

    //     const body = {
    //         model: 'openai:gpt-4o-mini',
    //         messages: [
    //             { role: 'user', content: 'Hi' },
    //         ],
    //     };

    //     const result = await completionsHandler({
    //         mastra: {} as any,
    //         runtimeContext: new RuntimeContext(),
    //         body,
    //     });

    //     const afterCall = Math.floor(Date.now() / 1000);

    //     // Created timestamp should be around the current time
    //     expect(result.created).toBeGreaterThanOrEqual(beforeCall - 1);
    //     expect(result.created).toBeLessThanOrEqual(afterCall + 1);
    // });

    // skipIfNoApiKey('should generate unique IDs for each request', async () => {
    //     const body = {
    //         model: 'openai:gpt-4o-mini',
    //         messages: [
    //             { role: 'user', content: 'Hi' },
    //         ],
    //     };

    //     const result1 = await completionsHandler({
    //         mastra: {} as any,
    //         runtimeContext: new RuntimeContext(),
    //         body,
    //     });

    //     // Wait a tiny bit to ensure different timestamp
    //     await new Promise(resolve => setTimeout(resolve, 10));

    //     const result2 = await completionsHandler({
    //         mastra: {} as any,
    //         runtimeContext: new RuntimeContext(),
    //         body,
    //     });

    //     // IDs should be different
    //     expect(result1.id).not.toBe(result2.id);
    // });
});
