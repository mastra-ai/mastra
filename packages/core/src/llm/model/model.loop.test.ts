import { openai } from '@ai-sdk/openai-v5';
import { describe, it } from 'vitest';
import { RuntimeContext } from '../../runtime-context';
import { MastraLLMVNext } from './model.loop';

const model = new MastraLLMVNext({
    model: openai('gpt-4o-mini')
});

describe('MastraLLMVNext', () => {

    it('should generate text - mastra', async () => {
        const result = model.__stream({
            messages: [
                {
                    role: 'user',
                    content: 'Hello, how are you?'
                }
            ],
            runtimeContext: new RuntimeContext(),
        });

        console.log(await result.getFullOutput());
    }, 10000);

    it('should generate text - aisdk', async () => {
        const result = model.__stream({
            messages: [
                {
                    role: 'user',
                    content: 'Hello, how are you?'
                }
            ],
            runtimeContext: new RuntimeContext(),
        });

        console.log(await result.aisdk.v5.getFullOutput());
    }, 10000);

    it('should stream text - mastra', async () => {
        const result = model.__stream({
            messages: [
                {
                    role: 'user',
                    content: 'Hello, how are you?'
                }
            ],
            runtimeContext: new RuntimeContext(),
        });

        for await (const chunk of result.fullStream) {
            console.log(chunk.type);
            console.log(chunk.payload);
        }
    }, 10000);

    it('should stream text - aisdk', async () => {
        const result = model.__stream({
            messages: [
                {
                    role: 'user',
                    content: 'Hello, how are you?'
                }
            ],
            runtimeContext: new RuntimeContext(),
        });

        for await (const chunk of result.aisdk.v5.fullStream) {
            console.log(chunk.type);
        }
    }, 10000);
});