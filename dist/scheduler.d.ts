import type { BackgroundOptions } from './background.js';
import type { Settings } from './settings.js';
export type BackgroundStep<Values extends Settings = Settings> = (settings: Values, options: BackgroundOptions) => Promise<boolean>;
export declare const JOB_CLASSES: readonly ['reactive', 'maintenance'];
export type JobClass = (typeof JOB_CLASSES)[number];
export type Job<Values extends Settings = Settings> = {
    name: string;
    jobClass: JobClass;
    step: BackgroundStep<Values>;
};
export declare function runNextJob<Values extends Settings>(jobs: readonly Job<Values>[], settings: Values, options: BackgroundOptions): Promise<string | null>;
