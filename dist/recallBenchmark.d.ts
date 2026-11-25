#!/usr/bin/env node
import { type TextEmbedder } from './embeddings.js';
export declare const SEED_PATH: string;
export declare const QUESTIONS_PATH: string;
export declare const QUESTION_KINDS: readonly ['shared words', 'paraphrase', 'several facts', 'unrelated'];
export declare const RECALL_LIMIT = 5;
export declare class Question {
    readonly id: string;
    readonly kind: string;
    readonly query: string;
    readonly expected: string[];
    constructor(id: string, kind: string, query: string, expected: string[]);
}
export declare class Answer {
    readonly question: Question;
    readonly recalled: string[];
    readonly seconds: number;
    constructor(question: Question, recalled: string[], seconds: number);
    get found(): string[];
    get firstHitRank(): number | null;
    get passed(): boolean;
}
export declare class Score {
    readonly label: string;
    readonly answers: Answer[];
    constructor(label: string, answers?: Answer[]);
}
export declare function loadQuestions(questionsPath: string): Question[];
export declare function scoreRecall(seedPath: string, questions: Question[], embedder: TextEmbedder | null, label: string): Promise<Score>;
export type RecallSummary = Record<string, string | number> & {
    label: string;
};
export declare function summarize(score: Score): RecallSummary;
export declare function formatTable(summaries: RecallSummary[]): string;
export declare function formatFailures(score: Score): string;
export type RecallArguments = {
    seed: string;
    questions: string;
    settings: string;
    embedding_model_path: string | null;
    words_only: boolean;
    show_failures: boolean;
};
export declare function parseRecallArguments(argv: string[]): RecallArguments | {
    help: string;
} | {
    error: string;
};
export declare function main(argv?: string[]): Promise<number>;
