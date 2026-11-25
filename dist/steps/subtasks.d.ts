import { type Section } from '../contextBudget.js';
import { type SubtaskSpec, TaskNode, type Decision, type TaskTreeRun, type TaskUnit } from '../taskTree.js';
export declare function planSubtasks(run: TaskTreeRun, node: TaskNode, systemPrompt: string, minItems: number, extra: Section[]): Promise<SubtaskSpec[]>;
export declare function workSubtasks(run: TaskTreeRun, node: TaskNode, subtasks: SubtaskSpec[], fromSplit?: boolean): Promise<void>;
export declare function runSubtasks(run: TaskTreeRun, node: TaskNode, fromSplit: boolean): Promise<void>;
export declare function followDelegation(run: TaskTreeRun, node: TaskNode, decision: Decision): Promise<void>;
export declare function overflowReason(run: TaskTreeRun, node: TaskNode): string;
export declare function listingUnits(run: TaskTreeRun, node: TaskNode, approach: string, keepListedLeaves: boolean): TaskUnit[];
export declare function splitAlongListing(run: TaskTreeRun, node: TaskNode, units: TaskUnit[], reason: string): Promise<boolean>;
