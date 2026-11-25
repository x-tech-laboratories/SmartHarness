export declare const CODE_BLOCK: RegExp;
export type ActionRecord = [name: string, arguments: Record<string, unknown>, result: string];
export declare function uncitedUrls(answer: string, evidence: string): string[];
export declare function unsupportedValues(answer: string, evidence: string): string[];
export declare function actionReportProblems(report: string, actionLog: ActionRecord[]): string[];
export declare function unbackedClaims(report: string, actionLog: ActionRecord[]): string[];
export declare function stripTextToolCalls(text: string): string;
export declare const HANDOVER_CHARS = 6000;
export declare function evidenceHandover(result: string, gathered: Array<[string, string]>): string;
export declare function textToolCallProblems(text: string): string[];
export declare function calculationProblems(text: string): string[];
export type ListedEntry = {
    name: string;
    folder: boolean;
};
export type Listing = {
    tool: string;
    path: string;
    entries: ListedEntry[];
};
export type GatheredListings = {
    listings: Listing[];
    limitReached: boolean;
    resultsCut: boolean;
};
export type Coverage = {
    items: number;
    missing: string[];
    unentered: string[];
};
export declare function asksForCoverage(request: string): boolean;
export declare function asksForSubfolders(request: string): boolean;
export declare function normalFolder(path: string, root?: string): string;
export declare function joinFolder(folder: string, name: string): string;
export declare function insideFolder(path: string, folder: string): boolean;
export declare function parseListing(tool: string, rawArguments: string, result: string, root?: string): Listing | null;
export declare function coverage(answer: string, listings: Listing[], subfolders: boolean): Coverage;
export declare function coverageProblems(found: Coverage | null): string[];
