import type { EventContext, EventHandler } from './events.js';
export declare const MAX_ANSWER_CHARS = 4000;
export declare const MAX_TITLE_CHARS = 120;
export declare function field(payload: Record<string, unknown>, name: string): string;
export declare function clip(text: string, maximum: number): string;
export declare function runEventTree(prompt: string, trust: 'user' | 'external', { settings, options, runTree }: EventContext): Promise<string>;
export declare const userRequestHandler: EventHandler;
