/**
 * Options to create an `IVF_PQ` index
 */
export interface IvfPqOptions {
    /**
     * The number of IVF partitions to create.
     *
     * This value should generally scale with the number of rows in the dataset.
     * By default the number of partitions is the square root of the number of
     * rows.
     *
     * If this value is too large then the first part of the search (picking the
     * right partition) will be slow.  If this value is too small then the second
     * part of the search (searching within a partition) will be slow.
     */
    numPartitions?: number;
    /**
     * Number of sub-vectors of PQ.
     *
     * This value controls how much the vector is compressed during the quantization step.
     * The more sub vectors there are the less the vector is compressed.  The default is
     * the dimension of the vector divided by 16.  If the dimension is not evenly divisible
     * by 16 we use the dimension divded by 8.
     *
     * The above two cases are highly preferred.  Having 8 or 16 values per subvector allows
     * us to use efficient SIMD instructions.
     *
     * If the dimension is not visible by 8 then we use 1 subvector.  This is not ideal and
     * will likely result in poor performance.
     */
    numSubVectors?: number;
    /**
     * Number of bits per sub-vector.
     *
     * This value controls how much each subvector is compressed.  The more bits the more
     * accurate the index will be but the slower search.  The default is 8 bits.
     *
     * The number of bits must be 4 or 8.
     */
    numBits?: number;
    /**
     * Distance type to use to build the index.
     *
     * Default value is "l2".
     *
     * This is used when training the index to calculate the IVF partitions
     * (vectors are grouped in partitions with similar vectors according to this
     * distance type) and to calculate a subvector's code during quantization.
     *
     * The distance type used to train an index MUST match the distance type used
     * to search the index.  Failure to do so will yield inaccurate results.
     *
     * The following distance types are available:
     *
     * "l2" - Euclidean distance. This is a very common distance metric that
     * accounts for both magnitude and direction when determining the distance
     * between vectors. l2 distance has a range of [0, ∞).
     *
     * "cosine" - Cosine distance.  Cosine distance is a distance metric
     * calculated from the cosine similarity between two vectors. Cosine
     * similarity is a measure of similarity between two non-zero vectors of an
     * inner product space. It is defined to equal the cosine of the angle
     * between them.  Unlike l2, the cosine distance is not affected by the
     * magnitude of the vectors.  Cosine distance has a range of [0, 2].
     *
     * Note: the cosine distance is undefined when one (or both) of the vectors
     * are all zeros (there is no direction).  These vectors are invalid and may
     * never be returned from a vector search.
     *
     * "dot" - Dot product. Dot distance is the dot product of two vectors. Dot
     * distance has a range of (-∞, ∞). If the vectors are normalized (i.e. their
     * l2 norm is 1), then dot distance is equivalent to the cosine distance.
     */
    distanceType?: "l2" | "cosine" | "dot";
    /**
     * Max iteration to train IVF kmeans.
     *
     * When training an IVF PQ index we use kmeans to calculate the partitions.  This parameter
     * controls how many iterations of kmeans to run.
     *
     * Increasing this might improve the quality of the index but in most cases these extra
     * iterations have diminishing returns.
     *
     * The default value is 50.
     */
    maxIterations?: number;
    /**
     * The number of vectors, per partition, to sample when training IVF kmeans.
     *
     * When an IVF PQ index is trained, we need to calculate partitions.  These are groups
     * of vectors that are similar to each other.  To do this we use an algorithm called kmeans.
     *
     * Running kmeans on a large dataset can be slow.  To speed this up we run kmeans on a
     * random sample of the data.  This parameter controls the size of the sample.  The total
     * number of vectors used to train the index is `sample_rate * num_partitions`.
     *
     * Increasing this value might improve the quality of the index but in most cases the
     * default should be sufficient.
     *
     * The default value is 256.
     */
    sampleRate?: number;
}
export interface IvfRqOptions {
    /**
     * The number of IVF partitions to create.
     *
     * This value should generally scale with the number of rows in the dataset.
     * By default the number of partitions is the square root of the number of
     * rows.
     *
     * If this value is too large then the first part of the search (picking the
     * right partition) will be slow. If this value is too small then the second
     * part of the search (searching within a partition) will be slow.
     */
    numPartitions?: number;
    /**
     * Number of bits per dimension for residual quantization.
     *
     * This value controls how much each residual component is compressed. The more
     * bits, the more accurate the index will be but the slower search. Typical values
     * are small integers; the default is 1 bit per dimension.
     */
    numBits?: number;
    /**
     * Distance type to use to build the index.
     *
     * Default value is "l2".
     *
     * This is used when training the index to calculate the IVF partitions
     * (vectors are grouped in partitions with similar vectors according to this
     * distance type) and during quantization.
     *
     * The distance type used to train an index MUST match the distance type used
     * to search the index. Failure to do so will yield inaccurate results.
     *
     * The following distance types are available:
     *
     * "l2" - Euclidean distance.
     * "cosine" - Cosine distance.
     * "dot" - Dot product.
     */
    distanceType?: "l2" | "cosine" | "dot";
    /**
     * Max iterations to train IVF kmeans.
     *
     * When training an IVF index we use kmeans to calculate the partitions. This parameter
     * controls how many iterations of kmeans to run.
     *
     * The default value is 50.
     */
    maxIterations?: number;
    /**
     * The number of vectors, per partition, to sample when training IVF kmeans.
     *
     * When an IVF index is trained, we need to calculate partitions. These are groups
     * of vectors that are similar to each other. To do this we use an algorithm called kmeans.
     *
     * Running kmeans on a large dataset can be slow. To speed this up we run kmeans on a
     * random sample of the data. This parameter controls the size of the sample. The total
     * number of vectors used to train the index is `sample_rate * num_partitions`.
     *
     * Increasing this value might improve the quality of the index but in most cases the
     * default should be sufficient.
     *
     * The default value is 256.
     */
    sampleRate?: number;
}
/**
 * Options to create an `HNSW_PQ` index
 */
