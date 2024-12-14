import { ToolAction } from '../tools';

export type ToolsetsInput = Record<string, Record<string, ToolAction<any, any, any, any>>>;

export type ToolsInput = Record<string, ToolAction<any, any, any, any>>;
