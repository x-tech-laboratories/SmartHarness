// The tests run as an example application that keeps CODEX's names, so their fixtures read like a real install.
import { setAppIdentity } from '../src/identity.js';

setAppIdentity({ displayName: 'CODEX', configFolderName: 'codex', projectFolderName: '.codex', instructionsFileName: 'CODEX.md' });
