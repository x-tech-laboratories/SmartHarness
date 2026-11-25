export declare const QUERY_INSTRUCTION = "Instruct: Given a question, retrieve stored facts and topics that help answer it\nQuery:";
export declare const EMBEDDING_CONTEXT_SIZE = 2048;
export declare const MAX_TEXT_CHARS = 4000;
export declare const EMBEDDING_THREADS = 2;
export declare const QUERY_CACHE_SIZE = 64;
export interface TextEmbedder {
    readonly name: string;
    embedDocuments(texts: string[]): Promise<number[][]>;
    embedQuery(text: string): Promise<number[]>;
}
export declare class Embedder implements TextEmbedder {
    readonly modelPath: string;
    readonly name: string;
    private context;
    private queue;
    private readonly queryCache;
    constructor(modelPath: string);
    embedDocuments(texts: string[]): Promise<number[][]>;
    embedQuery(text: string): Promise<number[]>;
    close(): Promise<void>;
    private load;
    private inTurn;
}
export declare function getEmbedder(modelPath: string): Embedder | null;
export declare function normalize(vector: number[]): number[];
export declare function pack(vector: number[]): Uint8Array;
