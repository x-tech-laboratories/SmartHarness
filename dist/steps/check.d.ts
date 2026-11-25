import { type Coverage } from '../checks.js';
import { type Section } from '../contextBudget.js';
import { TaskNode, type TaskTreeRun } from '../taskTree.js';
export declare function checkAndRevise(run: TaskTreeRun, node: TaskNode, systemPrompt: string, result: string, evidence: Section[], results: Section[]): Promise<[string, string]>;
export declare function check(run: TaskTreeRun, node: TaskNode, result: string, evidence?: Section[]): Promise<string>;
export declare function taskCoverage(run: TaskTreeRun, node: TaskNode, result: string): Coverage | null;
