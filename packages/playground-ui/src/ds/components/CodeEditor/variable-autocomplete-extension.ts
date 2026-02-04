import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import type { JsonSchema } from '@/lib/json-schema';
import { flattenSchemaToVariables, type VariableCompletion } from './schema-to-variables';

/**
 * Creates a CodeMirror autocomplete extension for {{variable}} placeholders.
 * Triggers when the user types `{{` and shows suggestions derived from the schema.
 *
 * @param schema - JSON Schema to derive variable suggestions from
 * @returns CodeMirror Extension that provides variable autocomplete
 *
 * @example
 * ```tsx
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     user: { type: 'object', properties: { name: { type: 'string' } } }
 *   }
 * };
 *
 * <CodeMirror extensions={[createVariableAutocomplete(schema)]} />
 * // Typing "{{" will show: user, user.name
 * ```
 */
export function createVariableAutocomplete(schema: JsonSchema | undefined): Extension {
  const variables = flattenSchemaToVariables(schema);

  return autocompletion({
    override: [createVariableCompletionSource(variables)],
    defaultKeymap: true,
    closeOnBlur: true,
    icons: false,
  });
}

/**
 * Creates a completion source function for CodeMirror's autocompletion.
 */
function createVariableCompletionSource(
  variables: VariableCompletion[],
): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
    // Look for {{ pattern before cursor
    const beforeCursor = context.state.sliceDoc(Math.max(0, context.pos - 50), context.pos);
    const match = beforeCursor.match(/\{\{([a-zA-Z0-9_.\[\]]*)?$/);

    if (!match) {
      return null;
    }

    // The text after {{ that we're matching against
    const prefix = match[1] ?? '';
    const startPos = context.pos - prefix.length;

    // Filter variables based on what the user has typed
    const filteredVariables = prefix
      ? variables.filter(v => v.path.toLowerCase().startsWith(prefix.toLowerCase()))
      : variables;

    if (filteredVariables.length === 0) {
      return null;
    }

    const completions: Completion[] = filteredVariables.map(variable => ({
      label: variable.path,
      displayLabel: variable.path,
      detail: variable.type,
      info: variable.description,
      apply: (view, completion, from, to) => {
        // Check if }} already follows the cursor
        const afterCursor = view.state.sliceDoc(to, to + 2);
        const hasClosingBraces = afterCursor === '}}';

        const insertText = hasClosingBraces ? completion.label : `${completion.label}}}`;

        view.dispatch({
          changes: { from, to, insert: insertText },
          selection: { anchor: from + insertText.length },
        });
      },
    }));

    return {
      from: startPos,
      options: completions,
      validFor: /^[a-zA-Z0-9_.\[\]]*$/,
    };
  };
}
