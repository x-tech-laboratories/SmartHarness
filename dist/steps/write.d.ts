import { Decision, TaskNode, type TaskTreeRun } from '../taskTree.js';
export declare function workDirectly(run: TaskTreeRun, node: TaskNode, decision: Decision): Promise<void>;
