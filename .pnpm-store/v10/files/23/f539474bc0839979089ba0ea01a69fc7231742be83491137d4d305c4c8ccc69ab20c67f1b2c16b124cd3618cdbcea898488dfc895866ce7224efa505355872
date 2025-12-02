/**
 * Copyright 2024 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Settings } from '@google-cloud/firestore';
import { Span as OpenTelemetrySpan, TracerProvider } from '@opentelemetry/api';
import { Span } from './span';
import { Attributes, TraceUtil } from './trace-util';
/**
 * @private
 * @internal
 */
export declare class EnabledTraceUtil implements TraceUtil {
    private tracer;
    private settingsAttributes;
    tracerProvider: TracerProvider;
    constructor(settings: Settings);
    recordProjectId(projectId: string): void;
    private millisToSecondString;
    private endSpan;
    startActiveSpan<F extends (span: Span) => unknown>(name: string, fn: F, attributes?: Attributes): ReturnType<F>;
    startSpan(name: string): Span;
    currentSpan(): Span;
    addCommonAttributes(otelSpan: OpenTelemetrySpan): void;
}
