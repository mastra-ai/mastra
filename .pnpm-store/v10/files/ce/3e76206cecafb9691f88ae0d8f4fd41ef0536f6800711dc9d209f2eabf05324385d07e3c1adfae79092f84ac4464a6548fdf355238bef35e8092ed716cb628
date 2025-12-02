import { Backend, InferenceSession, InferenceSessionHandler } from 'onnxruntime-common';
import { Binding } from './binding';
declare class OnnxruntimeBackend implements Backend {
    init(): Promise<void>;
    createInferenceSessionHandler(pathOrBuffer: string | Uint8Array, options?: InferenceSession.SessionOptions): Promise<InferenceSessionHandler>;
}
export declare const onnxruntimeBackend: OnnxruntimeBackend;
export declare const listSupportedBackends: () => Binding.SupportedBackend[];
export {};
