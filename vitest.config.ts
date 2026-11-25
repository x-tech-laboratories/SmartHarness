import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts'],
            thresholds: {
                autoUpdate: (newThreshold: number) => Math.floor(newThreshold),
                lines: 86,
                statements: 86,
                functions: 91,
                branches: 78,
            },
        },
    },
});
