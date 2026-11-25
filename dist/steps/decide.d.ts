import { Decision, TaskNode, type TaskTreeRun } from '../taskTree.js';
export declare function approachesFor(run: TaskTreeRun, node: TaskNode): string[];
export declare function agentChoices(run: TaskTreeRun): string[];
export declare function decide(run: TaskTreeRun, node: TaskNode): Promise<Decision>;
