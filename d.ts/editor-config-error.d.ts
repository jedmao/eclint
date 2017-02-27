declare class EditorConfigError extends Error {
    fileName: string;
    lineNumber: number;
    columnNumber: number;
    message: string;
    rule: string;
    source: string;
    name: string;
    constructor(message: string);
}
export = EditorConfigError;