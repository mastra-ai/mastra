import { expectTypeOf, describe, it } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { openai as openaiV4 } from 'openai-v4';
import { openai as openaiV5 } from 'openai-v5';

// Extract the model property type from Agent constructor parameters
type AgentConstructorParams = ConstructorParameters<typeof Agent>[0];
type ModelType = AgentConstructorParams['model'];

describe('Constructor', () => {
  describe('model', () => {
    it('should be typed', () => {
      expectTypeOf<ModelType>().not.toBeAny();
    });
    it('should accept a v1 model', () => {
      // Explicitly test that openai("gpt-4o") is assignable to the model parameter type
      expectTypeOf(openaiV4('gpt-4o')).toExtend<ModelType>();
    });

    it('should accept a v2 model', () => {
      // Explicitly test that openai("gpt-4o") is assignable to the model parameter type
      expectTypeOf(openaiV5('gpt-4o')).toExtend<ModelType>();
    });

    it('should accept a model router model', () => {
      // Explicitly test that openai("gpt-4o") is assignable to the model parameter type
      expectTypeOf('openai/gpt-4o').toExtend<ModelType>();
    });

    it('should not accept a random object', () => {
      expectTypeOf({}).not.toEqualTypeOf<ModelType>();
    });
  });
});
