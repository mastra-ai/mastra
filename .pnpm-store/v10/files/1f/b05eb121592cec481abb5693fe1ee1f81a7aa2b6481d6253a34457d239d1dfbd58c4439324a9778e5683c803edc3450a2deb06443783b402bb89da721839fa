export interface Streamable<O> {
    /**
     * Executes the query and streams the rows.
     *
     * The optional argument `chunkSize` defines how many rows to fetch from the database
     * at a time. It only affects some dialects like PostgreSQL that support it.
     *
     * ### Examples
     *
     * ```ts
     * const stream = db
     *   .selectFrom('person')
     *   .select(['first_name', 'last_name'])
     *   .where('gender', '=', 'other')
     *   .stream()
     *
     * for await (const person of stream) {
     *   console.log(person.first_name)
     *
     *   if (person.last_name === 'Something') {
     *     // Breaking or returning before the stream has ended will release
     *     // the database connection and invalidate the stream.
     *     break
     *   }
     * }
     * ```
     */
    stream(chunkSize?: number): AsyncIterableIterator<O>;
}
