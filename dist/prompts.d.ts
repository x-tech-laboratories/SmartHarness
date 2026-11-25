export declare const PROMPTS_DIRECTORY: string;
export declare const PROMPTS_OVERRIDE_VARIABLE = "CODEX_PROMPTS_DIR";
export declare const PROMPT_EXTENSION = ".txt";
export declare function promptPath(name: string, directory?: string): string;
export declare function readPrompt(name: string, directory?: string): string;
export declare function prompt(name: string, values?: Record<string, string | number>, directory?: string): string;
export declare function clearPromptCache(): void;
