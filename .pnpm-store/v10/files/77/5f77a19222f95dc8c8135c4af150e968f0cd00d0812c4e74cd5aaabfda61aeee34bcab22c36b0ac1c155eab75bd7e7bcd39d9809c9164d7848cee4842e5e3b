import { SparseMatrixIndexCSX } from './sparse-matrix-index-csx.js';
import { SparseTensorIndexCOO } from './sparse-tensor-index-coo.js';
import { SparseTensorIndexCSF } from './sparse-tensor-index-csf.js';
export declare enum SparseTensorIndex {
    NONE = 0,
    SparseTensorIndexCOO = 1,
    SparseMatrixIndexCSX = 2,
    SparseTensorIndexCSF = 3
}
export declare function unionToSparseTensorIndex(type: SparseTensorIndex, accessor: (obj: SparseMatrixIndexCSX | SparseTensorIndexCOO | SparseTensorIndexCSF) => SparseMatrixIndexCSX | SparseTensorIndexCOO | SparseTensorIndexCSF | null): SparseMatrixIndexCSX | SparseTensorIndexCOO | SparseTensorIndexCSF | null;
export declare function unionListToSparseTensorIndex(type: SparseTensorIndex, accessor: (index: number, obj: SparseMatrixIndexCSX | SparseTensorIndexCOO | SparseTensorIndexCSF) => SparseMatrixIndexCSX | SparseTensorIndexCOO | SparseTensorIndexCSF | null, index: number): SparseMatrixIndexCSX | SparseTensorIndexCOO | SparseTensorIndexCSF | null;
