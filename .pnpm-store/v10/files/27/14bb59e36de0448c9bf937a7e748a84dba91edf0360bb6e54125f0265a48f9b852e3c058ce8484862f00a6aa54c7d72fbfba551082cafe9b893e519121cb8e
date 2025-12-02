// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Tensor } from './tensor-impl.js';
/**
 * calculate size from dims.
 *
 * @param dims the dims array. May be an illegal input.
 */
export const calculateSize = (dims) => {
    let size = 1;
    for (let i = 0; i < dims.length; i++) {
        const dim = dims[i];
        if (typeof dim !== 'number' || !Number.isSafeInteger(dim)) {
            throw new TypeError(`dims[${i}] must be an integer, got: ${dim}`);
        }
        if (dim < 0) {
            throw new RangeError(`dims[${i}] must be a non-negative integer, got: ${dim}`);
        }
        size *= dim;
    }
    return size;
};
/**
 * implementation of Tensor.reshape()
 */
export const tensorReshape = (tensor, dims) => {
    switch (tensor.location) {
        case 'cpu':
            return new Tensor(tensor.type, tensor.data, dims);
        case 'cpu-pinned':
            return new Tensor({
                location: 'cpu-pinned',
                data: tensor.data,
                type: tensor.type,
                dims,
            });
        case 'texture':
            return new Tensor({
                location: 'texture',
                texture: tensor.texture,
                type: tensor.type,
                dims,
            });
        case 'gpu-buffer':
            return new Tensor({
                location: 'gpu-buffer',
                gpuBuffer: tensor.gpuBuffer,
                type: tensor.type,
                dims,
            });
        case 'ml-tensor':
            return new Tensor({
                location: 'ml-tensor',
                mlTensor: tensor.mlTensor,
                type: tensor.type,
                dims,
            });
        default:
            throw new Error(`tensorReshape: tensor location ${tensor.location} is not supported`);
    }
};
//# sourceMappingURL=tensor-utils-impl.js.map