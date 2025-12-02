import type * as redisTypes from 'redis';
import { Tracer } from '@opentelemetry/api';
import { RedisCommand, RedisInstrumentationConfig } from './types';
import { RedisPluginClientTypes } from './internal-types';
export declare const getTracedCreateClient: (tracer: Tracer, original: Function) => (this: redisTypes.RedisClient) => redisTypes.RedisClient;
export declare const getTracedCreateStreamTrace: (tracer: Tracer, original: Function) => (this: redisTypes.RedisClient) => any;
export declare const getTracedInternalSendCommand: (tracer: Tracer, original: Function, config?: RedisInstrumentationConfig | undefined) => (this: RedisPluginClientTypes, cmd?: RedisCommand | undefined) => any;
//# sourceMappingURL=utils.d.ts.map