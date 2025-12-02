"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tensor = void 0;
const tensor_conversion_impl_js_1 = require("./tensor-conversion-impl.js");
const tensor_factory_impl_js_1 = require("./tensor-factory-impl.js");
const tensor_impl_type_mapping_js_1 = require("./tensor-impl-type-mapping.js");
const tensor_utils_impl_js_1 = require("./tensor-utils-impl.js");
/**
 * the implementation of Tensor interface.
 *
 * @ignore
 */
class Tensor {
    /**
     * implementation.
     */
    constructor(arg0, arg1, arg2) {
        // perform one-time check for BigInt/Float16Array support
        (0, tensor_impl_type_mapping_js_1.checkTypedArray)();
        let type;
        let dims;
        if (typeof arg0 === 'object' && 'location' in arg0) {
            //
            // constructing tensor from specific location
            //
            this.dataLocation = arg0.location;
            type = arg0.type;
            dims = arg0.dims;
            switch (arg0.location) {
                case 'cpu-pinned': {
                    const expectedTypedArrayConstructor = tensor_impl_type_mapping_js_1.NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.get(type);
                    if (!expectedTypedArrayConstructor) {
                        throw new TypeError(`unsupported type "${type}" to create tensor from pinned buffer`);
                    }
                    if (!(arg0.data instanceof expectedTypedArrayConstructor)) {
                        throw new TypeError(`buffer should be of type ${expectedTypedArrayConstructor.name}`);
                    }
                    this.cpuData = arg0.data;
                    break;
                }
                case 'texture': {
                    if (type !== 'float32') {
                        throw new TypeError(`unsupported type "${type}" to create tensor from texture`);
                    }
                    this.gpuTextureData = arg0.texture;
                    this.downloader = arg0.download;
                    this.disposer = arg0.dispose;
                    break;
                }
                case 'gpu-buffer': {
                    if (type !== 'float32' &&
                        type !== 'float16' &&
                        type !== 'int32' &&
                        type !== 'int64' &&
                        type !== 'uint32' &&
                        type !== 'uint8' &&
                        type !== 'bool' &&
                        type !== 'uint4' &&
                        type !== 'int4') {
                        throw new TypeError(`unsupported type "${type}" to create tensor from gpu buffer`);
                    }
                    this.gpuBufferData = arg0.gpuBuffer;
                    this.downloader = arg0.download;
                    this.disposer = arg0.dispose;
                    break;
                }
                case 'ml-tensor': {
                    if (type !== 'float32' &&
                        type !== 'float16' &&
                        type !== 'int32' &&
                        type !== 'int64' &&
                        type !== 'uint32' &&
                        type !== 'uint64' &&
                        type !== 'int8' &&
                        type !== 'uint8' &&
                        type !== 'bool' &&
                        type !== 'uint4' &&
                        type !== 'int4') {
                        throw new TypeError(`unsupported type "${type}" to create tensor from MLTensor`);
                    }
                    this.mlTensorData = arg0.mlTensor;
                    this.downloader = arg0.download;
                    this.disposer = arg0.dispose;
                    break;
                }
                default:
                    throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`);
            }
        }
        else {
            //
            // constructing tensor of location 'cpu'
            //
            let data;
            let maybeDims;
            // check whether arg0 is type or data
            if (typeof arg0 === 'string') {
                //
                // Override: constructor(type, data, ...)
                //
                type = arg0;
                maybeDims = arg2;
                if (arg0 === 'string') {
                    // string tensor
                    if (!Array.isArray(arg1)) {
                        throw new TypeError("A string tensor's data must be a string array.");
                    }
                    // we don't check whether every element in the array is string; this is too slow. we assume it's correct and
                    // error will be populated at inference
                    data = arg1;
                }
                else {
                    // numeric tensor
                    const typedArrayConstructor = tensor_impl_type_mapping_js_1.NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.get(arg0);
                    if (typedArrayConstructor === undefined) {
                        throw new TypeError(`Unsupported tensor type: ${arg0}.`);
                    }
                    if (Array.isArray(arg1)) {
                        if ((arg0 === 'float16' && typedArrayConstructor === Uint16Array) || arg0 === 'uint4' || arg0 === 'int4') {
                            // - 'float16':
                            //   When no Float16Array polyfill is used, we cannot create 'float16' tensor from number array.
                            //
                            //   Throw error here because when user try to use number array as data,
                            //   e.g. new Tensor('float16', [1, 2, 3, 4], dims)), it will actually call
                            //   Uint16Array.from(arg1) which generates wrong data.
                            //
                            // - 'uint4' and 'int4':
                            //   Uint8Array.from(arg1) will generate wrong data for 'uint4' and 'int4' tensor.
                            //
                            throw new TypeError(`Creating a ${arg0} tensor from number array is not supported. Please use ${typedArrayConstructor.name} as data.`);
                        }
                        else if (arg0 === 'uint64' || arg0 === 'int64') {
                            // use 'as any' here because:
                            // 1. TypeScript's check on type of 'Array.isArray()' does not work with readonly arrays.
                            // see https://github.com/microsoft/TypeScript/issues/17002
                            // 2. TypeScript's check on union type of '(BigInt64ArrayConstructor|BigUint64ArrayConstructor).from()'
                            // does not accept parameter mapFn.
                            // 3. parameters of 'SupportedTypedArrayConstructors.from()' does not match the requirement of the union
                            // type.
                            // assume 'arg1' is of type "readonly number[]|readonly bigint[]" here.
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            data = typedArrayConstructor.from(arg1, BigInt);
                        }
                        else {
                            // assume 'arg1' is of type "readonly number[]" here.
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            data = typedArrayConstructor.from(arg1);
                        }
                    }
                    else if (arg1 instanceof typedArrayConstructor) {
                        data = arg1;
                    }
                    else if (arg1 instanceof Uint8ClampedArray) {
                        if (arg0 === 'uint8') {
                            data = Uint8Array.from(arg1);
                        }
                        else {
                            throw new TypeError(`A Uint8ClampedArray tensor's data must be type of uint8`);
                        }
                    }
                    else if (arg0 === 'float16' && arg1 instanceof Uint16Array && typedArrayConstructor !== Uint16Array) {
                        // when Float16Array is available and data is of type Uint16Array.
                        // We allow Uint16Array to be passed in as data for 'float16' tensor until Float16Array is generally
                        // supported in JavaScript environment.
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        data = new globalThis.Float16Array(arg1.buffer, arg1.byteOffset, arg1.length);
                    }
                    else {
                        throw new TypeError(`A ${type} tensor's data must be type of ${typedArrayConstructor}`);
                    }
                }
            }
            else {
                //
                // Override: constructor(data, ...)
                //
                maybeDims = arg1;
                if (Array.isArray(arg0)) {
                    // only boolean[] and string[] is supported
                    if (arg0.length === 0) {
                        throw new TypeError('Tensor type cannot be inferred from an empty array.');
                    }
                    const firstElementType = typeof arg0[0];
                    if (firstElementType === 'string') {
                        type = 'string';
                        data = arg0;
                    }
                    else if (firstElementType === 'boolean') {
                        type = 'bool';
                        // 'arg0' is of type 'boolean[]'. Uint8Array.from(boolean[]) actually works, but typescript thinks this is
                        // wrong type. We use 'as any' to make it happy.
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        data = Uint8Array.from(arg0);
                    }
                    else {
                        throw new TypeError(`Invalid element type of data array: ${firstElementType}.`);
                    }
                }
                else if (arg0 instanceof Uint8ClampedArray) {
                    type = 'uint8';
                    data = Uint8Array.from(arg0);
                }
                else {
                    // get tensor type from TypedArray
                    const mappedType = tensor_impl_type_mapping_js_1.NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.get(arg0.constructor);
                    if (mappedType === undefined) {
                        throw new TypeError(`Unsupported type for tensor data: ${arg0.constructor}.`);
                    }
                    type = mappedType;
                    data = arg0;
                }
            }
            // type and data is processed, now processing dims
            if (maybeDims === undefined) {
                // assume 1-D tensor if dims omitted
                maybeDims = [data.length];
            }
            else if (!Array.isArray(maybeDims)) {
                throw new TypeError("A tensor's dims must be a number array");
            }
            dims = maybeDims;
            this.cpuData = data;
            this.dataLocation = 'cpu';
        }
        // perform check on dims
        const size = (0, tensor_utils_impl_js_1.calculateSize)(dims);
        // if data is on CPU, check whether data length matches tensor size
        if (this.cpuData && size !== this.cpuData.length) {
            if ((type === 'uint4' || type === 'int4') && Math.ceil(size / 2) === this.cpuData.length) {
                // for (u)int4, the data length is half of the tensor size. So we check this special case when size is odd.
            }
            else {
                throw new Error(`Tensor's size(${size}) does not match data length(${this.cpuData.length}).`);
            }
        }
        this.type = type;
        this.dims = dims;
        this.size = size;
    }
    // #endregion
    // #region factory
    static async fromImage(image, options) {
        return (0, tensor_factory_impl_js_1.tensorFromImage)(image, options);
    }
    static fromTexture(texture, options) {
        return (0, tensor_factory_impl_js_1.tensorFromTexture)(texture, options);
    }
    static fromGpuBuffer(gpuBuffer, options) {
        return (0, tensor_factory_impl_js_1.tensorFromGpuBuffer)(gpuBuffer, options);
    }
    static fromMLTensor(mlTensor, options) {
        return (0, tensor_factory_impl_js_1.tensorFromMLTensor)(mlTensor, options);
    }
    static fromPinnedBuffer(type, buffer, dims) {
        return (0, tensor_factory_impl_js_1.tensorFromPinnedBuffer)(type, buffer, dims);
    }
    // #endregion
    // #region conversions
    toDataURL(options) {
        return (0, tensor_conversion_impl_js_1.tensorToDataURL)(this, options);
    }
    toImageData(options) {
        return (0, tensor_conversion_impl_js_1.tensorToImageData)(this, options);
    }
    // #endregion
    // #region properties
    get data() {
        this.ensureValid();
        if (!this.cpuData) {
            throw new Error('The data is not on CPU. Use `getData()` to download GPU data to CPU, ' +
                'or use `texture` or `gpuBuffer` property to access the GPU data directly.');
        }
        return this.cpuData;
    }
    get location() {
        return this.dataLocation;
    }
    get texture() {
        this.ensureValid();
        if (!this.gpuTextureData) {
            throw new Error('The data is not stored as a WebGL texture.');
        }
        return this.gpuTextureData;
    }
    get gpuBuffer() {
        this.ensureValid();
        if (!this.gpuBufferData) {
            throw new Error('The data is not stored as a WebGPU buffer.');
        }
        return this.gpuBufferData;
    }
    get mlTensor() {
        this.ensureValid();
        if (!this.mlTensorData) {
            throw new Error('The data is not stored as a WebNN MLTensor.');
        }
        return this.mlTensorData;
    }
    // #endregion
    // #region methods
    async getData(releaseData) {
        this.ensureValid();
        switch (this.dataLocation) {
            case 'cpu':
            case 'cpu-pinned':
                return this.data;
            case 'texture':
            case 'gpu-buffer':
            case 'ml-tensor': {
                if (!this.downloader) {
                    throw new Error('The current tensor is not created with a specified data downloader.');
                }
                if (this.isDownloading) {
                    throw new Error('The current tensor is being downloaded.');
                }
                try {
                    this.isDownloading = true;
                    const data = await this.downloader();
                    this.downloader = undefined;
                    this.dataLocation = 'cpu';
                    this.cpuData = data;
                    if (releaseData && this.disposer) {
                        this.disposer();
                        this.disposer = undefined;
                    }
                    return data;
                }
                finally {
                    this.isDownloading = false;
                }
            }
            default:
                throw new Error(`cannot get data from location: ${this.dataLocation}`);
        }
    }
    dispose() {
        if (this.isDownloading) {
            throw new Error('The current tensor is being downloaded.');
        }
        if (this.disposer) {
            this.disposer();
            this.disposer = undefined;
        }
        this.cpuData = undefined;
        this.gpuTextureData = undefined;
        this.gpuBufferData = undefined;
        this.mlTensorData = undefined;
        this.downloader = undefined;
        this.isDownloading = undefined;
        this.dataLocation = 'none';
    }
    // #endregion
    // #region tensor utilities
    ensureValid() {
        if (this.dataLocation === 'none') {
            throw new Error('The tensor is disposed.');
        }
    }
    reshape(dims) {
        this.ensureValid();
        if (this.downloader || this.disposer) {
            throw new Error('Cannot reshape a tensor that owns GPU resource.');
        }
        return (0, tensor_utils_impl_js_1.tensorReshape)(this, dims);
    }
}
exports.Tensor = Tensor;
//# sourceMappingURL=tensor-impl.js.map