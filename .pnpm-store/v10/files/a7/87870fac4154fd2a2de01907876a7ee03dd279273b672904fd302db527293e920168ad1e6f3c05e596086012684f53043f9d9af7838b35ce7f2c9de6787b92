import { OptionsDimensions, OptionsFormat, OptionsNormalizationParameters, OptionsTensorFormat, OptionsTensorLayout, TensorFromGpuBufferOptions, TensorFromImageBitmapOptions, TensorFromImageDataOptions, TensorFromImageElementOptions, TensorFromMLTensorOptions, TensorFromTextureOptions, TensorFromUrlOptions } from './tensor-factory.js';
import { Tensor } from './tensor-impl.js';
import { Tensor as TensorInterface } from './tensor.js';
interface BufferToTensorOptions extends OptionsDimensions, OptionsTensorLayout, OptionsNormalizationParameters, OptionsFormat, OptionsTensorFormat {
}
/**
 * Create a new tensor object from image object
 *
 * @param buffer - Extracted image buffer data - assuming RGBA format
 * @param imageFormat - input image configuration - required configurations height, width, format
 * @param tensorFormat - output tensor configuration - Default is RGB format
 */
export declare const bufferToTensor: (buffer: Uint8ClampedArray | undefined, options: BufferToTensorOptions) => Tensor;
/**
 * implementation of Tensor.fromImage().
 */
export declare const tensorFromImage: (image: ImageData | HTMLImageElement | ImageBitmap | string, options?: TensorFromImageDataOptions | TensorFromImageElementOptions | TensorFromImageBitmapOptions | TensorFromUrlOptions) => Promise<Tensor>;
/**
 * implementation of Tensor.fromTexture().
 */
export declare const tensorFromTexture: <T extends "float32">(texture: TensorInterface.TextureType, options: TensorFromTextureOptions<T>) => Tensor;
/**
 * implementation of Tensor.fromGpuBuffer().
 */
export declare const tensorFromGpuBuffer: <T extends TensorInterface.GpuBufferDataTypes>(gpuBuffer: TensorInterface.GpuBufferType, options: TensorFromGpuBufferOptions<T>) => Tensor;
/**
 * implementation of Tensor.fromMLTensor().
 */
export declare const tensorFromMLTensor: <T extends TensorInterface.MLTensorDataTypes>(mlTensor: TensorInterface.MLTensorType, options: TensorFromMLTensorOptions<T>) => Tensor;
/**
 * implementation of Tensor.fromPinnedBuffer().
 */
export declare const tensorFromPinnedBuffer: <T extends TensorInterface.CpuPinnedDataTypes>(type: T, buffer: TensorInterface.DataTypeMap[T], dims?: readonly number[]) => Tensor;
export {};
//# sourceMappingURL=tensor-factory-impl.d.ts.map