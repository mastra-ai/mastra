import { EntityType, type EntityTypeValue } from '../storage';
import { SamplingStrategyType, type SamplingStrategyTypeValue } from './core';
import { InternalSpans, SpanType, type SpanTypeValue, TracingEventType, type TracingEventTypeValue, type TracingPolicy } from './tracing';

enum EmbeddedSpanType {
  AGENT_RUN = 'agent_run',
}

enum EmbeddedEntityType {
  AGENT = 'agent',
}

const spanType: SpanTypeValue = SpanType.AGENT_RUN;
const embeddedSpanType: SpanTypeValue = EmbeddedSpanType.AGENT_RUN;
const entityType: EntityTypeValue = EntityType.AGENT;
const embeddedEntityType: EntityTypeValue = EmbeddedEntityType.AGENT;
const samplingStrategyType: SamplingStrategyTypeValue = SamplingStrategyType.RATIO;
const tracingEventType: TracingEventTypeValue = TracingEventType.SPAN_STARTED;
const tracingPolicy: TracingPolicy = {
  internal: InternalSpans.WORKFLOW | InternalSpans.AGENT,
};

// @ts-expect-error Only known span values are accepted.
const invalidSpanType: SpanTypeValue = 'not-a-span';
// @ts-expect-error Only known entity values are accepted.
const invalidEntityType: EntityTypeValue = 'not-an-entity';

void [
  spanType,
  embeddedSpanType,
  entityType,
  embeddedEntityType,
  samplingStrategyType,
  tracingEventType,
  tracingPolicy,
  invalidSpanType,
  invalidEntityType,
];
