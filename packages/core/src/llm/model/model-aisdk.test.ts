import { openai } from "@ai-sdk/openai-v5";
import { stepCountIs } from "ai-v5";
import { describe, expect, it, vi } from "vitest";
import z from "zod";
import { RuntimeContext } from "../../runtime-context";
import { createTool } from "../../tools";
import { ModelAISDKV5 } from './model-aisdk'
import { Agent } from "../../agent";

describe('ModelAISDKV5', () => {
    const model = new ModelAISDKV5({
        model: openai('gpt-4o'),
    });

    const spy = vi.fn();

    const tool = createTool({
        id: 'test',
        inputSchema: z.object({ test: z.string() }),
        description: 'Test tool description',
        execute: async () => {
            spy();
            return 'Test';
        },
    })

    const agent = new Agent({
        instructions: 'You are a helpful assistant.',
        name: 'test',
        model: openai('gpt-4o'),
        tools: {
            test: tool,
        },
    })

    const runtimeContext = new RuntimeContext();

    describe.only('generate', () => {
        it('should generate text', async () => {
            const result = await agent.generate('Hello, how are you?');
            console.log(result.text);
        });

        it('should call tool', async () => {
            const result = await agent.generate('test message with tool call', {
                temperature: 0.7,
            });

            console.log(result.text);
            console.log(result);

            expect(spy).toHaveBeenCalled();
        })
    });

    describe('text', () => {
        it('should generate text', async () => {
            const result = await model.__text({
                messages: [{
                    role: 'user',
                    content: 'Hello, how are you?',
                }],
                runtimeContext,
                temperature: 0.7,
                stopWhen: stepCountIs(1),
            })

            console.log(result.text);

            expect(result).toBeDefined();
        });

        it('should generate structured output when output is provided', async () => {
            const schema = z.object({
                content: z.string(),
            });

            const result = await model.__text({
                messages: [{ role: 'user', content: 'test message' }],
                temperature: 0.7,
                experimental_output: schema,
                runtimeContext,
            });

            console.log(result.object);

            expect(result).toBeDefined();
        });

        it('should call tool', async () => {
            const spy = vi.fn();

            const tool = createTool({
                id: 'test',
                inputSchema: z.object({ test: z.string() }),
                description: 'Test tool description',
                execute: async () => {
                    spy();
                    return 'Test';
                },
            })

            const result = await model.__text({
                messages: [{ role: 'user', content: 'test message with tool call' }],
                temperature: 0.7,
                tools: { test: tool },
                runtimeContext,
            });

            console.log(result.text);
            console.log(result.content);

            expect(spy).toHaveBeenCalled();
        })
    });

    describe('object', () => {
        it('should generate object', async () => {
            const schema = z.object({
                content: z.string(),
            });

            const result = await model.__textObject({
                messages: [{ role: 'user', content: 'test message' }],
                temperature: 0.7,
                structuredOutput: schema,
                runtimeContext,
            });

            console.log(result.object);

            expect(result.object.content).toBeDefined();
        })
    })

    describe('stream', () => {
        it('should stream text', async () => {
            const result = await model.__stream({
                messages: [{ role: 'user', content: 'test message' }],
                runtimeContext,
            });

            for await (const chunk of result.fullStream) {
                expect(chunk.type).toBeDefined()
            }
        })

        it('should stream object', async () => {
            const schema = z.object({
                content: z.string(),
            });

            const result = await model.__streamObject({
                messages: [{ role: 'user', content: 'test message' }],
                structuredOutput: schema,
                runtimeContext,

            });

            for await (const chunk of result.fullStream) {
                expect(chunk).toBeDefined()
            }

            console.log(await result.object)
        })
    });
});