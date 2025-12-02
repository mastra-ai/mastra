import { TensorToDataUrlOptions, TensorToImageDataOptions } from './tensor-conversion.js';
import { CpuPinnedConstructorParameters, GpuBufferConstructorParameters, MLTensorConstructorParameters, TensorFromGpuBufferOptions, TensorFromImageBitmapOptions, TensorFromImageDataOptions, TensorFromImageElementOptions, TensorFromMLTensorOptions, TensorFromTextureOptions, TensorFromUrlOptions, TextureConstructorParameters } from './tensor-factory.js';
import { Tensor as TensorInterface } from './tensor.js';
type TensorType = TensorInterface.Type;
type TensorDataType = TensorInterface.DataType;
type TensorDataLocation = TensorInterface.DataLocation;
type TensorTextureType = TensorInterface.TextureType;
type TensorGpuBufferType = TensorInterface.GpuBufferType;
type TensorMLTensorType = TensorInterface.MLTensorType;
/**
 * the implementation of Tensor interface.
 *
 * @ignore
 */
export declare class Tensor implements TensorInterface {
    /**
     * Construct a new CPU tensor object from the given type, data and dims.
     */
    constructor(type: TensorType, data: TensorDataType | Uint8ClampedArray | readonly string[] | readonly number[] | readonly boolean[], dims?: readonly number[]);
    /**
     * Construct a new CPU tensor object from the given data and dims. Type is inferred from data.
     */
    constructor(data: TensorDataType | Uint8ClampedArray | readonly string[] | readonly boolean[], dims?: readonly number[]);
    /**
     * Construct a new tensor object from the pinned CPU data with the given type and dims.
     *
     * Tensor's location will be set to 'cpu-pinned'.
     *
     * @param params - Specify the parameters to construct the tensor.
     */
    constructor(params: CpuPinnedConstructorParameters);
    /**
     * Construct a new tensor object from the WebGL texture with the given type and dims.
     *
     * Tensor's location will be set to 'texture'.
     *
     * @param params - Specify the parameters to construct the tensor.
     */
    constructor(params: TextureConstructorParameters);
    /**
     * Construct a new tensor object from the WebGPU buffer with the given type and dims.
     *
     * Tensor's location will be set to 'gpu-buffer'.
     *
     * @param params - Specify the parameters to construct the tensor.
     */
    constructor(params: GpuBufferConstructorParameters);
    /**
     * Construct a new tensor object from the WebNN MLTensor with the given type and dims.
     *
     * Tensor's location will be set to 'ml-tensor'.
     *
     * @param params - Specify the parameters to construct the tensor.
     */
    constructor(params: MLTensorConstructorParameters);
    static fromImage(image: ImageData | HTMLImageElement | ImageBitmap | string, options?: TensorFromImageDataOptions | TensorFromImageElementOptions | TensorFromImageBitmapOptions | TensorFromUrlOptions): Promise<TensorInterface>;
    static fromTexture<T extends TensorInterface.TextureDataTypes>(texture: TensorTextureType, options: TensorFromTextureOptions<T>): TensorInterface;
    static fromGpuBuffer<T extends TensorInterface.GpuBufferDataTypes>(gpuBuffer: TensorGpuBufferType, options: TensorFromGpuBufferOptions<T>): TensorInterface;
    static fromMLTensor<T extends TensorInterface.MLTensorDataTypes>(mlTensor: TensorMLTensorType, options: TensorFromMLTensorOptions<T>): TensorInterface;
    static fromPinnedBuffer<T extends TensorInterface.CpuPinnedDataTypes>(type: T, buffer: TensorInterface.DataTypeMap[T], dims?: readonly number[]): Tensor;
    toDataURL(options?: TensorToDataUrlOptions): string;
    toImageData(options?: TensorToImageDataOptions): ImageData;
    readonly dims: readonly number[];
    readonly type: TensorType;
    readonly size: number;
    /**
     * stores the location of the data.
     */
    private dataLocation;
    /**
     * stores the data on CPU, if location is 'cpu' or 'cpu-pinned'. otherwise empty.
     */
    private cpuData?;
    /**
     * stores the underlying texture when location is 'texture'. otherwise empty.
     */
    private gpuTextureData?;
    /**
     * stores the underlying GPU buffer when location is 'gpu-buffer'. otherwise empty.
     */
    private gpuBufferData?;
    /**
     * stores the underlying WebNN MLTensor when location is 'ml-tensor'. otherwise empty.
     */
    private mlTensorData?;
    /**
     * stores an optional downloader function to download data from GPU to CPU.
     */
    private downloader;
    /**
     * a flag indicating whether the data is being downloaded from GPU to CPU.
     */
    private isDownloading?;
    /**
     * stores an optional disposer function to dispose the underlying data.
     */
    private disposer;
    get data(): TensorDataType;
    get location(): TensorDataLocation;
    get texture(): TensorTextureType;
    get gpuBuffer(): TensorGpuBufferType;
    get mlTensor(): TensorMLTensorType;
    getData(releaseData?: boolean): Promise<TensorDataType>;
    dispose(): void;
    private ensureValid;
    reshape(dims: readonly number[]): TensorInterface;
}
export {};
//# sourceMappingURL=tensor-impl.d.ts.map