'use client';

import { defaultMarkdownSerializer } from 'prosemirror-markdown';
import { DOMParser, Node } from 'prosemirror-model';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { renderToString } from 'react-dom/server';

import { Markdown } from '@/components/custom/markdown';

import { documentSchema } from './config';
import { createSuggestionWidget, UISuggestion } from './suggestions';

export const buildDocumentFromContent = (content: string) => {
  const parser = DOMParser.fromSchema(documentSchema);
  const stringFromMarkdown = renderToString(<Markdown>{content}</Markdown>);
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = stringFromMarkdown;
  return parser.parse(tempContainer);
};

export const buildContentFromDocument = (document: Node) => {
  return defaultMarkdownSerializer.serialize(document);
};

export const createDecorations = (
  suggestions: Array<UISuggestion>,
  view: EditorView
) => {
  const decorations: Array<Decoration> = [];

  suggestions.forEach((suggestion) => {
    decorations.push(
      Decoration.inline(
        suggestion.selectionStart,
        suggestion.selectionEnd,
        {
          class: 'suggestion-highlight',
        },
        {
          suggestionId: suggestion.id,
          type: 'highlight',
        }
      )
    );

    decorations.push(
      Decoration.widget(
        suggestion.selectionStart,
        (view) => {
          const { dom } = createSuggestionWidget(suggestion, view);
          return dom;
        },
        {
          suggestionId: suggestion.id,
          type: 'widget',
        }
      )
    );
  });

  return DecorationSet.create(view.state.doc, decorations);
};
