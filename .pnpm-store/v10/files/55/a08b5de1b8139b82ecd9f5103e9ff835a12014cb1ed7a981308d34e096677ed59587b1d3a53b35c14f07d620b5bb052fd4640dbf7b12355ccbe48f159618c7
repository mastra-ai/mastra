import { Repo } from '../core/Repo';
import { Path } from '../core/util/Path';
import { QueryContext } from '../core/view/EventRegistration';
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
/**
 * A `Query` sorts and filters the data at a Database location so only a subset
 * of the child data is included. This can be used to order a collection of
 * data by some attribute (for example, height of dinosaurs) as well as to
 * restrict a large list of items (for example, chat messages) down to a number
 * suitable for synchronizing to the client. Queries are created by chaining
 * together one or more of the filter methods defined here.
 *
 * Just as with a `DatabaseReference`, you can receive data from a `Query` by using the
 * `on*()` methods. You will only receive events and `DataSnapshot`s for the
 * subset of the data that matches your query.
 *
 * See {@link https://firebase.google.com/docs/database/web/lists-of-data#sorting_and_filtering_data}
 * for more information.
 */
export interface Query extends QueryContext {
    /** The `DatabaseReference` for the `Query`'s location. */
    readonly ref: DatabaseReference;
    /**
     * Returns whether or not the current and provided queries represent the same
     * location, have the same query parameters, and are from the same instance of
     * `FirebaseApp`.
     *
     * Two `DatabaseReference` objects are equivalent if they represent the same location
     * and are from the same instance of `FirebaseApp`.
     *
     * Two `Query` objects are equivalent if they represent the same location,
     * have the same query parameters, and are from the same instance of
     * `FirebaseApp`. Equivalent queries share the same sort order, limits, and
     * starting and ending points.
     *
     * @param other - The query to compare against.
     * @returns Whether or not the current and provided queries are equivalent.
     */
    isEqual(other: Query | null): boolean;
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON(): string;
    /**
     * Gets the absolute URL for this location.
     *
     * The `toString()` method returns a URL that is ready to be put into a
     * browser, curl command, or a `refFromURL()` call. Since all of those expect
     * the URL to be url-encoded, `toString()` returns an encoded URL.
     *
     * Append '.json' to the returned URL when typed into a browser to download
     * JSON-formatted data. If the location is secured (that is, not publicly
     * readable), you will get a permission-denied error.
     *
     * @returns The absolute URL for this location.
     */
    toString(): string;
}
/**
 * A `DatabaseReference` represents a specific location in your Database and can be used
 * for reading or writing data to that Database location.
 *
 * You can reference the root or child location in your Database by calling
 * `ref()` or `ref("child/path")`.
 *
 * Writing is done with the `set()` method and reading can be done with the
 * `on*()` method. See {@link
 * https://firebase.google.com/docs/database/web/read-and-write}
 */
export interface DatabaseReference extends Query {
    /**
     * The last part of the `DatabaseReference`'s path.
     *
     * For example, `"ada"` is the key for
     * `https://<DATABASE_NAME>.firebaseio.com/users/ada`.
     *
     * The key of a root `DatabaseReference` is `null`.
     */
    readonly key: string | null;
    /**
     * The parent location of a `DatabaseReference`.
     *
     * The parent of a root `DatabaseReference` is `null`.
     */
    readonly parent: DatabaseReference | null;
    /** The root `DatabaseReference` of the Database. */
    readonly root: DatabaseReference;
}
/**
 * A `Promise` that can also act as a `DatabaseReference` when returned by
 * {@link push}. The reference is available immediately and the `Promise` resolves
 * as the write to the backend completes.
 */
export interface ThenableReference extends DatabaseReference, Pick<Promise<DatabaseReference>, 'then' | 'catch'> {
    key: string;
    parent: DatabaseReference;
}
/** A callback that can invoked to remove a listener. */
export type Unsubscribe = () => void;
/** An options objects that can be used to customize a listener. */
export interface ListenOptions {
    /** Whether to remove the listener after its first invocation. */
    readonly onlyOnce?: boolean;
}
export interface ReferenceConstructor {
    new (repo: Repo, path: Path): DatabaseReference;
}
