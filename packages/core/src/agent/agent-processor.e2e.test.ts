import { openai } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from './index';

describe('StructuredOutputProcessor Integration Tests', () => {
  function testStructuredOutput(model: LanguageModelV2) {
    describe('with real LLM', () => {
      it('should convert unstructured text to structured JSON for color analysis', async () => {
        const colorSchema = z.object({
          color: z.string().describe('The primary color'),
          intensity: z.enum(['light', 'medium', 'bright', 'vibrant']).describe('How intense the color is'),
          hexCode: z
            .string()
            .regex(/^#[0-9A-F]{6}$/i)
            .describe('Hex color code')
            .nullable(),
          mood: z.string().describe('The mood or feeling the color evokes'),
        });

        const agent = new Agent({
          id: 'color-expert',
          name: 'Color Expert',
          instructions: `You are an expert on colors. 
              Analyze colors and describe their properties, psychological effects, and technical details.
              Always give a hex code for the color.
              `,
          model,
        });

        const result = await agent.generate(
          'Tell me about a vibrant sunset orange color. What are its properties and how does it make people feel? Keep your response really short.',
          {
            structuredOutput: {
              schema: colorSchema,
              model, // Use smaller model for faster tests
              errorStrategy: 'strict',
            },
          },
        );

        // Verify we have both natural text AND structured data
        expect(result.text).toBeTruthy();

        expect(() => JSON.parse(result.text)).toThrow();

        expect(result.object).toBeDefined();

        // Validate the structured data
        expect(result.object).toMatchObject({
          color: expect.any(String),
          intensity: expect.stringMatching(/^(light|medium|bright|vibrant)$/),
          hexCode: expect.stringMatching(/^#[0-9A-F]{6}$/i),
          mood: expect.any(String),
        });

        // Validate the content makes sense for orange
        expect(result.object!.color.toLowerCase()).toContain('orange');
        expect(['bright', 'vibrant']).toContain(result.object!.intensity);
        expect(result.object!.mood).toBeTruthy();

        console.log('Natural text:', result.text);
        console.log('Structured color data:', result.object);
      }, 40000);

      it('should handle complex nested schemas for article analysis', async () => {
        const articleSchema = z.object({
          title: z.string().describe('A concise title for the content'),
          summary: z.string().describe('A brief summary of the main points'),
          keyPoints: z
            .array(
              z.object({
                point: z.string().describe('A key insight or main point'),
                importance: z.number().min(1).max(5).describe('Importance level from 1-5'),
              }),
            )
            .describe('List of key points from the content'),
          metadata: z.object({
            topics: z.array(z.string()).describe('Main topics covered'),
            difficulty: z.enum(['beginner', 'intermediate', 'advanced']).describe('Content difficulty level'),
            estimatedReadTime: z.number().describe('Estimated reading time in minutes'),
          }),
        });

        const agent = new Agent({
          id: 'content-analyzer',
          name: 'Content Analyzer',
          instructions: 'You are an expert content analyst. Read and analyze text content to extract key insights.',
          model,
        });

        const articleText = `
          Machine learning has revolutionized how we approach data analysis. 
          At its core, machine learning involves training algorithms to recognize patterns in data. 
          There are three main types: supervised learning (with labeled data), unsupervised learning (finding hidden patterns), 
          and reinforcement learning (learning through trial and error). 
          Popular applications include recommendation systems, image recognition, and natural language processing. 
          For beginners, starting with simple algorithms like linear regression or decision trees is recommended.
        `;

        const result = await agent.generate(`Analyze this article and extract key information:\n\n${articleText}`, {
          structuredOutput: {
            schema: articleSchema,
            model,
            errorStrategy: 'strict',
          },
        });

        // Verify we have both natural text AND structured data
        expect(result.text).toBeTruthy();

        expect(() => JSON.parse(result.text)).toThrow();

        expect(result.object).toBeDefined();

        // Validate the structured data
        expect(result.object).toMatchObject({
          title: expect.any(String),
          summary: expect.any(String),
          keyPoints: expect.arrayContaining([
            expect.objectContaining({
              point: expect.any(String),
              importance: expect.any(Number),
            }),
          ]),
          metadata: expect.objectContaining({
            topics: expect.any(Array),
            difficulty: expect.stringMatching(/^(beginner|intermediate|advanced)$/),
            estimatedReadTime: expect.any(Number),
          }),
        });

        // Validate content relevance
        expect(result.object!.title.toLowerCase()).toMatch(/machine learning|ml|data/);
        expect(result.object!.summary.toLowerCase()).toContain('machine learning');
        expect(result.object!.keyPoints.length).toBeGreaterThan(0);
        expect(
          result.object!.metadata.topics.some(
            (topic: string) => topic.toLowerCase().includes('machine learning') || topic.toLowerCase().includes('data'),
          ),
        ).toBe(true);

        console.log('Natural text:', result.text);
        console.log('Structured article analysis:', result.object);
      }, 40000);

      it('should handle fallback strategy gracefully', async () => {
        const strictSchema = z.object({
          impossible: z.literal('exact_match_required'),
          number: z.number().min(1000).max(1000), // Very restrictive
        });

        const fallbackValue = {
          impossible: 'exact_match_required' as const,
          number: 1000,
        };

        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant.',
          model,
        });

        const result = await agent.generate('Tell me about the weather today in a casual way.', {
          structuredOutput: {
            schema: strictSchema,
            model: new MockLanguageModelV2({
              doStream: async () => {
                throw new Error('test error');
              },
            }),
            errorStrategy: 'fallback',
            fallbackValue,
          },
        });

        // Should preserve natural text but return fallback object
        expect(result.text).toBeTruthy();

        expect(result.object).toEqual(fallbackValue);

        console.log('Natural text:', result.text);
        console.log('Fallback object:', result.object);
      }, 40000);

      it('should work with different models for main agent vs structuring agent', async () => {
        const ideaSchema = z.object({
          idea: z.string().describe('The creative idea'),
          category: z.enum(['technology', 'business', 'art', 'science', 'other']).describe('Category of the idea'),
          feasibility: z.number().min(1).max(10).describe('How feasible is this idea (1-10)'),
          resources: z.array(z.string()).describe('Resources needed to implement'),
        });

        const agent = new Agent({
          id: 'creative-thinker',
          name: 'Creative Thinker',
          instructions: 'You are a creative thinker who generates innovative ideas and explores possibilities.',
          model, // Use faster model for idea generation
        });

        const result = await agent.generate(
          'Come up with an innovative solution for reducing food waste in restaurants.',
          {
            structuredOutput: {
              schema: ideaSchema,
              model,
              errorStrategy: 'strict',
            },
          },
        );

        // Verify we have both natural text AND structured data
        expect(result.text).toBeTruthy();

        expect(result.object).toBeDefined();

        // Validate structured data
        expect(result.object).toMatchObject({
          idea: expect.any(String),
          category: expect.stringMatching(/^(technology|business|art|science|other)$/),
          feasibility: expect.any(Number),
          resources: expect.any(Array),
        });

        // Validate content
        expect(result.object!.idea).toBeDefined();
        expect(result.object!.feasibility).toBeGreaterThanOrEqual(1);
        expect(result.object!.feasibility).toBeLessThanOrEqual(10);
        expect(result.object!.resources.length).toBeGreaterThan(0);

        console.log('Natural text:', result.text);
        console.log('Structured idea data:', result.object);
      }, 40000);
    });

    it('should work with stream', async () => {
      const ideaSchema = z.object({
        idea: z.string().describe('The creative idea'),
        category: z.enum(['technology', 'business', 'art', 'science', 'other']).describe('Category of the idea'),
        feasibility: z.number().min(1).max(10).describe('How feasible is this idea (1-10)'),
        resources: z.array(z.string()).describe('Resources needed to implement'),
      });

      const agent = new Agent({
        id: 'creative-thinker',
        name: 'Creative Thinker',
        instructions: 'You are a creative thinker who generates innovative ideas and explores possibilities.',
        model: model,
      });

      const result = await agent.stream(
        `
              Come up with an innovative solution for reducing food waste in restaurants. 
              Make sure to include an idea, category, feasibility, and resources.
            `,
        {
          structuredOutput: {
            schema: ideaSchema,
            model,
            errorStrategy: 'strict',
          },
        },
      );

      const resultText = await result.text;
      const resultObj = await result.object;

      expect(resultText).toBeTruthy();
      expect(resultText).toMatch(/food waste|restaurant|reduce|solution|innovative/i); // Should contain natural language
      expect(resultObj).toBeDefined();

      expect(resultObj).toMatchObject({
        idea: expect.any(String),
        category: expect.stringMatching(/^(technology|business|art|science|other)$/),
        feasibility: expect.any(Number),
        resources: expect.any(Array),
      });

      expect(resultObj.feasibility).toBeGreaterThanOrEqual(1);
      expect(resultObj.feasibility).toBeLessThanOrEqual(10);
      expect(resultObj.resources.length).toBeGreaterThan(0);
    }, 60000);

    it('should work with stream with useJsonSchemaPromptInjection', async () => {
      const ideaSchema = z.object({
        idea: z.string().describe('The creative idea'),
        category: z.enum(['technology', 'business', 'art', 'science', 'other']).describe('Category of the idea'),
        feasibility: z.number().min(1).max(10).describe('How feasible is this idea (1-10)'),
        resources: z.array(z.string()).describe('Resources needed to implement'),
      });

      const agent = new Agent({
        id: 'creative-thinker',
        name: 'Creative Thinker',
        instructions: 'You are a creative thinker who generates innovative ideas and explores possibilities.',
        model: model,
      });

      const result = await agent.stream(
        `
              Come up with an innovative solution for reducing food waste in restaurants. 
              Make sure to include an idea, category, feasibility, and resources.
            `,
        {
          structuredOutput: {
            schema: ideaSchema,
            model,
            errorStrategy: 'strict',
            jsonPromptInjection: true,
          },
        },
      );

      const resultText = await result.text;
      const resultObj = await result.object;

      expect(resultText).toBeTruthy();
      expect(resultText).toMatch(/food waste|restaurant|reduce|solution|innovative/i); // Should contain natural language
      expect(resultObj).toBeDefined();

      expect(resultObj).toMatchObject({
        idea: expect.any(String),
        category: expect.stringMatching(/^(technology|business|art|science|other)$/),
        feasibility: expect.any(Number),
        resources: expect.any(Array),
      });

      expect(resultObj.feasibility).toBeGreaterThanOrEqual(1);
      expect(resultObj.feasibility).toBeLessThanOrEqual(10);
      expect(resultObj.resources.length).toBeGreaterThan(0);
    }, 60000);
  }

  testStructuredOutput(openai('gpt-4o'));
});
