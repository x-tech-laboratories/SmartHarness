export declare const LOCK_PATH_VARIABLE = "CODEX_GPU_LOCK";
export declare const WAIT_TIMEOUT_SECONDS = 1800;
export declare function lockPath(): string | null;
export declare function inheritsLock(path: string): boolean;
export declare class GpuLock {
    private holders;
    private holder;
    private taking;
    acquire(onWait?: (message: string) => void, timeoutSeconds?: number): Promise<void>;
    release(): void;
    private take;
}
export declare const GPU_LOCK: GpuLock;
