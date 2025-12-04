import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { config } from 'dotenv';
import { describe, it, expect } from 'vitest';
import { ObservationalMemory } from './processor';

config()

describe('Observational Memory Processor', () => {
    it('should be able to process output result', async () => {
        const processor = new ObservationalMemory({
            observer: {
                model: 'google/gemini-2.5-flash'
            },
            storage: new InMemoryStore({
                id: 'test-storage',
            })
        });

        const agent = new Agent({
            id: 'test-agent',
            name: 'Test Agent',
            instructions: 'You are a helpful assistant.',
            model: 'openai/gpt-4o',
            inputProcessors: [processor],
            outputProcessors: [processor],
        });

        const result = await agent.generate('I live in California, and my birthday is November 12th, 1991.', {
            memory: {
                thread: 'test-thread',
                resource: 'test-resource',
            }
        });

        expect(result).toBeDefined();


        await agent.generate('Currently, I am working on a project to build a new website for my company.', {
            memory: {
                thread: 'test-thread',
                resource: 'test-resource',
            }
        });

    });
}, 1000000);