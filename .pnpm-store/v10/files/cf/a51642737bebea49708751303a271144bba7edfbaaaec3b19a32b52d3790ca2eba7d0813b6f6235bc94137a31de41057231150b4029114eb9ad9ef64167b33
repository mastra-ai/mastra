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
export type NextFn<T> = (value: T) => void;
export type ErrorFn = (error: Error) => void;
export type CompleteFn = () => void;
export interface Observer<T> {
    next: NextFn<T>;
    error: ErrorFn;
    complete: CompleteFn;
}
export type PartialObserver<T> = Partial<Observer<T>>;
export type Unsubscribe = () => void;
/**
 * The Subscribe interface has two forms - passing the inline function
 * callbacks, or a object interface with callback properties.
 */
export interface Subscribe<T> {
    (next?: NextFn<T>, error?: ErrorFn, complete?: CompleteFn): Unsubscribe;
    (observer: PartialObserver<T>): Unsubscribe;
}
export interface Observable<T> {
    subscribe: Subscribe<T>;
}
export type Executor<T> = (observer: Observer<T>) => void;
/**
 * Helper to make a Subscribe function (just like Promise helps make a
 * Thenable).
 *
 * @param executor Function which can make calls to a single Observer
 *     as a proxy.
 * @param onNoObservers Callback when count of Observers goes to zero.
 */
export declare function createSubscribe<T>(executor: Executor<T>, onNoObservers?: Executor<T>): Subscribe<T>;
/** Turn synchronous function into one called asynchronously. */
export declare function async(fn: Function, onError?: ErrorFn): Function;
