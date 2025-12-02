import { DisplaySurveyOptions, Survey, SurveyType } from '../posthog-surveys-types';
export declare const SURVEY_LOGGER: Omit<import("@posthog/core").Logger, "createLogger"> & {
    _log: (level: "log" | "warn" | "error", ...args: any[]) => void;
    uninitializedWarning: (methodName: string) => void;
    createLogger: (prefix: string) => Omit<import("@posthog/core").Logger, "createLogger"> & /*elided*/ any;
};
export declare function isSurveyRunning(survey: Survey): boolean;
export declare function doesSurveyActivateByEvent(survey: Pick<Survey, 'conditions'>): boolean;
export declare function doesSurveyActivateByAction(survey: Pick<Survey, 'conditions'>): boolean;
export declare const SURVEY_SEEN_PREFIX = "seenSurvey_";
export declare const SURVEY_IN_PROGRESS_PREFIX = "inProgressSurvey_";
export declare const getSurveyInteractionProperty: (survey: Pick<Survey, "id" | "current_iteration">, action: "responded" | "dismissed") => string;
export declare const getSurveySeenKey: (survey: Pick<Survey, "id" | "current_iteration">) => string;
export declare const setSurveySeenOnLocalStorage: (survey: Pick<Survey, "id" | "current_iteration">) => void;
export declare const IN_APP_SURVEY_TYPES: SurveyType[];
export declare const DEFAULT_DISPLAY_SURVEY_OPTIONS: DisplaySurveyOptions;
