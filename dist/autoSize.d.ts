export declare const GGUF_MAGIC = "GGUF";
type ScalarFormat = {
    size: number;
    read: (buffer: Buffer, offset: number) => number | boolean;
};
export declare const GGUF_SCALAR_FORMATS: Readonly<Record<number, ScalarFormat>>;
export declare const GGUF_STRING = 8;
export declare const GGUF_ARRAY = 9;
export declare const BATCH_TOKENS = 512;
export declare const FIXED_RESERVE_BYTES: number;
export declare const MAX_AUTO_CONTEXT = 32768;
export declare const MIN_AUTO_CONTEXT = 2048;
export declare const CONTEXT_STEP = 1024;
export type GgufValue = string | number | boolean | GgufValue[];
export declare function readGgufMetadata(modelPath: string): Record<string, GgufValue>;
export type ModelShape = {
    name: string;
    trained_context: number;
    file_bytes: number;
    bytes_per_token: number;
};
export declare function modelShape(modelPath: string): ModelShape;
export declare function freeGpuBytes(): Promise<number | null>;
export declare function availableRamBytes(): number | null;
export type SizeChoice = {
    context_size: number;
    max_tokens: number;
    background_max_tokens: number;
    explanation: string;
};
export declare function chooseSizes(shape: ModelShape, gpuFree: number | null, ramFree: number | null, gpuLayers: number, loadedContext?: number | null): SizeChoice;
export declare function autoSize(modelPath: string, gpuLayers: number, loadedContext?: number | null): Promise<SizeChoice>;
export {};
