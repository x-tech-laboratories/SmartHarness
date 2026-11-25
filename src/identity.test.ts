import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_IDENTITY, appIdentity, configDirectory, instructionsFileNames, setAppIdentity } from './identity.js';
import { initInstructions } from './commands.js';

// ============================================================================
// Identity
// ============================================================================

const testIdentity = { ...appIdentity() };

afterEach(() => {
    setAppIdentity(testIdentity);
});

describe('app identity', () => {
    it('uses its own names until an application sets them', () => {
        setAppIdentity({});

        expect(appIdentity()).toEqual(DEFAULT_IDENTITY);
        expect(instructionsFileNames()).toEqual(['SMARTHARNESS.md', 'AGENTS.md']);
        expect(configDirectory().endsWith(join('', 'smartharness'))).toBe(true);
        expect(initInstructions()).toContain('SMARTHARNESS.md');
    });

    it('takes the names an application gives, keeping defaults for the rest', () => {
        setAppIdentity({ configFolderName: 'helper', instructionsFileName: 'HELPER.md' });

        expect(appIdentity()).toMatchObject({ displayName: 'SmartHarness', configFolderName: 'helper', projectFolderName: '.smartharness' });
        expect(instructionsFileNames()[0]).toBe('HELPER.md');
        expect(configDirectory().endsWith('helper')).toBe(true);
    });
});
