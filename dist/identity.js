// The names an application gives the harness: what it calls itself, and where its files live for the user and in a folder.
import { homedir } from 'node:os';
import { join } from 'node:path';
export const DEFAULT_IDENTITY = Object.freeze({
    displayName: 'SmartHarness',
    configFolderName: 'smartharness',
    projectFolderName: '.smartharness',
    instructionsFileName: 'SMARTHARNESS.md',
});
let current = DEFAULT_IDENTITY;
// An application calls this once at startup, before any request runs.
export function setAppIdentity(identity) {
    current = Object.freeze({ ...DEFAULT_IDENTITY, ...identity });
}
export function appIdentity() {
    return current;
}
// ============================================================================
// Paths
// ============================================================================
export function configDirectory() {
    return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), current.configFolderName);
}
// A folder's instructions file; the first of these names found in the folder is read.
export function instructionsFileNames() {
    return [current.instructionsFileName, 'AGENTS.md'];
}
