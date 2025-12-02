/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { DataSnapshot as ExpDataSnapshot } from '../../api/Reference_impl';
import { Path } from '../util/Path';
import { EventRegistration } from './EventRegistration';
/**
 * Encapsulates the data needed to raise an event
 * @interface
 */
export interface Event {
    getPath(): Path;
    getEventType(): string;
    getEventRunner(): () => void;
    toString(): string;
}
/**
 * One of the following strings: "value", "child_added", "child_changed",
 * "child_removed", or "child_moved."
 */
export type EventType = 'value' | 'child_added' | 'child_changed' | 'child_moved' | 'child_removed';
/**
 * Encapsulates the data needed to raise an event
 */
export declare class DataEvent implements Event {
    eventType: EventType;
    eventRegistration: EventRegistration;
    snapshot: ExpDataSnapshot;
    prevName?: string | null;
    /**
     * @param eventType - One of: value, child_added, child_changed, child_moved, child_removed
     * @param eventRegistration - The function to call to with the event data. User provided
     * @param snapshot - The data backing the event
     * @param prevName - Optional, the name of the previous child for child_* events.
     */
    constructor(eventType: EventType, eventRegistration: EventRegistration, snapshot: ExpDataSnapshot, prevName?: string | null);
    getPath(): Path;
    getEventType(): string;
    getEventRunner(): () => void;
    toString(): string;
}
export declare class CancelEvent implements Event {
    eventRegistration: EventRegistration;
    error: Error;
    path: Path;
    constructor(eventRegistration: EventRegistration, error: Error, path: Path);
    getPath(): Path;
    getEventType(): string;
    getEventRunner(): () => void;
    toString(): string;
}
