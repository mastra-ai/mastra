import { Decoration, DecorationSet, EditorView, MatchDecorator, ViewPlugin, ViewUpdate } from '@codemirror/view';

/**
 * Regex pattern to match variable placeholders like {{variableName}} or {{user.name}}
 * Matches: {{ followed by a valid identifier path (with optional dot notation), then }}
 */
export const VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}\}/g;

const variableDecoration = Decoration.mark({
  class: 'cm-variable-highlight',
});

const variableMatcher = new MatchDecorator({
  regexp: VARIABLE_PATTERN,
  decoration: () => variableDecoration,
});

const variableHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = variableMatcher.createDeco(view);
    }

    update(update: ViewUpdate) {
      this.decorations = variableMatcher.updateDeco(update, this.decorations);
    }
  },
  {
    decorations: v => v.decorations,
  },
);

/**
 * CodeMirror extension that highlights {{variableName}} patterns
 * with orange color and semibold weight
 */
export const variableHighlight = variableHighlightPlugin;
