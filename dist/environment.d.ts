import { type Settings } from './settings.js';
export declare const MAX_MOUNT_DEPTH = 2;
export declare const MAX_MOUNTS = 12;
export declare const MAX_SERVICES = 25;
export declare const SERVICES_PER_STATEMENT = 8;
export declare const COMMON_TOOLS: readonly ['git', 'python3', 'pip', 'uv', 'nix', 'node', 'npm', 'cargo', 'rustc', 'go', 'gcc', 'make', 'cmake', 'docker', 'podman', 'systemctl', 'flatpak', 'sqlite3', 'curl', 'rg', 'jq', 'ffmpeg'];
export declare const SERVICE_TIMEOUT_SECONDS = 5;
export type FindCommand = (command: string) => string | null;
export declare function findCommand(command: string): string | null;
export declare function probeLocations(filesystemRoot: string): string[];
export declare function probeSoftware(options?: {
    findCommand?: FindCommand;
}): Promise<string[]>;
export declare const lastProbedAt: Map<string, number>;
export declare function refreshEnvironment(settings: Pick<Settings, 'knowledge_db_path' | 'background_refresh_interval_hours' | 'filesystem_root'>, options?: {
    probeSoftware?: () => Promise<string[]>;
}): Promise<boolean>;
