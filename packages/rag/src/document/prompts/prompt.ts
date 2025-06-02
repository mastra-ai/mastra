import { PromptTemplate } from './base';

export type SummaryPrompt = PromptTemplate<['context']>;
export type KeywordExtractPrompt = PromptTemplate<['context', 'maxKeywords']>;
export type QuestionExtractPrompt = PromptTemplate<['context', 'numQuestions']>;
export type TitleExtractorPrompt = PromptTemplate<['context']>;
export type TitleCombinePrompt = PromptTemplate<['context']>;

export const defaultSummaryPrompt: SummaryPrompt = new PromptTemplate({
  templateVars: ['context'],
  template: `Write a summary of the following. Try to use only the information provided. Try to include as many key details as possible.


{context}


SUMMARY:"""
`,
});

export const defaultKeywordExtractPrompt: KeywordExtractPrompt = new PromptTemplate({
  templateVars: ['maxKeywords', 'context'],
  template: `
Some text is provided below. Given the text, extract up to {maxKeywords} keywords from the text. Avoid stopwords.
---------------------
{context}
---------------------
Provide keywords in the following comma-separated format: 'KEYWORDS: <keywords>'
`,
}).partialFormat({
  maxKeywords: '10',
});

export const defaultQuestionExtractPrompt = new PromptTemplate({
  templateVars: ['numQuestions', 'context'],
  template: `(
  "Given the contextual informations below, generate {numQuestions} questions this context can provides specific answers to which are unlikely to be found else where. Higher-level summaries of surrounding context may be provided as well. "
  "Try using these summaries to generate better questions that this context can answer."
  "---------------------"
  "{context}"
  "---------------------"
  "Provide questions in the following format: 'QUESTIONS: <questions>'"
)`,
}).partialFormat({
  numQuestions: '5',
});

export const defaultTitleExtractorPromptTemplate = new PromptTemplate({
  templateVars: ['context'],
  template: `{context}
Give a title that summarizes all of the unique entities, titles or themes found in the context. 
Title: `,
});

export const defaultTitleCombinePromptTemplate = new PromptTemplate({
  templateVars: ['context'],
  template: `{context} 
Based on the above candidate titles and contents, what is the comprehensive title for this document? 
Title: `,
});
