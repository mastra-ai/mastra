/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
interface LRUOptions {
    capacity: number;
}
export default class LRU<K, V> {
    private capacity;
    private map;
    private deque;
    constructor({ capacity }: LRUOptions);
    get length(): number;
    has(key: K): boolean;
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    keys(): IterableIterator<K>;
    entries(): IterableIterator<[K, V]>;
    values(): IterableIterator<V>;
}
export {};
