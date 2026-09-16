import type { MastraDBMessage } from '@mastra/core/agent';
import { expectTypeOf, test } from 'vitest';

import { SKILL_TOOL_NAMES, skillResultFilter, type ObserverMessageFilter } from '../src/filters';
import type { ObserveTransformHooks } from '../src/processors/observational-memory/types';

test('skillResultFilter is a synchronous beforeObservation filter', () => {
  const hook = skillResultFilter();

  // Public export surface: usable directly as a `beforeObservation` hook, so
  // `hooks: { beforeObservation: skillResultFilter() }` type-checks.
  expectTypeOf(hook).toExtend<NonNullable<ObserveTransformHooks['beforeObservation']>>();
  expectTypeOf(hook).toExtend<ObserverMessageFilter>();

  // The filter is synchronous, so returning `undefined` (pass-through) or a
  // replacement payload never requires `await`. This is what makes the
  // documented chaining pattern below compile.
  expectTypeOf(hook).returns.toEqualTypeOf<{ messages: MastraDBMessage[] } | undefined>();

  const input = { messages: [] as MastraDBMessage[], threadId: 'thread', resourceId: 'resource' };
  const result = hook(input);

  expectTypeOf(result).toEqualTypeOf<{ messages: MastraDBMessage[] } | undefined>();

  // Documented chaining pattern: compose the built-in filter with custom logic.
  const messages = result?.messages ?? input.messages;
  expectTypeOf(messages).toEqualTypeOf<MastraDBMessage[]>();
});

test('skillResultFilter options are typed and tool names are the literal built-ins', () => {
  expectTypeOf(SKILL_TOOL_NAMES).toEqualTypeOf<readonly ['skill', 'skill_search', 'skill_read']>();
  expectTypeOf(skillResultFilter({ toolNames: ['custom_tool'] })).toEqualTypeOf<ObserverMessageFilter>();
  // @ts-expect-error unknown options are rejected
  skillResultFilter({ unknownOption: true });
});
