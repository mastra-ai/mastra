# Installation
> `npm install --save @types/sentiment`

# Summary
This package contains type definitions for sentiment (https://github.com/thisandagain/sentiment).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/sentiment.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/sentiment/index.d.ts)
````ts
export = Sentiment;

declare class Sentiment {
    constructor(options?: Sentiment.SentimentOptions);

    analyze(
        phrase: string,
        options?: Sentiment.AnalysisOptions,
        callback?: (err: string, result: Sentiment.AnalysisResult) => void,
    ): Sentiment.AnalysisResult;
    registerLanguage(languageCode: string, language: Sentiment.LanguageModule): void;
}

declare namespace Sentiment {
    // No options supported currently
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface SentimentOptions {}

    interface LanguageModule {
        labels: {
            [token: string]: number;
        };
        scoringStrategy?: {
            apply: (tokens: string[], cursor: number, tokenScore: number) => number;
        } | undefined;
    }

    interface AnalysisOptions {
        extras?: {
            [token: string]: number;
        } | undefined;
        language?: string | undefined;
    }

    interface AnalysisResult {
        score: number;
        comparative: number;
        calculation: Array<{
            [token: string]: number;
        }>;
        tokens: string[];
        words: string[];
        positive: string[];
        negative: string[];
    }
}

````

### Additional Details
 * Last updated: Mon, 20 Nov 2023 23:36:24 GMT
 * Dependencies: none

# Credits
These definitions were written by [Isaac Ong](https://github.com/iojw).