export interface HnswPqOptions {
    /**
     * The distance metric used to train the index.
     *
     * Default value is "l2".
     *
     * The following distance types are available:
     *
     * "l2" - Euclidean distance. This is a very common distance metric that
     * accounts for both magnitude and direction when determining the distance
     * between vectors. l2 distance has a range of [0, ∞).
     *
     * "cosine" - Cosine distance.  Cosine distance is a distance metric
     * calculated from the cosine similarity between two vectors. Cosine
     * similarity is a measure of similarity between two non-zero vectors of an
     * inner product space. It is defined to equal the cosine of the angle
     * between them.  Unlike l2, the cosine distance is not affected by the
     * magnitude of the vectors.  Cosine distance has a range of [0, 2].
     *
     * "dot" - Dot product. Dot distance is the dot product of two vectors. Dot
     * distance has a range of (-∞, ∞). If the vectors are normalized (i.e. their
     * l2 norm is 1), then dot distance is equivalent to the cosine distance.
     */
    distanceType?: "l2" | "cosine" | "dot";
    /**
     * The number of IVF partitions to create.
     *
     * For HNSW, we recommend a small number of partitions. Setting this to 1 works
     * well for most tables. For very large tables, training just one HNSW graph
     * will require too much memory. Each partition becomes its own HNSW graph, so
     * setting this value higher reduces the peak memory use of training.
     *
     */
    numPartitions?: number;
    /**
     * Number of sub-vectors of PQ.
     *
     * This value controls how much the vector is compressed during the quantization step.
     * The more sub vectors there are the less the vector is compressed.  The default is
     * the dimension of the vector divided by 16.  If the dimension is not evenly divisible
     * by 16 we use the dimension divded by 8.
     *
     * The above two cases are highly preferred.  Having 8 or 16 values per subvector allows
     * us to use efficient SIMD instructions.
     *
     * If the dimension is not visible by 8 then we use 1 subvector.  This is not ideal and
     * will likely result in poor performance.
     *
     */
    numSubVectors?: number;
    /**
     * Max iterations to train kmeans.
     *
     * The default value is 50.
     *
     * When training an IVF index we use kmeans to calculate the partitions.  This parameter
     * controls how many iterations of kmeans to run.
     *
     * Increasing this might improve the quality of the index but in most cases the parameter
     * is unused because kmeans will converge with fewer iterations.  The parameter is only
     * used in cases where kmeans does not appear to converge.  In those cases it is unlikely
     * that setting this larger will lead to the index converging anyways.
     *
     */
    maxIterations?: number;
    /**
     * The rate used to calculate the number of training vectors for kmeans.
     *
     * Default value is 256.
     *
     * When an IVF index is trained, we need to calculate partitions.  These are groups
     * of vectors that are similar to each other.  To do this we use an algorithm called kmeans.
     *
     * Running kmeans on a large dataset can be slow.  To speed this up we run kmeans on a
     * random sample of the data.  This parameter controls the size of the sample.  The total
     * number of vectors used to train the index is `sample_rate * num_partitions`.
     *
     * Increasing this value might improve the quality of the index but in most cases the
     * default should be sufficient.
     *
     */
    sampleRate?: number;
    /**
     * The number of neighbors to select for each vector in the HNSW graph.
     *
     * The default value is 20.
     *
     * This value controls the tradeoff between search speed and accuracy.
     * The higher the value the more accurate the search but the slower it will be.
     *
     */
    m?: number;
    /**
     * The number of candidates to evaluate during the construction of the HNSW graph.
     *
     * The default value is 300.
     *
     * This value controls the tradeoff between build speed and accuracy.
     * The higher the value the more accurate the build but the slower it will be.
     * 150 to 300 is the typical range. 100 is a minimum for good quality search
     * results. In most cases, there is no benefit to setting this higher than 500.
     * This value should be set to a value that is not less than `ef` in the search phase.
     *
     */
    efConstruction?: number;
}
/**
 * Options to create an `HNSW_SQ` index
 */
