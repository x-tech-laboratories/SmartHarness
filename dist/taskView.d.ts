export declare const TASK_STEP_PREFIX = "Task ";
export declare const TASK_STATE_WORDS: Record<string, string>;
export declare const TASK_PROMPT_CHARS = 80;
export type TaskViewNode = {
    id: string;
    prompt: string;
    status: string;
    deliverable?: string;
    approach?: string | null;
    depends_on?: string[] | null;
    note?: string | null;
    result?: string | null;
    result_shortened?: boolean | null;
};
export declare function taskTreeLines(nodes: TaskViewNode[]): string[];
export declare function taskDetailMarkdown(node: TaskViewNode): string;
