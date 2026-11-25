// The names an application gives the harness: what it calls itself, and where its files live for the user and in a folder.
import { homedir } from 'node:os';
import { join } from 'node:path';

// ============================================================================
// Identity
// ============================================================================

export type AppIdentity = {
    // The name the model is told it runs as, such as "CODEX works in the folder ...".
    displayName: string;
    // The folder under ~/.config that holds the user's settings, agents, skills, commands and instructions.
    configFolderName: string;
    // The folder inside a project that holds that project's agents, skills and commands.
    projectFolderName: string;
    // The instructions file read from the config folder and from a project, before AGENTS.md.
    instructionsFileName: string;
};

export const DEFAULT_IDENTITY: Readonly<AppIdentity> = Object.freeze({
    displayName: 'SmartHarness',
    configFolderName: 'smartharness',
    projectFolderName: '.smartharness',
    instructionsFileName: 'SMARTHARNESS.md',
});

let current: Readonly<AppIdentity> = DEFAULT_IDENTITY;

// An application calls this once at startup, before any request runs.
export function setAppIdentity(identity: Partial<AppIdentity>): void {
    current = Object.freeze({ ...DEFAULT_IDENTITY, ...identity });
}

export function appIdentity(): Readonly<AppIdentity> {
    return current;
}

// ============================================================================
// Paths
// ============================================================================

export function configDirectory(): string {
    return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), current.configFolderName);
}

// A folder's instructions file; the first of these names found in the folder is read.
export function instructionsFileNames(): readonly string[] {
    return [current.instructionsFileName, 'AGENTS.md'];
}
