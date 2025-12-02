import { Extension } from '@codemirror/state';
import { type TagStyle } from '@codemirror/language';
import type { StyleSpec } from 'style-mod';
export interface CreateThemeOptions {
    /**
     * Theme inheritance. Determines which styles CodeMirror will apply by default.
     */
    theme: Theme;
    /**
     * Settings to customize the look of the editor, like background, gutter, selection and others.
     */
    settings: Settings;
    /** Syntax highlighting styles. */
    styles: TagStyle[];
}
type Theme = 'light' | 'dark';
export interface Settings {
    /** Editor background color. */
    background?: string;
    /** Editor background image. */
    backgroundImage?: string;
    /** Default text color. */
    foreground?: string;
    /** Caret color. */
    caret?: string;
    /** Selection background. */
    selection?: string;
    /** Selection match background. */
    selectionMatch?: string;
    /** Background of highlighted lines. */
    lineHighlight?: string;
    /** Gutter background. */
    gutterBackground?: string;
    /** Text color inside gutter. */
    gutterForeground?: string;
    /** Text active color inside gutter. */
    gutterActiveForeground?: string;
    /** Gutter right border color. */
    gutterBorder?: string;
    /** set editor font */
    fontFamily?: string;
    /** set editor font size */
    fontSize?: StyleSpec['fontSize'];
}
export declare const createTheme: ({ theme, settings, styles }: CreateThemeOptions) => Extension;
export default createTheme;
