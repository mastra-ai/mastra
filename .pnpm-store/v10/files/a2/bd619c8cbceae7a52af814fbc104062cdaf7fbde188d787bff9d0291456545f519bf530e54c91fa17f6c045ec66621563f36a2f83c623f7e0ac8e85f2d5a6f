"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.Index = void 0;
const native_1 = require("./native");
class Index {
    inner;
    constructor(inner) {
        this.inner = inner;
    }
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
    static ivfPq(options) {
        return new Index(native_1.Index.ivfPq(options?.distanceType, options?.numPartitions, options?.numSubVectors, options?.numBits, options?.maxIterations, options?.sampleRate));
    }
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
    static ivfRq(options) {
        return new Index(native_1.Index.ivfRq(options?.distanceType, options?.numPartitions, options?.numBits, options?.maxIterations, options?.sampleRate));
    }
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
    static ivfFlat(options) {
        return new Index(native_1.Index.ivfFlat(options?.distanceType, options?.numPartitions, options?.maxIterations, options?.sampleRate));
    }
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
    static btree() {
        return new Index(native_1.Index.btree());
    }
    /**
     * Create a bitmap index.
     *
     * A `Bitmap` index stores a bitmap for each distinct value in the column for every row.
     *
     * This index works best for low-cardinality columns, where the number of unique values
     * is small (i.e., less than a few hundreds).
     */
    static bitmap() {
        return new Index(native_1.Index.bitmap());
    }
    /**
     * Create a label list index.
     *
     * LabelList index is a scalar index that can be used on `List<T>` columns to
     * support queries with `array_contains_all` and `array_contains_any`
     * using an underlying bitmap index.
     */
    static labelList() {
        return new Index(native_1.Index.labelList());
    }
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
    static fts(options) {
        return new Index(native_1.Index.fts(options?.withPosition, options?.baseTokenizer, options?.language, options?.maxTokenLength, options?.lowercase, options?.stem, options?.removeStopWords, options?.asciiFolding, options?.ngramMinLength, options?.ngramMaxLength, options?.prefixOnly));
    }
    /**
     *
     * Create a hnswPq index
     *
     * HNSW-PQ stands for Hierarchical Navigable Small World - Product Quantization.
     * It is a variant of the HNSW algorithm that uses product quantization to compress
     * the vectors.
     *
     */
    static hnswPq(options) {
        return new Index(native_1.Index.hnswPq(options?.distanceType, options?.numPartitions, options?.numSubVectors, options?.maxIterations, options?.sampleRate, options?.m, options?.efConstruction));
    }
    /**
     *
     * Create a hnswSq index
     *
     * HNSW-SQ stands for Hierarchical Navigable Small World - Scalar Quantization.
     * It is a variant of the HNSW algorithm that uses scalar quantization to compress
     * the vectors.
     *
     */
    static hnswSq(options) {
        return new Index(native_1.Index.hnswSq(options?.distanceType, options?.numPartitions, options?.maxIterations, options?.sampleRate, options?.m, options?.efConstruction));
    }
}
exports.Index = Index;
