import { type Section } from '../contextBudget.js';
import { Decision, TaskNode, type TaskTreeRun } from '../taskTree.js';
export declare function search(run: TaskTreeRun, node: TaskNode, queries: string[]): Promise<[Section[], boolean]>;
export declare function gather(run: TaskTreeRun, node: TaskNode, decision: Decision): Promise<Section[]>;
