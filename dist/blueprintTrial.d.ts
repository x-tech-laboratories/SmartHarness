import { type BlueprintDraft } from './blueprints.js';
import { type ChatModel } from './model.js';
export declare const TASKS_PATH: string;
export type BlueprintTask = {
    id: string;
    request: string;
};
export type TrialRun = BlueprintDraft & {
    id: string;
    round: number;
    seconds: number;
    error: string | null;
};
export declare function loadBlueprintTasks(path: string): BlueprintTask[];
export declare function runTrial(llm: ChatModel, tasks: BlueprintTask[], rounds: number, useGrammar: boolean): Promise<TrialRun[]>;
export declare function formatRun(run: TrialRun): string;
export declare function summarizeTrial(runs: TrialRun[]): {
    runs: number;
    errors: number;
    firstPassed: number;
    finalPassed: number;
};
type ModelLoader = (modelPath: string, contextSize: number, gpuLayers: number) => Promise<ChatModel>;
export declare function main(argv?: string[], load?: ModelLoader): Promise<number>;
export {};
