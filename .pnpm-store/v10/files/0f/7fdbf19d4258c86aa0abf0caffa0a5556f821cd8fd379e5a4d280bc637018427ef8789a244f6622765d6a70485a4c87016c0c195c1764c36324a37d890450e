/**
 * @license
 * Copyright 2021 Google LLC
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
import { FirebaseNamespace } from '@firebase/app-compat';
import * as types from '@firebase/database-types';
export declare function registerDatabase(instance: FirebaseNamespace): void;
declare module '@firebase/app-compat' {
    interface FirebaseNamespace {
        database?: {
            (app?: FirebaseApp): types.FirebaseDatabase;
            enableLogging: typeof types.enableLogging;
            ServerValue: types.ServerValue;
            Database: typeof types.FirebaseDatabase;
        };
    }
    interface FirebaseApp {
        database?(databaseURL?: string): types.FirebaseDatabase;
    }
}

import { FirebaseApp as FirebaseAppCompat } from "@firebase/app-compat";
import { type DatabaseReference, type EmulatorMockTokenOptions, type DataSnapshot, type Database, type EventType, type Unsubscribe, type ListenOptions, type OnDisconnect, type ThenableReference, type QueryConstraint, type Query, type TransactionOptions, type TransactionResult } from "@firebase/database";
declare module "@firebase/database" {
    function child(parent: types.Reference, path: string): DatabaseReference;
    function connectDatabaseEmulator(db: types.FirebaseDatabase, host: string, port: number, options?: {
        mockUserToken?: EmulatorMockTokenOptions | string;
    }): void;
    function get(query: types.Query): Promise<DataSnapshot>;
    function getDatabase(app?: FirebaseAppCompat, url?: string): Database;
    function goOffline(db: types.FirebaseDatabase): void;
    function goOnline(db: types.FirebaseDatabase): void;
    function off(query: types.Query, eventType?: EventType, callback?: (snapshot: DataSnapshot, previousChildName?: string | null) => unknown): void;
    function onChildAdded(query: types.Query, callback: (snapshot: DataSnapshot, previousChildName?: string | null) => unknown, cancelCallback?: (error: Error) => unknown): Unsubscribe;
    function onChildAdded(query: types.Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, options: ListenOptions): Unsubscribe;
    function onChildAdded(query: types.Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, cancelCallback: (error: Error) => unknown, options: ListenOptions): Unsubscribe;
    function onChildChanged(query: types.Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, cancelCallback?: (error: Error) => unknown): Unsubscribe;
    function onChildChanged(query: types.Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, options: ListenOptions): Unsubscribe;
    function onChildChanged(query: types.Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, cancelCallback: (error: Error) => unknown, options: ListenOptions): Unsubscribe;
    function onChildMoved(query: types.Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, cancelCallback?: (error: Error) => unknown): Unsubscribe;
    function onChildMoved(query: types.Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, options: ListenOptions): Unsubscribe;
    function onChildMoved(query: types.Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, cancelCallback: (error: Error) => unknown, options: ListenOptions): Unsubscribe;
    function onChildRemoved(query: types.Query, callback: (snapshot: DataSnapshot) => unknown, cancelCallback?: (error: Error) => unknown): Unsubscribe;
    function onChildRemoved(query: types.Query, callback: (snapshot: DataSnapshot) => unknown, options: ListenOptions): Unsubscribe;
    function onChildRemoved(query: types.Query, callback: (snapshot: DataSnapshot) => unknown, cancelCallback: (error: Error) => unknown, options: ListenOptions): Unsubscribe;
    function onDisconnect(ref: types.Reference): OnDisconnect;
    function onValue(query: types.Query, callback: (snapshot: DataSnapshot) => unknown, cancelCallback?: (error: Error) => unknown): Unsubscribe;
    function onValue(query: types.Query, callback: (snapshot: DataSnapshot) => unknown, options: ListenOptions): Unsubscribe;
    function onValue(query: types.Query, callback: (snapshot: DataSnapshot) => unknown, cancelCallback: (error: Error) => unknown, options: ListenOptions): Unsubscribe;
    function push(parent: types.Reference, value?: unknown): ThenableReference;
    function query(query: types.Query, ...queryConstraints: QueryConstraint[]): Query;
    function ref(db: types.FirebaseDatabase, path?: string): DatabaseReference;
    function refFromURL(db: types.FirebaseDatabase, url: string): DatabaseReference;
    function remove(ref: types.Reference): Promise<void>;
    function runTransaction(ref: types.Reference, transactionUpdate: (currentData: any) => unknown, options?: TransactionOptions): Promise<TransactionResult>;
    function set(ref: types.Reference, value: unknown): Promise<void>;
    function setPriority(ref: types.Reference, priority: string | number | null): Promise<void>;
    function setWithPriority(ref: types.Reference, value: unknown, priority: string | number | null): Promise<void>;
    function update(ref: types.Reference, values: object): Promise<void>;
}