export interface HnswSqOptions {
    /**
     * The distance metric used to train the index.
     *
     * Default value is "l2".
     *
     * The following distance types are available:
     *
     * "l2" - Euclidean distance. This is a very common distance metric that
     * accounts for both magnitude and direction when determining the distance
     * between vectors. l2 distance has a range of [0, ∞).
     *
     * "cosine" - Cosine distance.  Cosine distance is a distance metric
     * calculated from the cosine similarity between two vectors. Cosine
     * similarity is a measure of similarity between two non-zero vectors of an
     * inner product space. It is defined to equal the cosine of the angle
     * between them.  Unlike l2, the cosine distance is not affected by the
     * magnitude of the vectors.  Cosine distance has a range of [0, 2].
     *
     * "dot" - Dot product. Dot distance is the dot product of two vectors. Dot
     * distance has a range of (-∞, ∞). If the vectors are normalized (i.e. their
     * l2 norm is 1), then dot distance is equivalent to the cosine distance.
     */
    distanceType?: "l2" | "cosine" | "dot";
    /**
     * The number of IVF partitions to create.
     *
     * For HNSW, we recommend a small number of partitions. Setting this to 1 works
     * well for most tables. For very large tables, training just one HNSW graph
     * will require too much memory. Each partition becomes its own HNSW graph, so
     * setting this value higher reduces the peak memory use of training.
     *
     */
    numPartitions?: number;
    /**
     * Max iterations to train kmeans.
     *
     * The default value is 50.
     *
     * When training an IVF index we use kmeans to calculate the partitions.  This parameter
     * controls how many iterations of kmeans to run.
     *
     * Increasing this might improve the quality of the index but in most cases the parameter
     * is unused because kmeans will converge with fewer iterations.  The parameter is only
     * used in cases where kmeans does not appear to converge.  In those cases it is unlikely
     * that setting this larger will lead to the index converging anyways.
     *
     */
    maxIterations?: number;
    /**
     * The rate used to calculate the number of training vectors for kmeans.
     *
     * Default value is 256.
     *
     * When an IVF index is trained, we need to calculate partitions.  These are groups
     * of vectors that are similar to each other.  To do this we use an algorithm called kmeans.
     *
     * Running kmeans on a large dataset can be slow.  To speed this up we run kmeans on a
     * random sample of the data.  This parameter controls the size of the sample.  The total
     * number of vectors used to train the index is `sample_rate * num_partitions`.
     *
     * Increasing this value might improve the quality of the index but in most cases the
     * default should be sufficient.
     *
     */
    sampleRate?: number;
    /**
     * The number of neighbors to select for each vector in the HNSW graph.
     *
     * The default value is 20.
     *
     * This value controls the tradeoff between search speed and accuracy.
     * The higher the value the more accurate the search but the slower it will be.
     *
     */
    m?: number;
    /**
     * The number of candidates to evaluate during the construction of the HNSW graph.
     *
     * The default value is 300.
     *
     * This value controls the tradeoff between build speed and accuracy.
     * The higher the value the more accurate the build but the slower it will be.
     * 150 to 300 is the typical range. 100 is a minimum for good quality search
     * results. In most cases, there is no benefit to setting this higher than 500.
     * This value should be set to a value that is not less than `ef` in the search phase.
     *
     */
    efConstruction?: number;
}
/**
 * Options to create an `IVF_FLAT` index
 */
