import type { WritableStream } from 'node:stream/web';
import { assertType, describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import type { ToolStream } from './stream';

describe('ToolStream', () => {
  describe('should be assignable to WritableStream for pipeTo()', () => {
    it('should be assignable to WritableStream<unknown>', () => {
      expectTypeOf<ToolStream>().toExtend<WritableStream<unknown>>();
    });

    it('should accept any type when used with pipeTo()', () => {
      type ToolStreamAsWritable = ToolStream extends WritableStream<infer T> ? T : never;
      expectTypeOf<ToolStreamAsWritable>().toEqualTypeOf<unknown>();
    });

    it('should allow assignment to WritableStream<unknown>', () => {
      assertType<(stream: ToolStream) => WritableStream<unknown>>((stream: ToolStream) => {
        const _writable: WritableStream<unknown> = stream;
        return _writable;
      });
    });

    it('should be compatible with partial object streams from structured output', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const storyPlanSchema = z.object({
        storyTitle: z.string(),
        chapters: z.array(
          z.object({
            chapterNumber: z.number(),
            title: z.string(),
            premise: z.string(),
          }),
        ),
      });

      type StoryPlan = z.infer<typeof storyPlanSchema>;
      type PartialStoryPlan = Partial<StoryPlan>;

      expectTypeOf<ToolStream>().toExtend<WritableStream<unknown>>();
      assertType<(data: PartialStoryPlan) => unknown>((data: PartialStoryPlan) => data as unknown);
    });

    it('should be compatible with fullStream', () => {
      expectTypeOf<ToolStream>().toExtend<WritableStream<unknown>>();

      assertType<(writer: ToolStream) => Promise<void>>(async (writer: ToolStream) => {
        const _stream: WritableStream<unknown> = writer;
        void _stream;
      });
    });

    it('should verify ToolStream write method accepts any type', () => {
      type ToolStreamWriteParam = Parameters<ToolStream['write']>[0];
      expectTypeOf<ToolStreamWriteParam>().toBeAny();
    });
  });

  describe('Workflow step writer', () => {
    it('should verify ToolStream is the expected writer type in workflow steps', () => {
      expectTypeOf<ToolStream>().toExtend<WritableStream<unknown>>();
    });
  });
});
