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
import { DataSnapshot } from '../../api/Reference_impl';
import { Repo } from '../Repo';
import { Path } from '../util/Path';
import { Change } from './Change';
import { CancelEvent, Event } from './Event';
import { QueryParams } from './QueryParams';
/**
 * A user callback. Callbacks issues from the Legacy SDK maintain references
 * to the original user-issued callbacks, which allows equality
 * comparison by reference even though this callbacks are wrapped before
 * they can be passed to the firebase@exp SDK.
 *
 * @internal
 */
export interface UserCallback {
    (dataSnapshot: DataSnapshot, previousChildName?: string | null): unknown;
    userCallback?: unknown;
    context?: object | null;
}
/**
 * A wrapper class that converts events from the database@exp SDK to the legacy
 * Database SDK. Events are not converted directly as event registration relies
 * on reference comparison of the original user callback (see `matches()`) and
 * relies on equality of the legacy SDK's `context` object.
 */
export declare class CallbackContext {
    private readonly snapshotCallback;
    private readonly cancelCallback?;
    constructor(snapshotCallback: UserCallback, cancelCallback?: (error: Error) => unknown);
    onValue(expDataSnapshot: DataSnapshot, previousChildName?: string | null): void;
    onCancel(error: Error): void;
    get hasCancelCallback(): boolean;
    matches(other: CallbackContext): boolean;
}
export interface QueryContext {
    readonly _queryIdentifier: string;
    readonly _queryObject: object;
    readonly _repo: Repo;
    readonly _path: Path;
    readonly _queryParams: QueryParams;
}
/**
 * An EventRegistration is basically an event type ('value', 'child_added', etc.) and a callback
 * to be notified of that type of event.
 *
 * That said, it can also contain a cancel callback to be notified if the event is canceled.  And
 * currently, this code is organized around the idea that you would register multiple child_ callbacks
 * together, as a single EventRegistration.  Though currently we don't do that.
 */
export interface EventRegistration {
    /**
     * True if this container has a callback to trigger for this event type
     */
    respondsTo(eventType: string): boolean;
    createEvent(change: Change, query: QueryContext): Event;
    /**
     * Given event data, return a function to trigger the user's callback
     */
    getEventRunner(eventData: Event): () => void;
    createCancelEvent(error: Error, path: Path): CancelEvent | null;
    matches(other: EventRegistration): boolean;
    /**
     * False basically means this is a "dummy" callback container being used as a sentinel
     * to remove all callback containers of a particular type.  (e.g. if the user does
     * ref.off('value') without specifying a specific callback).
     *
     * (TODO: Rework this, since it's hacky)
     *
     */
    hasAnyCallback(): boolean;
}