export interface IvfFlatOptions {
    /**
     * The number of IVF partitions to create.
     *
     * This value should generally scale with the number of rows in the dataset.
     * By default the number of partitions is the square root of the number of
     * rows.
     *
     * If this value is too large then the first part of the search (picking the
     * right partition) will be slow.  If this value is too small then the second
     * part of the search (searching within a partition) will be slow.
     */
    numPartitions?: number;
    /**
     * Distance type to use to build the index.
     *
     * Default value is "l2".
     *
     * This is used when training the index to calculate the IVF partitions
     * (vectors are grouped in partitions with similar vectors according to this
     * distance type).
     *
     * The distance type used to train an index MUST match the distance type used
     * to search the index.  Failure to do so will yield inaccurate results.
     *
     * The following distance types are available:
     *
     * "l2" - Euclidean distance. This is a very common distance metric that
     * accounts for both magnitude and direction when determining the distance
     * between vectors. l2 distance has a range of [0, ∞).
     *
     * "cosine" - Cosine distance.  Cosine distance is a distance metric
     * calculated from the cosine similarity between two vectors. Cosine
     * similarity is a measure of similarity between two non-zero vectors of an
     * inner product space. It is defined to equal the cosine of the angle
     * between them.  Unlike l2, the cosine distance is not affected by the
     * magnitude of the vectors.  Cosine distance has a range of [0, 2].
     *
     * Note: the cosine distance is undefined when one (or both) of the vectors
     * are all zeros (there is no direction).  These vectors are invalid and may
     * never be returned from a vector search.
     *
     * "dot" - Dot product. Dot distance is the dot product of two vectors. Dot
     * distance has a range of (-∞, ∞). If the vectors are normalized (i.e. their
     * l2 norm is 1), then dot distance is equivalent to the cosine distance.
     *
     * "hamming" - Hamming distance. Hamming distance is a distance metric
     * calculated from the number of bits that are different between two vectors.
     * Hamming distance has a range of [0, dimension]. Note that the hamming distance
     * is only valid for binary vectors.
     */
    distanceType?: "l2" | "cosine" | "dot" | "hamming";
    /**
     * Max iteration to train IVF kmeans.
     *
     * When training an IVF FLAT index we use kmeans to calculate the partitions.  This parameter
     * controls how many iterations of kmeans to run.
     *
     * Increasing this might improve the quality of the index but in most cases these extra
     * iterations have diminishing returns.
     *
     * The default value is 50.
     */
    maxIterations?: number;
    /**
     * The number of vectors, per partition, to sample when training IVF kmeans.
     *
     * When an IVF FLAT index is trained, we need to calculate partitions.  These are groups
     * of vectors that are similar to each other.  To do this we use an algorithm called kmeans.
     *
     * Running kmeans on a large dataset can be slow.  To speed this up we run kmeans on a
     * random sample of the data.  This parameter controls the size of the sample.  The total
     * number of vectors used to train the index is `sample_rate * num_partitions`.
     *
     * Increasing this value might improve the quality of the index but in most cases the
     * default should be sufficient.
     *
     * The default value is 256.
     */
    sampleRate?: number;
}
/**
 * Options to create a full text search index
 */
