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
/**
 * Base class to be used if you want to emit events. Call the constructor with
 * the set of allowed event names.
 */
export declare abstract class EventEmitter {
    private allowedEvents_;
    private listeners_;
    constructor(allowedEvents_: string[]);
    /**
     * To be overridden by derived classes in order to fire an initial event when
     * somebody subscribes for data.
     *
     * @returns {Array.<*>} Array of parameters to trigger initial event with.
     */
    abstract getInitialEvent(eventType: string): unknown[];
    /**
     * To be called by derived classes to trigger events.
     */
    protected trigger(eventType: string, ...varArgs: unknown[]): void;
    on(eventType: string, callback: (a: unknown) => void, context: unknown): void;
    off(eventType: string, callback: (a: unknown) => void, context: unknown): void;
    private validateEventType_;
}
