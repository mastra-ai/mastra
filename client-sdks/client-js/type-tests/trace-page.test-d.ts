import type { TracePageRequest as CoreRequest, TracePageResponse as CoreResponse } from '@mastra/core/storage';
import { expectTypeOf, test } from 'vitest';
import type { MastraClient } from '../src/client';
import type { TracePageRequest, TracePageResponse } from '../src/resources/trace-page-types';
import type { RouteKey } from '../src/route-types.generated';
import type { GetObservabilityCapabilitiesResponse, Serialized } from '../src/types';

type CoreWireResponse = Serialized<CoreResponse>;
type CoreWireNode = CoreWireResponse['nodes'][number];
// HTTP serializes the internal status enum as its string values.
type ExpectedResponse = Omit<CoreWireResponse, 'nodes'> & {
  nodes: (Omit<CoreWireNode, 'status'> & { status: `${CoreWireNode['status']}` })[];
};

test('keeps Platform trace page types aligned without exposing an OSS server route', () => {
  expectTypeOf<TracePageRequest>().toEqualTypeOf<CoreRequest>();
  expectTypeOf<TracePageResponse>().toMatchTypeOf<ExpectedResponse>();
  expectTypeOf<ExpectedResponse>().toMatchTypeOf<TracePageResponse>();
  expectTypeOf<keyof TracePageResponse>().toEqualTypeOf<keyof ExpectedResponse>();
  expectTypeOf<keyof TracePageResponse['nodes'][number]>().toEqualTypeOf<keyof ExpectedResponse['nodes'][number]>();
  expectTypeOf<keyof NonNullable<TracePageResponse['nodes'][number]['details']>>().toEqualTypeOf<
    keyof NonNullable<ExpectedResponse['nodes'][number]['details']>
  >();
  expectTypeOf<keyof NonNullable<TracePageResponse['nodes'][number]['familySummary']>>().toEqualTypeOf<
    keyof NonNullable<ExpectedResponse['nodes'][number]['familySummary']>
  >();
  expectTypeOf<keyof NonNullable<TracePageResponse['traceContext']>>().toEqualTypeOf<
    keyof NonNullable<ExpectedResponse['traceContext']>
  >();
  expectTypeOf<keyof NonNullable<TracePageResponse['traceContext']>['roots'][number]>().toEqualTypeOf<
    keyof NonNullable<ExpectedResponse['traceContext']>['roots'][number]
  >();
  expectTypeOf<ReturnType<MastraClient['getTracePage']>>().toEqualTypeOf<Promise<TracePageResponse>>();
  expectTypeOf<Extract<RouteKey, 'POST /observability/traces/:traceId/page'>>().toEqualTypeOf<never>();
  expectTypeOf<GetObservabilityCapabilitiesResponse['capabilities']['tracePage']>().toEqualTypeOf<
    boolean | undefined
  >();
});
