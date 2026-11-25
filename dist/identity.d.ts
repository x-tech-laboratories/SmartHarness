export type AppIdentity = {
    displayName: string;
    configFolderName: string;
    projectFolderName: string;
    instructionsFileName: string;
};
export declare const DEFAULT_IDENTITY: Readonly<AppIdentity>;
export declare function setAppIdentity(identity: Partial<AppIdentity>): void;
export declare function appIdentity(): Readonly<AppIdentity>;
export declare function configDirectory(): string;
export declare function instructionsFileNames(): readonly string[];
