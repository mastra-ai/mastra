import { RequestContext as CoreRequestContext } from '@mastra/core/request-context';
import type {
  GetTraceQueryFieldsArgs as CoreGetTraceQueryFieldsArgs,
  GetTraceQueryValuesResponse as CoreGetTraceQueryValuesResponse,
  TraceQueryCanonicalFieldDescriptor as CoreTraceQueryCanonicalFieldDescriptor,
} from '@mastra/core/storage';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { GetTraceQueryFieldsArgs, GetTraceQueryValuesResponse, TraceQueryCanonicalFieldDescriptor } from './index';
import { RequestContext } from './index';

describe('package exports', () => {
  it('re-exports RequestContext from core', () => {
    expect(RequestContext).toBe(CoreRequestContext);
  });

  it('re-exports trace-query discovery types from core', () => {
    expectTypeOf<GetTraceQueryFieldsArgs>().toEqualTypeOf<CoreGetTraceQueryFieldsArgs>();
    expectTypeOf<GetTraceQueryValuesResponse>().toEqualTypeOf<CoreGetTraceQueryValuesResponse>();
    expectTypeOf<TraceQueryCanonicalFieldDescriptor>().toEqualTypeOf<CoreTraceQueryCanonicalFieldDescriptor>();
  });
});
