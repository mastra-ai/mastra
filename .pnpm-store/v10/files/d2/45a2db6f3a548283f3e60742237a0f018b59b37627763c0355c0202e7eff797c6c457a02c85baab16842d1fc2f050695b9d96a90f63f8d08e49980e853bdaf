# sentiment
### AFINN-based sentiment analysis for Node.js

[![CircleCI](https://circleci.com/gh/thisandagain/sentiment.svg?style=svg)](https://circleci.com/gh/thisandagain/sentiment)
[![Greenkeeper badge](https://badges.greenkeeper.io/thisandagain/sentiment.svg)](https://greenkeeper.io/)

Sentiment is a Node.js module that uses the [AFINN-165](http://www2.imm.dtu.dk/pubdb/views/publication_details.php?id=6010) wordlist and [Emoji Sentiment Ranking](http://journals.plos.org/plosone/article?id=10.1371/journal.pone.0144296) to perform [sentiment analysis](http://en.wikipedia.org/wiki/Sentiment_analysis) on arbitrary blocks of input text. Sentiment provides several things:

- Performance (see benchmarks below)
- The ability to append and overwrite word / value pairs from the AFINN wordlist
- The ability to easily add support for new languages
- The ability to easily define custom strategies for negation, emphasis, etc. on a per-language basis

## Table of contents

- [Installation](#installation)
- [Usage example](#usage-example)
- [Adding new languages](#adding-new-languages)
- [Adding and overwriting words](#adding-and-overwriting-words)
- [API Reference](#api-reference)
- [How it works](#how-it-works)
- [Benchmarks](#benchmarks)
- [Validation](#validation)
- [Testing](#testing)

## Installation
```bash
npm install sentiment
```

## Usage example
```js
var Sentiment = require('sentiment');
var sentiment = new Sentiment();
var result = sentiment.analyze('Cats are stupid.');
console.dir(result);    // Score: -2, Comparative: -0.666
```

## Adding new languages
You can add support for a new language by registering it using the `registerLanguage` method:

```js
var frLanguage = {
  labels: { 'stupide': -2 }
};
sentiment.registerLanguage('fr', frLanguage);

var result = sentiment.analyze('Le chat est stupide.', { language: 'fr' });
console.dir(result);    // Score: -2, Comparative: -0.5
```

You can also define custom scoring strategies to handle things like negation and emphasis on a per-language basis:
```js
var frLanguage = {
  labels: { 'stupide': -2 },
  scoringStrategy: {
    apply: function(tokens, cursor, tokenScore) {
      if (cursor > 0) {
        var prevtoken = tokens[cursor - 1];
        if (prevtoken === 'pas') {
          tokenScore = -tokenScore;
        }
      }
      return tokenScore;
    }
  }
};
sentiment.registerLanguage('fr', frLanguage);

var result = sentiment.analyze('Le chat n\'est pas stupide', { language: 'fr' });
console.dir(result);    // Score: 2, Comparative: 0.4
```

## Adding and overwriting words
You can append and/or overwrite values from AFINN by simply injecting key/value pairs into a sentiment method call:
```javascript
var options = {
  extras: {
    'cats': 5,
    'amazing': 2
  }
};
var result = sentiment.analyze('Cats are totally amazing!', options);
console.dir(result);    // Score: 7, Comparative: 1.75
```

## API Reference

#### `var sentiment = new Sentiment([options])`

| Argument | Type       | Required | Description                                                |
|----------|------------|----------|------------------------------------------------------------|
| options  | `object`   | `false`  | Configuration options _(no options supported currently)_   |

---

#### `sentiment.analyze(phrase, [options], [callback])`

| Argument | Type       | Required | Description             |
|----------|------------|----------|-------------------------|
| phrase   | `string`   | `true`   | Input phrase to analyze |
| options  | `object`   | `false`  | Options _(see below)_   |
| callback | `function` | `false`  | If specified, the result is returned using this callback function |


`options` object properties:

| Property | Type      | Default | Description                                                   |
|----------|-----------|---------|---------------------------------------------------------------|
| language | `string`  | `'en'`  | Language to use for sentiment analysis                        |
| extras   | `object`  | `{}`    | Set of labels and their associated values to add or overwrite |

---

#### `sentiment.registerLanguage(languageCode, language)`

| Argument     | Type     | Required | Description                                                         |
|--------------|----------|----------|---------------------------------------------------------------------|
| languageCode | `string` | `true`   | International two-digit code for the language to add                |
| language     | `object` | `true`   | Language module (see [Adding new languages](#adding-new-languages)) |

---

## How it works
### AFINN
AFINN is a list of words rated for valence with an integer between minus five (negative) and plus five (positive). Sentiment analysis is performed by cross-checking the string tokens (words, emojis) with the AFINN list and getting their respective scores. The comparative score is simply: `sum of each token / number of tokens`. So for example let's take the following:

`I love cats, but I am allergic to them.`

That string results in the following:
```javascript
{
    score: 1,
    comparative: 0.1111111111111111,
    calculation: [ { allergic: -2 }, { love: 3 } ],
    tokens: [
        'i',
        'love',
        'cats',
        'but',
        'i',
        'am',
        'allergic',
        'to',
        'them'
    ],
    words: [
        'allergic',
        'love'
    ],
    positive: [
        'love'
    ],
    negative: [
        'allergic'
    ]
}
```

* Returned Objects
    * __Score__: Score calculated by adding the sentiment values of recognized words.
    * __Comparative__: Comparative score of the input string.
    * __Calculation__: An array of words that have a negative or positive valence with their respective AFINN score.
    * __Token__: All the tokens like words or emojis found in the input string.
    * __Words__: List of words from input string that were found in AFINN list.
    * __Positive__: List of positive words in input string that were found in AFINN list.
    * __Negative__: List of negative words in input string that were found in AFINN list.

In this case, love has a value of 3, allergic has a value of -2, and the remaining tokens are neutral with a value of 0. Because the string has 9 tokens the resulting comparative score looks like:
`(3 + -2) / 9 = 0.111111111`

This approach leaves you with a mid-point of 0 and the upper and lower bounds are constrained to positive and negative 5 respectively (the same as each token! 😸). For example, let's imagine an incredibly "positive" string with 200 tokens and where each token has an AFINN score of 5. Our resulting comparative score would look like this:

```
(max positive score * number of tokens) / number of tokens
(5 * 200) / 200 = 5
```

### Tokenization
Tokenization works by splitting the lines of input string, then removing the special characters, and finally splitting it using spaces. This is used to get list of words in the string.

---

## Benchmarks
A primary motivation for designing `sentiment` was performance. As such, it includes a benchmark script within the test directory that compares it against the [Sentimental](https://github.com/thinkroth/Sentimental) module which provides a nearly equivalent interface and approach. Based on these benchmarks, running on a MacBook Pro with Node v6.9.1, `sentiment` is nearly twice as fast as alternative implementations:

```bash
sentiment (Latest) x 861,312 ops/sec ±0.87% (89 runs sampled)
Sentimental (1.0.1) x 451,066 ops/sec ±0.99% (92 runs sampled)
```

To run the benchmarks yourself:
```bash
npm run test:benchmark
```

---

## Validation
While the accuracy provided by AFINN is quite good considering it's computational performance (see above) there is always room for improvement. Therefore the `sentiment` module is open to accepting PRs which modify or amend the AFINN / Emoji datasets or implementation given that they improve accuracy and maintain similar performance characteristics. In order to establish this, we test the `sentiment` module against [three labelled datasets provided by UCI](https://archive.ics.uci.edu/ml/datasets/Sentiment+Labelled+Sentences).

To run the validation tests yourself:
```bash
npm run test:validate
```

### Rand Accuracy
```
Amazon:  0.726
IMDB:    0.765
Yelp:    0.696
```

---

## Testing
```bash
npm test
```
