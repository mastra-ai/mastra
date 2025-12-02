export interface BaseWarning {
    code: string;
    message: string;
}
export interface MissingContextKeysWarning extends BaseWarning {
    code: 'missing_context_keys';
    keys: string[];
}
export type Warning = BaseWarning | MissingContextKeysWarning;
