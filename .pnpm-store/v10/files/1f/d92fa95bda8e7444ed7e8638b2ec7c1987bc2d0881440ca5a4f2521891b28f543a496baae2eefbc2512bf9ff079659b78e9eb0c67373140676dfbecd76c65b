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

import { FirebaseApp } from '@firebase/app-types';
import { EmulatorMockTokenOptions } from '@firebase/util';

/**
 * Represents a child snapshot of a `Reference` that is being iterated over. The key will never be undefined.
 */
export interface IteratedDataSnapshot extends DataSnapshot {
  key: string; // key of the location of this snapshot.
}

export interface DataSnapshot {
  child(path: string): DataSnapshot;
  exists(): boolean;
  exportVal(): any;
  forEach(action: (a: IteratedDataSnapshot) => boolean | void): boolean;
  getPriority(): string | number | null;
  hasChild(path: string): boolean;
  hasChildren(): boolean;
  key: string | null;
  numChildren(): number;
  ref: Reference;
  toJSON(): Object | null;
  val(): any;
}

export interface Database {
  app: FirebaseApp;
  useEmulator(
    host: string,
    port: number,
    options?: {
      mockUserToken?: EmulatorMockTokenOptions | string;
    }
  ): void;
  goOffline(): void;
  goOnline(): void;
  ref(path?: string | Reference): Reference;
  refFromURL(url: string): Reference;
}

export class FirebaseDatabase implements Database {
  private constructor();
  app: FirebaseApp;
  useEmulator(
    host: string,
    port: number,
    options?: {
      mockUserToken?: EmulatorMockTokenOptions | string;
    }
  ): void;
  goOffline(): void;
  goOnline(): void;
  ref(path?: string | Reference): Reference;
  refFromURL(url: string): Reference;
}

export interface OnDisconnect {
  cancel(onComplete?: (a: Error | null) => any): Promise<void>;
  remove(onComplete?: (a: Error | null) => any): Promise<void>;
  set(value: any, onComplete?: (a: Error | null) => any): Promise<void>;
  setWithPriority(
    value: any,
    priority: number | string | null,
    onComplete?: (a: Error | null) => any
  ): Promise<any>;
  update(values: Object, onComplete?: (a: Error | null) => any): Promise<any>;
}

type EventType =
  | 'value'
  | 'child_added'
  | 'child_changed'
  | 'child_moved'
  | 'child_removed';

export interface Query {
  endBefore(value: number | string | boolean | null, key?: string): Query;
  endAt(value: number | string | boolean | null, key?: string): Query;
  equalTo(value: number | string | boolean | null, key?: string): Query;
  isEqual(other: Query | null): boolean;
  limitToFirst(limit: number): Query;
  limitToLast(limit: number): Query;
  off(
    eventType?: EventType,
    callback?: (a: DataSnapshot, b?: string | null) => any,
    context?: Object | null
  ): void;
  get(): Promise<DataSnapshot>;
  on(
    eventType: EventType,
    callback: (a: DataSnapshot, b?: string | null) => any,
    cancelCallbackOrContext?: ((a: Error) => any) | Object | null,
    context?: Object | null
  ): (a: DataSnapshot | null, b?: string | null) => any;
  once(
    eventType: EventType,
    successCallback?: (a: DataSnapshot, b?: string | null) => any,
    failureCallbackOrContext?: ((a: Error) => void) | Object | null,
    context?: Object | null
  ): Promise<DataSnapshot>;
  orderByChild(path: string): Query;
  orderByKey(): Query;
  orderByPriority(): Query;
  orderByValue(): Query;
  ref: Reference;
  startAt(value: number | string | boolean | null, key?: string): Query;
  startAfter(value: number | string | boolean | null, key?: string): Query;
  toJSON(): Object;
  toString(): string;
}

export interface Reference extends Query {
  child(path: string): Reference;
  key: string | null;
  onDisconnect(): OnDisconnect;
  parent: Reference | null;
  push(value?: any, onComplete?: (a: Error | null) => any): ThenableReference;
  remove(onComplete?: (a: Error | null) => void): Promise<void>;
  root: Reference;
  set(value: any, onComplete?: (a: Error | null) => void): Promise<void>;
  setPriority(
    priority: string | number | null,
    onComplete: (a: Error | null) => void
  ): Promise<void>;
  setWithPriority(
    newVal: any,
    newPriority: string | number | null,
    onComplete?: (a: Error | null) => void
  ): Promise<void>;
  transaction(
    transactionUpdate: (a: any) => any,
    onComplete?: (a: Error | null, b: boolean, c: DataSnapshot | null) => void,
    applyLocally?: boolean
  ): Promise<TransactionResult>;
  update(values: Object, onComplete?: (a: Error | null) => void): Promise<void>;
}

export interface ServerValue {
  TIMESTAMP: Object;
  increment(delta: number): Object;
}

export interface TransactionResult {
  committed: boolean;
  snapshot: DataSnapshot;
}

export interface ThenableReference
  extends Reference,
    Pick<Promise<Reference>, 'then' | 'catch'> {
  key: string;
  parent: Reference;
}

export function enableLogging(
  logger?: boolean | ((a: string) => any),
  persistent?: boolean
): any;

declare module '@firebase/component' {
  interface NameServiceMapping {
    'database-compat': FirebaseDatabase;
  }
}