export interface FtsOptions {
    /**
     * Whether to build the index with positions.
     * True by default.
     * If set to false, the index will not store the positions of the tokens in the text,
     * which will make the index smaller and faster to build, but will not support phrase queries.
     */
    withPosition?: boolean;
    /**
     * The tokenizer to use when building the index.
     * The default is "simple".
     *
     * The following tokenizers are available:
     *
     * "simple" - Simple tokenizer. This tokenizer splits the text into tokens using whitespace and punctuation as a delimiter.
     *
     * "whitespace" - Whitespace tokenizer. This tokenizer splits the text into tokens using whitespace as a delimiter.
     *
     * "raw" - Raw tokenizer. This tokenizer does not split the text into tokens and indexes the entire text as a single token.
     */
    baseTokenizer?: "simple" | "whitespace" | "raw" | "ngram";
    /**
     * language for stemming and stop words
     * this is only used when `stem` or `remove_stop_words` is true
     */
    language?: string;
    /**
     * maximum token length
     * tokens longer than this length will be ignored
     */
    maxTokenLength?: number;
    /**
     * whether to lowercase tokens
     */
    lowercase?: boolean;
    /**
     * whether to stem tokens
     */
    stem?: boolean;
    /**
     * whether to remove stop words
     */
    removeStopWords?: boolean;
    /**
     * whether to remove punctuation
     */
    asciiFolding?: boolean;
    /**
     * ngram min length
     */
    ngramMinLength?: number;
    /**
     * ngram max length
     */
    ngramMaxLength?: number;
    /**
     * whether to only index the prefix of the token for ngram tokenizer
     */
    prefixOnly?: boolean;
}
export declare class Index {
    private readonly inner;
    private constructor();
    /**
     * Create an IvfPq index
     *
     * This index stores a compressed (quantized) copy of every vector.  These vectors
     * are grouped into partitions of similar vectors.  Each partition keeps track of
     * a centroid which is the average value of all vectors in the group.
     *
     * During a query the centroids are compared with the query vector to find the closest
     * partitions.  The compressed vectors in these partitions are then searched to find
     * the closest vectors.
     *
     * The compression scheme is called product quantization.  Each vector is divided into
     * subvectors and then each subvector is quantized into a small number of bits.  the
     * parameters `num_bits` and `num_subvectors` control this process, providing a tradeoff
     * between index size (and thus search speed) and index accuracy.
     *
     * The partitioning process is called IVF and the `num_partitions` parameter controls how
     * many groups to create.
     *
     * Note that training an IVF PQ index on a large dataset is a slow operation and
     * currently is also a memory intensive operation.
     */
    static ivfPq(options?: Partial<IvfPqOptions>): Index;
    /**
     * Create an IvfRq index
     *
     * IVF-RQ (RabitQ Quantization) compresses vectors using RabitQ quantization
     * and organizes them into IVF partitions.
     *
     * The compression scheme is called RabitQ quantization. Each dimension is quantized into a small number of bits.
     * The parameters `num_bits` and `num_partitions` control this process, providing a tradeoff
     * between index size (and thus search speed) and index accuracy.
     *
     * The partitioning process is called IVF and the `num_partitions` parameter controls how
     * many groups to create.
     *
     * Note that training an IVF RQ index on a large dataset is a slow operation and
     * currently is also a memory intensive operation.
     */
    static ivfRq(options?: Partial<IvfRqOptions>): Index;
    /**
     * Create an IvfFlat index
     *
     * This index groups vectors into partitions of similar vectors.  Each partition keeps track of
     * a centroid which is the average value of all vectors in the group.
     *
     * During a query the centroids are compared with the query vector to find the closest
     * partitions.  The vectors in these partitions are then searched to find
     * the closest vectors.
     *
     * The partitioning process is called IVF and the `num_partitions` parameter controls how
     * many groups to create.
     *
     * Note that training an IVF FLAT index on a large dataset is a slow operation and
     * currently is also a memory intensive operation.
     */
    static ivfFlat(options?: Partial<IvfFlatOptions>): Index;
    /**
     * Create a btree index
     *
     * A btree index is an index on a scalar columns.  The index stores a copy of the column
     * in sorted order.  A header entry is created for each block of rows (currently the
     * block size is fixed at 4096).  These header entries are stored in a separate
     * cacheable structure (a btree).  To search for data the header is used to determine
     * which blocks need to be read from disk.
     *
     * For example, a btree index in a table with 1Bi rows requires sizeof(Scalar) * 256Ki
     * bytes of memory and will generally need to read sizeof(Scalar) * 4096 bytes to find
     * the correct row ids.
     *
     * This index is good for scalar columns with mostly distinct values and does best when
     * the query is highly selective.
     *
     * The btree index does not currently have any parameters though parameters such as the
     * block size may be added in the future.
     */
    static btree(): Index;
    /**
     * Create a bitmap index.
     *
     * A `Bitmap` index stores a bitmap for each distinct value in the column for every row.
     *
     * This index works best for low-cardinality columns, where the number of unique values
     * is small (i.e., less than a few hundreds).
     */
    static bitmap(): Index;
    /**
     * Create a label list index.
     *
     * LabelList index is a scalar index that can be used on `List<T>` columns to
     * support queries with `array_contains_all` and `array_contains_any`
     * using an underlying bitmap index.
     */
    static labelList(): Index;
    /**
     * Create a full text search index
     *
     * A full text search index is an index on a string column, so that you can conduct full
     * text searches on the column.
     *
     * The results of a full text search are ordered by relevance measured by BM25.
     *
     * You can combine filters with full text search.
     */
    static fts(options?: Partial<FtsOptions>): Index;
    /**
     *
     * Create a hnswPq index
     *
     * HNSW-PQ stands for Hierarchical Navigable Small World - Product Quantization.
     * It is a variant of the HNSW algorithm that uses product quantization to compress
     * the vectors.
     *
     */
    static hnswPq(options?: Partial<HnswPqOptions>): Index;
    /**
     *
     * Create a hnswSq index
     *
     * HNSW-SQ stands for Hierarchical Navigable Small World - Scalar Quantization.
     * It is a variant of the HNSW algorithm that uses scalar quantization to compress
     * the vectors.
     *
     */
    static hnswSq(options?: Partial<HnswSqOptions>): Index;
}
export interface IndexOptions {
    /**
     * Advanced index configuration
     *
     * This option allows you to specify a specfic index to create and also
     * allows you to pass in configuration for training the index.
     *
     * See the static methods on Index for details on the various index types.
     *
     * If this is not supplied then column data type(s) and column statistics
     * will be used to determine the most useful kind of index to create.
     */
    config?: Index;
    /**
     * Whether to replace the existing index
     *
     * If this is false, and another index already exists on the same columns
     * and the same name, then an error will be returned.  This is true even if
     * that index is out of date.
     *
     * The default is true
     */
    replace?: boolean;
    /**
     * Timeout in seconds to wait for index creation to complete.
     *
     * If not specified, the method will return immediately after starting the index creation.
     */
    waitTimeoutSeconds?: number;
    /**
     * Optional custom name for the index.
     *
     * If not provided, a default name will be generated based on the column name.
     */
    name?: string;
    /**
     * Whether to train the index with existing data.
     *
     * If true (default), the index will be trained with existing data in the table.
     * If false, the index will be created empty and populated as new data is added.
     *
     * Note: This option is only supported for scalar indices. Vector indices always train.
     */
    train?: boolean;
}
