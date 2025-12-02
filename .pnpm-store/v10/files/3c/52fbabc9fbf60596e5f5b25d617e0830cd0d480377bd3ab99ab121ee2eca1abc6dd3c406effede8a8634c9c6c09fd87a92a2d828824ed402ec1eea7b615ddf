import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { type ReactCodeMirrorProps } from '.';
export declare const ExternalChange: import("@codemirror/state").AnnotationType<boolean>;
export interface UseCodeMirror extends ReactCodeMirrorProps {
    container?: HTMLDivElement | null;
}
export declare function useCodeMirror(props: UseCodeMirror): {
    state: EditorState | undefined;
    setState: import("react").Dispatch<import("react").SetStateAction<EditorState | undefined>>;
    view: EditorView | undefined;
    setView: import("react").Dispatch<import("react").SetStateAction<EditorView | undefined>>;
    container: HTMLDivElement | null | undefined;
    setContainer: import("react").Dispatch<import("react").SetStateAction<HTMLDivElement | null | undefined>>;
};
