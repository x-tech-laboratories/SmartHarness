import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ============================================================================
// The harness stands alone
// ============================================================================

const SOURCE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+)'/g;

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : entry.name.endsWith('.ts') ? [join(directory, entry.name)] : [],
    );
}

describe('harness boundary', () => {
    it('imports nothing from outside its own source folder', () => {
        const escapes = sourceFiles(SOURCE_DIRECTORY).flatMap((file) =>
            [...readFileSync(file, 'utf-8').matchAll(RELATIVE_IMPORT)]
                .map((match) => resolve(dirname(file), match[1]))
                .filter((target) => relative(SOURCE_DIRECTORY, target).startsWith('..'))
                .map((target) => `${relative(SOURCE_DIRECTORY, file)} -> ${relative(SOURCE_DIRECTORY, target)}`),
        );

        expect(escapes).toEqual([]);
    });
});
