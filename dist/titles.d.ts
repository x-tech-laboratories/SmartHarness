import { type BackgroundOptions } from './background.js';
import type { Settings } from './settings.js';
export declare const MAX_TITLE_WORDS = 5;
export declare const MAX_TITLE_CHARS = 40;
export declare function collapseSpaces(text: string): string;
export declare function isTitle(name: string): boolean;
export declare function grounded(name: string, texts: string[]): boolean;
export declare const CLAIM_WORDS: ReadonlySet<string>;
export declare function isAboutAClaim(name: string): boolean;
export declare function readTitle(reply: string): string | null;
export declare function fallbackTitle(prompt: string): string;
export declare const TITLE_SCHEMA: {
    type: string;
    properties: {
        reason: {
            type: string;
            maxLength: number;
        };
        name: {
            type: string;
            maxLength: number;
        };
    };
    required: string[];
};
export declare const TOPIC_TITLE_PROMPT: string;
export declare const CONVERSATION_TITLE_PROMPT: string;
export declare function titleConversations(settings: Settings, options?: BackgroundOptions): Promise<boolean>;
