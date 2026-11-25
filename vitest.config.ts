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
                lines: 87,
                statements: 87,
                functions: 91,
                branches: 79,
            },
        },
    },
});
