<div align="center">
  <img height="15px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
  <div><b>compromise</b></div>
  <img src="https://user-images.githubusercontent.com/399657/68222691-6597f180-ffb9-11e9-8a32-a7f38aa8bded.png"/>
  <div>modest natural language processing</div>
  <div><code>npm install compromise</code></div>
  <div align="center">
    <sub>
      by
      <a href="https://spencermounta.in/">Spencer Kelly</a> and
      <a href="https://github.com/spencermountain/compromise/graphs/contributors">
        many contributors
      </a>
    </sub>
  </div>
  <img height="22px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
</div>

<div align="center">
  <div>
    <a href="https://npmjs.org/package/compromise">
    <img src="https://img.shields.io/npm/v/compromise.svg?style=flat-square" />
  </a>
  <a href="https://codecov.io/gh/spencermountain/compromise">
    <img src="https://codecov.io/gh/spencermountain/compromise/branch/master/graph/badge.svg" />
  </a>
  <a href="https://bundlephobia.com/result?p=compromise">
    <img src="https://img.shields.io/bundlephobia/min/compromise"/>
    <!-- <img src="https://badge-size.herokuapp.com/spencermountain/compromise/master/builds/compromise.min.js" /> -->
  </a>
  </div>
  <div align="center">
    <sub>
     <a href="https://github.com/nlp-compromise/fr-compromise">french</a> • <a href="https://github.com/nlp-compromise/de-compromise">german</a>  • <a href="https://github.com/nlp-compromise/it-compromise">italian</a> • <a href="https://github.com/nlp-compromise/es-compromise">spanish</a>
    </sub>
  </div>
</div>

<!-- spacer -->
<img height="25px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<div align="left">
don't you find it strange,
<br/>
<ul>
  <img height="2px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
  <sub>how easy <b>text</b> is to <b>make</b>,</sub>
  <br/>
  <img height="2px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

&nbsp;<i>↬<sub>ᔐᖜ</sub><b>↬</b></i> &nbsp; <sub></sub>
and how hard it is to actually <b>parse</b> and <i>use</i>?

</ul>
</div>

<!-- spacer -->
<img height="45px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<div align="left">
  <img height="10px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>compromise <i><a href="https://observablehq.com/@spencermountain/compromise-justification">tries its best</a></i> to turn text into data.
  <br/>
  <img height="30px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>it makes limited and sensible decisions.
  <br/>
  <sub >
   <img height="15px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/> it's not as smart as you'd think.
  </sub>

<img height="45px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

 <!--
  it is
  <a href="https://docs.compromise.cool/compromise-filesize">small,
  <a href="https://docs.compromise.cool/compromise-performance">quick</a>,
  and often <i><a href="https://docs.compromise.cool/compromise-accuracy">good-enough</a></i>.
  <br/> -->
</div>
<img height="30px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

```js
import nlp from 'compromise'

let doc = nlp('she sells seashells by the seashore.')
doc.verbs().toPastTense()
doc.text()
// 'she sold seashells by the seashore.'
```

<!-- spacer -->
<img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<div align="left">
<i>don't be fancy, at all:</i>
</div>

```js
if (doc.has('simon says #Verb')) {
  return true
}
```

<!-- spacer -->
<img height="30px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
<div align="center">
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221814-05ed1680-ffb8-11e9-8b6b-c7528d163871.png"/>
</div>

<div align="left">
<i>grab parts of the text:</i>
</div>

```js
let doc = nlp(entireNovel)
doc.match('the #Adjective of times').text()
// "the blurst of times?"
```

<div align="right">
  <a href="https://docs.compromise.cool/compromise-match">match docs</a>
</div>
<div align="center">
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221837-0d142480-ffb8-11e9-9d30-90669f1b897c.png"/>
</div>
<!-- spacer -->
<img height="30px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<i>and get data:</i>

```js
import plg from 'compromise-speech'
nlp.extend(plg)

let doc = nlp('Milwaukee has certainly had its share of visitors..')
doc.compute('syllables')
doc.places().json()
/*
[{
  "text": "Milwaukee",
  "terms": [{
    "normal": "milwaukee",
    "syllables": ["mil", "wau", "kee"]
  }]
}]
*/
```

<div align="right">
  <a href="https://docs.compromise.cool/compromise-json">json docs</a>
</div>
<div align="center">
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221814-05ed1680-ffb8-11e9-8b6b-c7528d163871.png"/>
</div>

<!-- spacer -->
<img height="30px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

avoid the problems of brittle parsers:

```js
let doc = nlp("we're not gonna take it..")

doc.has('gonna') // true
doc.has('going to') // true (implicit)

// transform
doc.contractions().expand()
doc.text()
// 'we are not going to take it..'
```

<div align="right">
  <a href="https://docs.compromise.cool/compromise-contractions">contraction docs</a>
</div>
<div align="center">
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221814-05ed1680-ffb8-11e9-8b6b-c7528d163871.png"/>
</div>
<!-- spacer -->
<img height="30" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

and whip stuff around like it's data:

```js
let doc = nlp('ninety five thousand and fifty two')
doc.numbers().add(20)
doc.text()
// 'ninety five thousand and seventy two'
```

<div align="right">
  <a href="https://docs.compromise.cool/compromise-values">number docs</a>
</div>

<div align="center">
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221837-0d142480-ffb8-11e9-9d30-90669f1b897c.png"/>
</div>
<!-- spacer -->
<img height="30" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<sub>-because it actually is-</sub>

```js
let doc = nlp('the purple dinosaur')
doc.nouns().toPlural()
doc.text()
// 'the purple dinosaurs'
```

<div align="right">
  <a href="https://docs.compromise.cool/nouns">noun docs</a>
</div>
<div align="center">
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221731-e8b84800-ffb7-11e9-8453-6395e0e903fa.png"/>
</div>

<!-- spacer -->
<img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

Use it on the client-side:

```html
<script src="https://unpkg.com/compromise"></script>
<script>
  var doc = nlp('two bottles of beer')
  doc.numbers().minus(1)
  document.body.innerHTML = doc.text()
  // 'one bottle of beer'
</script>
```

or likewise:

```typescript
import nlp from 'compromise'

var doc = nlp('London is calling')
doc.verbs().toNegative()
// 'London is not calling'
```

<img height="75px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<!--
  bragging graphs
 -->
<!-- spacer -->
<img height="30" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

compromise is **~250kb** (minified):

<div align="center">
  <!-- filesize -->
  <a href="https://bundlephobia.com/result?p=compromise">
    <img width="600" src="https://user-images.githubusercontent.com/399657/68234819-14dfc300-ffd0-11e9-8b30-cb8545707b29.png"/>
  </a>
</div>

it's pretty fast. It can run on keypress:

<div align="center">
  <a href="https://observablehq.com/@spencermountain/compromise-performance">
    <img width="600" src="https://user-images.githubusercontent.com/399657/159795115-ed62440a-be41-424c-baa4-8dd15c48377d.png"/>
  </a>
</div>

it works mainly by <a href="https://observablehq.com/@spencermountain/verbs">conjugating all forms</a> of a basic word list.

The final lexicon is <a href="https://observablehq.com/@spencermountain/compromise-lexicon">~14,000 words</a>:

<div align="center">
  <img width="600" src="https://user-images.githubusercontent.com/399657/68234805-0d201e80-ffd0-11e9-8dc6-f7a600352555.png"/>
</div>

you can read more about how it works, [here](https://observablehq.com/@spencermountain/compromise-internals). it's weird.

<!-- spacer -->
<img height="75px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<!--
  one/two/three parts
 -->
<p align="left">
  <sub>okay -</sub>
  <h1>
    <code>compromise/one</code>
  </h1>
  <p align="center">A <code>tokenizer</code> of words, sentences, and punctuation.</p>
  <img height="15px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
<p>

```js
import nlp from 'compromise/one'

let doc = nlp("Wayne's World, party time")
let data = doc.json()
/* [{
  normal:"wayne's world party time",
    terms:[{ text: "Wayne's", normal: "wayne" },
      ...
      ]
  }]
*/
```

<div align="right">
  <a href="https://docs.compromise.cool/compromise-tokenization">tokenizer docs</a>
</div>

<b>compromise/one</b> splits your text up, wraps it in a handy API,

<ul>
  <sub>and does nothing else -</sub>
</ul>

<img height="25px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<b>/one</b> is quick - most sentences take a 10th of a millisecond.

It can do <b>~1mb</b> of text a second - or 10 wikipedia pages.

<i>Infinite jest</i> takes 3s.

<div align="right">
  You can also parallelize, or stream text to it with <a href="https://github.com/spencermountain/compromise/tree/master/plugins/speed">compromise-speed</a>.
</div>

<!-- spacer -->
<img height="60px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<!-- two -->
<p align="center">
  <h1 align="left">
   <code>compromise/two</code>
  </h1>
  <p align="center">A <code>part-of-speech</code> tagger, and grammar-interpreter.</p>
  <img height="15px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
  <p>

```js
import nlp from 'compromise/two'

let doc = nlp("Wayne's World, party time")
let str = doc.match('#Possessive #Noun').text()
// "Wayne's World"
```

<div align="right">
  <a href="https://docs.compromise.cool/compromise-tagger">tagger docs</a>
</div>

<p>
  <img height="25px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
</p>
<b>compromise/two</b> automatically calculates the very basic grammar of each word.

<sub>this is more useful than people sometimes realize.</sub>

Light grammar helps you write cleaner templates, and get closer to the information.

<!-- Part-of-speech tagging is profoundly-difficult task to get 100% on. It is also a profoundly easy task to get 85% on. -->

<img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

compromise has <b>83 tags</b>, arranged in <a href="https://observablehq.com/@spencermountain/compromise-tags">a handsome graph</a>.

<b>#FirstName</b> → <b>#Person</b> → <b>#ProperNoun</b> → <b>#Noun</b>

you can see the grammar of each word by running `doc.debug()`

you can see the reasoning for each tag with `nlp.verbose('tagger')`.

if you prefer <a href="https://www.ling.upenn.edu/courses/Fall_2003/ling001/penn_treebank_pos.html"><i>Penn tags</i></a>, you can derive them with:

```js
let doc = nlp('welcome thrillho')
doc.compute('penn')
doc.json()
```

<img height="60px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<!-- three -->
<p align="center">
  <h1 align="left">
   <code>compromise/three</code>
  </h1>
  <p align="center"><code>Phrase</code> and sentence tooling.</p>
  <img height="15px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
  <p>

```js
import nlp from 'compromise/three'

let doc = nlp("Wayne's World, party time")
let str = doc.people().normalize().text()
// "wayne"
```

<div align="right">
  <a href="https://docs.compromise.cool/compromise-selections">selection docs</a>
</div>

<b>compromise/three</b> is a set of tooling to <i>zoom into</i> and operate on parts of a text.

`.numbers()` grabs all the numbers in a document, for example - and extends it with new methods, like `.subtract()`.

When you have a phrase, or group of words, you can see additional metadata about it with `.json()`

```js
let doc = nlp('four out of five dentists')
console.log(doc.fractions().json())
/*[{
    text: 'four out of five',
    terms: [ [Object], [Object], [Object], [Object] ],
    fraction: { numerator: 4, denominator: 5, decimal: 0.8 }
  }
]*/
```

```js
let doc = nlp('$4.09CAD')
doc.money().json()
/*[{
    text: '$4.09CAD',
    terms: [ [Object] ],
    number: { prefix: '$', num: 4.09, suffix: 'cad'}
  }
]*/
```

<img height="80px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

## API

### Compromise/one

##### Output

- **[.text()](https://observablehq.com/@spencermountain/compromise-text)** - return the document as text
- **[.json()](https://observablehq.com/@spencermountain/compromise-json)** - return the document as data
- **[.debug()](https://observablehq.com/@spencermountain/compromise-output)** - pretty-print the interpreted document
- **[.out()](https://observablehq.com/@spencermountain/compromise-output)** - a named or custom output
- **[.html({})](https://observablehq.com/@spencermountain/compromise-html)** - output custom html tags for matches
- **[.wrap({})](https://observablehq.com/@spencermountain/compromise-output)** - produce custom output for document matches

##### Utils

- **[.found](https://observablehq.com/@spencermountain/compromise-utils)** _[getter]_ - is this document empty?
- **[.docs](https://observablehq.com/@spencermountain/compromise-utils)** _[getter]_ get term objects as json
- **[.length](https://observablehq.com/@spencermountain/compromise-utils)** _[getter]_ - count the # of characters in the document (string length)
- **[.isView](https://observablehq.com/@spencermountain/compromise-utils)** _[getter]_ - identify a compromise object
- **[.compute()](https://observablehq.com/@spencermountain/compromise-compute)** - run a named analysis on the document
- **[.clone()](https://observablehq.com/@spencermountain/compromise-utils)** - deep-copy the document, so that no references remain
- **[.termList()](https://observablehq.com/@spencermountain/compromise-accessors)** - return a flat list of all Term objects in match
- **[.cache({})](https://observablehq.com/@spencermountain/compromise-cache)** - freeze the current state of the document, for speed-purposes
- **[.uncache()](https://observablehq.com/@spencermountain/compromise-cache)** - un-freezes the current state of the document, so it may be transformed
- **[.freeze({})](https://observablehq.com/@spencermountain/compromise-freeze)** - prevent any tags from being removed, in these terms
- **[.unfreeze({})](https://observablehq.com/@spencermountain/compromise-freeze)** - allow tags to change again, as default

##### Accessors

- **[.all()](https://observablehq.com/@spencermountain/compromise-utils)** - return the whole original document ('zoom out')
- **[.terms()](https://observablehq.com/@spencermountain/compromise-selections)** - split-up results by each individual term
- **[.first(n)](https://observablehq.com/@spencermountain/compromise-accessors)** - use only the first result(s)
- **[.last(n)](https://observablehq.com/@spencermountain/compromise-accessors)** - use only the last result(s)
- **[.slice(n,n)](https://observablehq.com/@spencermountain/compromise-accessors)** - grab a subset of the results
- **[.eq(n)](https://observablehq.com/@spencermountain/compromise-accessors)** - use only the nth result
- **[.firstTerms()](https://observablehq.com/@spencermountain/compromise-accessors)** - get the first word in each match
- **[.lastTerms()](https://observablehq.com/@spencermountain/compromise-accessors)** - get the end word in each match
- **[.fullSentences()](https://observablehq.com/@spencermountain/compromise-accessors)** - get the whole sentence for each match
- **[.groups()](https://observablehq.com/@spencermountain/compromise-accessors)** - grab any named capture-groups from a match
- **[.wordCount()](https://observablehq.com/@spencermountain/compromise-utils)** - count the # of terms in the document
- **[.confidence()](https://observablehq.com/@spencermountain/compromise-utils)** - an average score for pos tag interpretations

##### Match

_(match methods use the [match-syntax](https://docs.compromise.cool/compromise-match-syntax).)_

- **[.match('')](https://observablehq.com/@spencermountain/compromise-match)** - return a new Doc, with this one as a parent
- **[.not('')](https://observablehq.com/@spencermountain/compromise-match)** - return all results except for this
- **[.matchOne('')](https://observablehq.com/@spencermountain/compromise-match)** - return only the first match
- **[.if('')](https://observablehq.com/@spencermountain/compromise-match)** - return each current phrase, only if it contains this match ('only')
- **[.ifNo('')](https://observablehq.com/@spencermountain/compromise-match)** - Filter-out any current phrases that have this match ('notIf')
- **[.has('')](https://observablehq.com/@spencermountain/compromise-match)** - Return a boolean if this match exists
- **[.before('')](https://observablehq.com/@spencermountain/compromise-match)** - return all terms before a match, in each phrase
- **[.after('')](https://observablehq.com/@spencermountain/compromise-match)** - return all terms after a match, in each phrase
- **[.union()](https://observablehq.com/@spencermountain/compromise-set)** - return combined matches without duplicates
- **[.intersection()](https://observablehq.com/@spencermountain/compromise-set)** - return only duplicate matches
- **[.complement()](https://observablehq.com/@spencermountain/compromise-set)** - get everything not in another match
- **[.settle()](https://observablehq.com/@spencermountain/compromise-set)** - remove overlaps from matches
- **[.growRight('')](https://observablehq.com/@spencermountain/compromise-match)** - add any matching terms immediately after each match
- **[.growLeft('')](https://observablehq.com/@spencermountain/compromise-match)** - add any matching terms immediately before each match
- **[.grow('')](https://observablehq.com/@spencermountain/compromise-match)** - add any matching terms before or after each match
- **[.sweep(net)](https://observablehq.com/@spencermountain/compromise-sweep)** - apply a series of match objects to the document
- **[.splitOn('')](https://observablehq.com/@spencermountain/compromise-split)** - return a Document with three parts for every match ('splitOn')
- **[.splitBefore('')](https://observablehq.com/@spencermountain/compromise-split)** - partition a phrase before each matching segment
- **[.splitAfter('')](https://observablehq.com/@spencermountain/compromise-split)** - partition a phrase after each matching segment
- **[.join()](https://observablehq.com/@spencermountain/compromise-split)** - merge any neighbouring terms in each match
- **[.joinIf(leftMatch, rightMatch)](https://observablehq.com/@spencermountain/compromise-split)** - merge any neighbouring terms under given conditions
- **[.lookup([])](https://observablehq.com/@spencermountain/compromise-match)** - quick find for an array of string matches
- **[.autoFill()](https://observablehq.com/@spencermountain/compromise-typeahead)** - create type-ahead assumptions on the document

##### Tag

- **[.tag('')](https://observablehq.com/@spencermountain/compromise-tagger)** - Give all terms the given tag
- **[.tagSafe('')](https://observablehq.com/@spencermountain/compromise-tagger)** - Only apply tag to terms if it is consistent with current tags
- **[.unTag('')](https://observablehq.com/@spencermountain/compromise-tagger)** - Remove this term from the given terms
- **[.canBe('')](https://observablehq.com/@spencermountain/compromise-tagger)** - return only the terms that can be this tag

##### Case

- **[.toLowerCase()](https://observablehq.com/@spencermountain/compromise-case)** - turn every letter of every term to lower-cse
- **[.toUpperCase()](https://observablehq.com/@spencermountain/compromise-case)** - turn every letter of every term to upper case
- **[.toTitleCase()](https://observablehq.com/@spencermountain/compromise-case)** - upper-case the first letter of each term
- **[.toCamelCase()](https://observablehq.com/@spencermountain/compromise-case)** - remove whitespace and title-case each term

##### Whitespace

- **[.pre('')](https://observablehq.com/@spencermountain/compromise-whitespace)** - add this punctuation or whitespace before each match
- **[.post('')](https://observablehq.com/@spencermountain/compromise-whitespace)** - add this punctuation or whitespace after each match
- **[.trim()](https://observablehq.com/@spencermountain/compromise-whitespace)** - remove start and end whitespace
- **[.hyphenate()](https://observablehq.com/@spencermountain/compromise-whitespace)** - connect words with hyphen, and remove whitespace
- **[.dehyphenate()](https://observablehq.com/@spencermountain/compromise-whitespace)** - remove hyphens between words, and set whitespace
- **[.toQuotations()](https://observablehq.com/@spencermountain/compromise-whitespace)** - add quotation marks around these matches
- **[.toParentheses()](https://observablehq.com/@spencermountain/compromise-whitespace)** - add brackets around these matches

##### Loops

- **[.map(fn)](https://observablehq.com/@spencermountain/compromise-loops)** - run each phrase through a function, and create a new document
- **[.forEach(fn)](https://observablehq.com/@spencermountain/compromise-loops)** - run a function on each phrase, as an individual document
- **[.filter(fn)](https://observablehq.com/@spencermountain/compromise-loops)** - return only the phrases that return true
- **[.find(fn)](https://observablehq.com/@spencermountain/compromise-loops)** - return a document with only the first phrase that matches
- **[.some(fn)](https://observablehq.com/@spencermountain/compromise-loops)** - return true or false if there is one matching phrase
- **[.random(fn)](https://observablehq.com/@spencermountain/compromise-loops)** - sample a subset of the results

##### Insert

- **[.replace(match, replace)](https://observablehq.com/@spencermountain/compromise-insert)** - search and replace match with new content
- **[.replaceWith(replace)](https://observablehq.com/@spencermountain/compromise-insert)** - substitute-in new text
- **[.remove()](https://observablehq.com/@spencermountain/compromise-insert)** - fully remove these terms from the document
- **[.insertBefore(str)](https://observablehq.com/@spencermountain/compromise-insert)** - add these new terms to the front of each match (prepend)
- **[.insertAfter(str)](https://observablehq.com/@spencermountain/compromise-insert)** - add these new terms to the end of each match (append)
- **[.concat()](https://observablehq.com/@spencermountain/compromise-insert)** - add these new things to the end
- **[.swap(fromLemma, toLemma)](https://observablehq.com/@spencermountain/compromise-root)** - smart replace of root-words,using proper conjugation

##### Transform

- **[.sort('method')](https://observablehq.com/@spencermountain/compromise-sorting)** - re-arrange the order of the matches (in place)
- **[.reverse()](https://observablehq.com/@spencermountain/compromise-sorting)** - reverse the order of the matches, but not the words
- **[.normalize({})](https://observablehq.com/@spencermountain/compromise-normalization)** - clean-up the text in various ways
- **[.unique()](https://observablehq.com/@spencermountain/compromise-sorting)** - remove any duplicate matches

##### Lib

_(these methods are on the main `nlp` object)_

- **[nlp.tokenize(str)](https://observablehq.com/@spencermountain/compromise-tokenization)** - parse text without running POS-tagging
- **[nlp.lazy(str, match)](https://observablehq.com/@spencermountain/compromise-performance)** - scan through a text with minimal analysis
- **[nlp.plugin({})](https://observablehq.com/@spencermountain/compromise-constructor-methods)** - mix in a compromise-plugin
- **[nlp.parseMatch(str)](https://observablehq.com/@spencermountain/compromise-constructor-methods)** - pre-parse any match statements into json
- **[nlp.world()](https://observablehq.com/@spencermountain/compromise-constructor-methods)** - grab or change library internals
- **[nlp.model()](https://observablehq.com/@spencermountain/compromise-constructor-methods)** - grab all current linguistic data
- **[nlp.methods()](https://observablehq.com/@spencermountain/compromise-constructor-methods)** - grab or change internal methods
- **[nlp.hooks()](https://observablehq.com/@spencermountain/compromise-constructor-methods)** - see which compute methods run automatically
- **[nlp.verbose(mode)](https://observablehq.com/@spencermountain/compromise-constructor-methods)** - log our decision-making for debugging
- **[nlp.version](https://observablehq.com/@spencermountain/compromise-constructor-methods)** - current semver version of the library

- **[nlp.addWords(obj, isFrozen?)](https://observablehq.com/@spencermountain/compromise-plugin)** - add new words to the lexicon
- **[nlp.addTags(obj)](https://observablehq.com/@spencermountain/compromise-plugin)** - add new tags to the tagSet
- **[nlp.typeahead(arr)](https://observablehq.com/@spencermountain/compromise-typeahead)** - add words to the auto-fill dictionary
- **[nlp.buildTrie(arr)](https://observablehq.com/@spencermountain/compromise-lookup)** - compile a list of words into a fast lookup form
- **[nlp.buildNet(arr)](https://observablehq.com/@spencermountain/compromise-sweep)** - compile a list of matches into a fast match form

<!-- spacer -->
<img height="30px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

### compromise/two:

##### Contractions

- **[.contractions()](https://observablehq.com/@spencermountain/compromise-contractions)** - things like "didn't"
- **[.contractions().expand()](https://observablehq.com/@spencermountain/compromise-contractions)** - things like "didn't"
- **[.contract()](https://observablehq.com/@spencermountain/compromise-contractions)** - things like "didn't"

<!-- spacer -->
<img height="30px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

### compromise/three:

##### Nouns

- **[.nouns()](https://observablehq.com/@spencermountain/nouns)** - return any subsequent terms tagged as a Noun
  - **[.nouns().json()](https://observablehq.com/@spencermountain/nouns)** - overloaded output with noun metadata
  - **[.nouns().parse()](https://observablehq.com/@spencermountain/nouns)** - get tokenized noun-phrase
  - **[.nouns().isPlural()](https://observablehq.com/@spencermountain/nouns)** - return only plural nouns
  - **[.nouns().isSingular()](https://observablehq.com/@spencermountain/nouns)** - return only singular nouns
  - **[.nouns().toPlural()](https://observablehq.com/@spencermountain/nouns)** - `'football captain' → 'football captains'`
  - **[.nouns().toSingular()](https://observablehq.com/@spencermountain/nouns)** - `'turnovers' → 'turnover'`
  - **[.nouns().adjectives()](https://observablehq.com/@spencermountain/nouns)** - get any adjectives describing this noun

##### Verbs

- **[.verbs()](https://observablehq.com/@spencermountain/verbs)** - return any subsequent terms tagged as a Verb
  - **[.verbs().json()](https://observablehq.com/@spencermountain/verbs)** - overloaded output with verb metadata
  - **[.verbs().parse()](https://observablehq.com/@spencermountain/verbs)** - get tokenized verb-phrase
  - **[.verbs().subjects()](https://observablehq.com/@spencermountain/verbs)** - what is doing the verb action
  - **[.verbs().adverbs()](https://observablehq.com/@spencermountain/verbs)** - return the adverbs describing this verb.
  - **[.verbs().isSingular()](https://observablehq.com/@spencermountain/verbs)** - return singular verbs like 'spencer walks'
  - **[.verbs().isPlural()](https://observablehq.com/@spencermountain/verbs)** - return plural verbs like 'we walk'
  - **[.verbs().isImperative()](https://observablehq.com/@spencermountain/verbs)** - only instruction verbs like 'eat it!'
  - **[.verbs().toPastTense()](https://observablehq.com/@spencermountain/verbs)** - `'will go' → 'went'`
  - **[.verbs().toPresentTense()](https://observablehq.com/@spencermountain/verbs)** - `'walked' → 'walks'`
  - **[.verbs().toFutureTense()](https://observablehq.com/@spencermountain/verbs)** - `'walked' → 'will walk'`
  - **[.verbs().toInfinitive()](https://observablehq.com/@spencermountain/verbs)** - `'walks' → 'walk'`
  - **[.verbs().toGerund()](https://observablehq.com/@spencermountain/verbs)** - `'walks' → 'walking'`
  - **[.verbs().toPastParticiple()](https://observablehq.com/@spencermountain/verbs)** - `'drive' → 'had driven'`
  - **[.verbs().conjugate()](https://observablehq.com/@spencermountain/verbs)** - return all conjugations of these verbs
  - **[.verbs().isNegative()](https://observablehq.com/@spencermountain/verbs)** - return verbs with 'not', 'never' or 'no'
  - **[.verbs().isPositive()](https://observablehq.com/@spencermountain/verbs)** - only verbs without 'not', 'never' or 'no'
  - **[.verbs().toNegative()](https://observablehq.com/@spencermountain/verbs)** - `'went' → 'did not go'`
  - **[.verbs().toPositive()](https://observablehq.com/@spencermountain/verbs)** - `"didn't study" → 'studied'`

##### Numbers

- **[.numbers()](https://observablehq.com/@spencermountain/compromise-values)** - grab all written and numeric values
  - **[.numbers().parse()](https://observablehq.com/@spencermountain/compromise-values)** - get tokenized number phrase
  - **[.numbers().get()](https://observablehq.com/@spencermountain/compromise-values)** - get a simple javascript number
  - **[.numbers().json()](https://observablehq.com/@spencermountain/compromise-values)** - overloaded output with number metadata
  - **[.numbers().toNumber()](https://observablehq.com/@spencermountain/compromise-values)** - convert 'five' to `5`
  - **[.numbers().toLocaleString()](https://observablehq.com/@spencermountain/compromise-values)** - add commas, or nicer formatting for numbers
  - **[.numbers().toText()](https://observablehq.com/@spencermountain/compromise-values)** - convert '5' to `five`
  - **[.numbers().toOrdinal()](https://observablehq.com/@spencermountain/compromise-values)** - convert 'five' to `fifth` or `5th`
  - **[.numbers().toCardinal()](https://observablehq.com/@spencermountain/compromise-values)** - convert 'fifth' to `five` or `5`
  - **[.numbers().isOrdinal()](https://observablehq.com/@spencermountain/compromise-values)** - return only ordinal numbers
  - **[.numbers().isCardinal()](https://observablehq.com/@spencermountain/compromise-values)** - return only cardinal numbers
  - **[.numbers().isEqual(n)](https://observablehq.com/@spencermountain/compromise-values)** - return numbers with this value
  - **[.numbers().greaterThan(min)](https://observablehq.com/@spencermountain/compromise-values)** - return numbers bigger than n
  - **[.numbers().lessThan(max)](https://observablehq.com/@spencermountain/compromise-values)** - return numbers smaller than n
  - **[.numbers().between(min, max)](https://observablehq.com/@spencermountain/compromise-values)** - return numbers between min and max
  - **[.numbers().isUnit(unit)](https://observablehq.com/@spencermountain/compromise-values)** - return only numbers in the given unit, like 'km'
  - **[.numbers().set(n)](https://observablehq.com/@spencermountain/compromise-values)** - set number to n
  - **[.numbers().add(n)](https://observablehq.com/@spencermountain/compromise-values)** - increase number by n
  - **[.numbers().subtract(n)](https://observablehq.com/@spencermountain/compromise-values)** - decrease number by n
  - **[.numbers().increment()](https://observablehq.com/@spencermountain/compromise-values)** - increase number by 1
  - **[.numbers().decrement()](https://observablehq.com/@spencermountain/compromise-values)** - decrease number by 1
- **[.money()](https://observablehq.com/@spencermountain/compromise-values)** - things like `'$2.50'`
  - **[.money().get()](https://observablehq.com/@spencermountain/compromise-values)** - retrieve the parsed amount(s) of money
  - **[.money().json()](https://observablehq.com/@spencermountain/compromise-values)** - currency + number info
  - **[.money().currency()](https://observablehq.com/@spencermountain/compromise-values)** - which currency the money is in
- **[.fractions()](https://observablehq.com/@spencermountain/compromise-values)** - like '2/3rds' or 'one out of five'
  - **[.fractions().parse()](https://observablehq.com/@spencermountain/compromise-values)** - get tokenized fraction
  - **[.fractions().get()](https://observablehq.com/@spencermountain/compromise-values)** - simple numerator, denominator data
  - **[.fractions().json()](https://observablehq.com/@spencermountain/compromise-values)** - json method overloaded with fractions data
  - **[.fractions().toDecimal()](https://observablehq.com/@spencermountain/compromise-values)** - '2/3' -> '0.66'
  - **[.fractions().normalize()](https://observablehq.com/@spencermountain/compromise-values)** - 'four out of 10' -> '4/10'
  - **[.fractions().toText()](https://observablehq.com/@spencermountain/compromise-values)** - '4/10' -> 'four tenths'
  - **[.fractions().toPercentage()](https://observablehq.com/@spencermountain/compromise-values)** - '4/10' -> '40%'
- **[.percentages()](https://observablehq.com/@spencermountain/compromise-values)** - like '2.5%'
  - **[.percentages().get()](https://observablehq.com/@spencermountain/compromise-values)** - return the percentage number / 100
  - **[.percentages().json()](https://observablehq.com/@spencermountain/compromise-values)** - json overloaded with percentage information
  - **[.percentages().toFraction()](https://observablehq.com/@spencermountain/compromise-values)** - '80%' -> '8/10'

##### Sentences

- **[.sentences()](https://observablehq.com/@spencermountain/compromise-sentences)** - return a sentence class with additional methods
  - **[.sentences().json()](https://observablehq.com/@spencermountain/compromise-sentences)** - overloaded output with sentence metadata
  <!-- - **[.sentences().subjects()](https://observablehq.com/@spencermountain/compromise-sentences)** - return the main noun of each sentence -->
  - **[.sentences().toPastTense()](https://observablehq.com/@spencermountain/compromise-sentences)** - `he walks` -> `he walked`
  - **[.sentences().toPresentTense()](https://observablehq.com/@spencermountain/compromise-sentences)** - `he walked` -> `he walks`
  - **[.sentences().toFutureTense()](https://observablehq.com/@spencermountain/compromise-sentences)** -- `he walks` -> `he will walk`
  - **[.sentences().toInfinitive()](https://observablehq.com/@spencermountain/compromise-sentences)** -- verb root-form `he walks` -> `he walk`
  - **[.sentences().toNegative()](https://observablehq.com/@spencermountain/compromise-sentences)** - - `he walks` -> `he didn't walk`
  - **[.sentences().isQuestion()](https://observablehq.com/@spencermountain/compromise-sentences)** - return questions with a `?`
  - **[.sentences().isExclamation()](https://observablehq.com/@spencermountain/compromise-sentences)** - return sentences with a `!`
  - **[.sentences().isStatement()](https://observablehq.com/@spencermountain/compromise-sentences)** - return sentences without `?` or `!`

##### Adjectives

- **[.adjectives()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'quick'`
  - **[.adjectives().json()](https://observablehq.com/@spencermountain/compromise-selections)** - get adjective metadata
  - **[.adjectives().conjugate()](https://observablehq.com/@spencermountain/compromise-selections)** - return all inflections of these adjectives
  - **[.adjectives().adverbs()](https://observablehq.com/@spencermountain/compromise-selections)** - get adverbs describing this adjective
  - **[.adjectives().toComparative()](https://observablehq.com/@spencermountain/compromise-selections)** - 'quick' -> 'quicker'
  - **[.adjectives().toSuperlative()](https://observablehq.com/@spencermountain/compromise-selections)** - 'quick' -> 'quickest'
  - **[.adjectives().toAdverb()](https://observablehq.com/@spencermountain/compromise-selections)** - 'quick' -> 'quickly'
  - **[.adjectives().toNoun()](https://observablehq.com/@spencermountain/compromise-selections)** - 'quick' -> 'quickness'

##### Misc selections

- **[.clauses()](https://observablehq.com/@spencermountain/compromise-selections)** - split-up sentences into multi-term phrases
- **[.chunks()](https://observablehq.com/@spencermountain/compromise-selections)** - split-up sentences noun-phrases and verb-phrases
- **[.hyphenated()](https://observablehq.com/@spencermountain/compromise-selections)** - all terms connected with a hyphen or dash like `'wash-out'`
- **[.phoneNumbers()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'(939) 555-0113'`
- **[.hashTags()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'#nlp'`
- **[.emails()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'hi@compromise.cool'`
- **[.emoticons()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `:)`
- **[.emojis()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `💋`
- **[.atMentions()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'@nlp_compromise'`
- **[.urls()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'compromise.cool'`
- **[.pronouns()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'he'`
- **[.conjunctions()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'but'`
- **[.prepositions()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'of'`
- **[.abbreviations()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'Mrs.'`
- **[.people()](https://observablehq.com/@spencermountain/topics-named-entity-recognition)** - names like 'John F. Kennedy'
  - **[.people().json()](https://observablehq.com/@spencermountain/topics-named-entity-recognition)** - get person-name metadata
  - **[.people().parse()](https://observablehq.com/@spencermountain/topics-named-entity-recognition)** - get person-name interpretation
- **[.places()](https://observablehq.com/@spencermountain/topics-named-entity-recognition)** - like 'Paris, France'
- **[.organizations()](https://observablehq.com/@spencermountain/topics-named-entity-recognition)** - like 'Google, Inc'
- **[.topics()](https://observablehq.com/@spencermountain/topics-named-entity-recognition)** - `people()` + `places()` + `organizations()`
- **[.adverbs()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'quickly'`
  - **[.adverbs().json()](https://observablehq.com/@spencermountain/compromise-selections)** - get adverb metadata
- **[.acronyms()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `'FBI'`
  - **[.acronyms().strip()](https://observablehq.com/@spencermountain/compromise-selections)** - remove periods from acronyms
  - **[.acronyms().addPeriods()](https://observablehq.com/@spencermountain/compromise-selections)** - add periods to acronyms
- **[.parentheses()](https://observablehq.com/@spencermountain/compromise-selections)** - return anything inside (parentheses)
  - **[.parentheses().strip()](https://observablehq.com/@spencermountain/compromise-selections)** - remove brackets
- **[.possessives()](https://observablehq.com/@spencermountain/compromise-selections)** - things like `"Spencer's"`
  - **[.possessives().strip()](https://observablehq.com/@spencermountain/compromise-selections)** - "Spencer's" -> "Spencer"
- **[.quotations()](https://observablehq.com/@spencermountain/compromise-selections)** - return any terms inside paired quotation marks
  - **[.quotations().strip()](https://observablehq.com/@spencermountain/compromise-selections)** - remove quotation marks
- **[.slashes()](https://observablehq.com/@spencermountain/compromise-selections)** - return any terms grouped by slashes
  - **[.slashes().split()](https://observablehq.com/@spencermountain/compromise-selections)** - turn 'love/hate' into 'love hate'

<p>
<img height="85px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
</p>

<div align="center">
  <img src="https://user-images.githubusercontent.com/399657/68221814-05ed1680-ffb8-11e9-8b6b-c7528d163871.png"/>
</div>

### .extend():

This library comes with a considerate, common-sense baseline for english grammar.

You're free to change, or lay-waste to any settings - which is the fun part actually.

the easiest part is just to suggest tags for any given words:

```js
let myWords = {
  kermit: 'FirstName',
  fozzie: 'FirstName',
}
let doc = nlp(muppetText, myWords)
```

or make heavier changes with a [compromise-plugin](https://observablehq.com/@spencermountain/compromise-plugins).

```js
import nlp from 'compromise'
nlp.extend({
  // add new tags
  tags: {
    Character: {
      isA: 'Person',
      notA: 'Adjective',
    },
  },
  // add or change words in the lexicon
  words: {
    kermit: 'Character',
    gonzo: 'Character',
  },
  // change inflections
  irregulars: {
    get: {
      pastTense: 'gotten',
      gerund: 'gettin',
    },
  },
  // add new methods to compromise
  api: View => {
    View.prototype.kermitVoice = function () {
      this.sentences().prepend('well,')
      this.match('i [(am|was)]').prepend('um,')
      return this
    }
  },
})
```

<div align="right">
  <a href="https://docs.compromise.cool/compromise-plugins">.plugin() docs</a>
</div>
<div align="center">
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221848-11404200-ffb8-11e9-90cd-3adee8d8564f.png"/>
</div>

<!-- spacer -->
<div >
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
</div>

### Docs:

##### gentle introduction:

- **[#1) Input → output](https://docs.compromise.cool/tutorial-1)**
- **[#2) Match & transform](https://docs.compromise.cool/compromise-tutorial-2)**
- **[#3) Making a chat-bot](https://docs.compromise.cool/compromise-making-a-bot)**
  <!-- * **[Tutorial #4]()**  -  Making a plugin -->

<div >
  <img height="25px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
</div>

##### Documentation:

| Concepts                                                                                    |                                               API                                               |                                                                                Plugins |
| ------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------: | -------------------------------------------------------------------------------------: |
| [Accuracy](https://observablehq.com/@spencermountain/compromise-accuracy)                   |           [Accessors](https://observablehq.com/@spencermountain/compromise-accessors)           |          [Adjectives](https://observablehq.com/@spencermountain/compromise-adjectives) |
| [Caching](https://observablehq.com/@spencermountain/compromise-cache)                       | [Constructor-methods](https://observablehq.com/@spencermountain/compromise-constructor-methods) |                    [Dates](https://observablehq.com/@spencermountain/compromise-dates) |
| [Case](https://observablehq.com/@spencermountain/compromise-case)                           |        [Contractions](https://observablehq.com/@spencermountain/compromise-contractions)        |                  [Export](https://observablehq.com/@spencermountain/compromise-export) |
| [Filesize](https://observablehq.com/@spencermountain/compromise-filesize)                   |              [Insert](https://observablehq.com/@spencermountain/compromise-insert)              |                      [Hash](https://observablehq.com/@spencermountain/compromise-hash) |
| [Internals](https://observablehq.com/@spencermountain/compromise-internals)                 |                [Json](https://observablehq.com/@spencermountain/compromise-json)                |                      [Html](https://observablehq.com/@spencermountain/compromise-html) |
| [Justification](https://observablehq.com/@spencermountain/compromise-justification)         |        [Character Offsets](https://observablehq.com/@spencermountain/compromise-offsets)        |              [Keypress](https://observablehq.com/@spencermountain/compromise-keypress) |
| [Lexicon](https://observablehq.com/@spencermountain/compromise-lexicon)                     |               [Loops](https://observablehq.com/@spencermountain/compromise-loops)               |                   [Ngrams](https://observablehq.com/@spencermountain/compromise-ngram) |
| [Match-syntax](https://observablehq.com/@spencermountain/compromise-match-syntax)           |               [Match](https://observablehq.com/@spencermountain/compromise-match)               |                 [Numbers](https://observablehq.com/@spencermountain/compromise-values) |
| [Performance](https://observablehq.com/@spencermountain/compromise-performance)             |                    [Nouns](https://observablehq.com/@spencermountain/nouns)                     |          [Paragraphs](https://observablehq.com/@spencermountain/compromise-paragraphs) |
| [Plugins](https://observablehq.com/@spencermountain/compromise-plugins)                     |              [Output](https://observablehq.com/@spencermountain/compromise-output)              |                      [Scan](https://observablehq.com/@spencermountain/compromise-scan) |
| [Projects](https://observablehq.com/@spencermountain/compromise-projects)                   |          [Selections](https://observablehq.com/@spencermountain/compromise-selections)          |            [Sentences](https://observablehq.com/@spencermountain/compromise-sentences) |
| [Tagger](https://observablehq.com/@spencermountain/compromise-tagger)                       |             [Sorting](https://observablehq.com/@spencermountain/compromise-sorting)             |            [Syllables](https://observablehq.com/@spencermountain/compromise-syllables) |
| [Tags](https://observablehq.com/@spencermountain/compromise-tags)                           |               [Split](https://observablehq.com/@spencermountain/compromise-split)               |            [Pronounce](https://observablehq.com/@spencermountain/compromise-pronounce) |
| [Tokenization](https://observablehq.com/@spencermountain/compromise-tokenization)           |                [Text](https://observablehq.com/@spencermountain/compromise-text)                |                  [Strict](https://observablehq.com/@spencermountain/compromise-strict) |
| [Named-Entities](https://observablehq.com/@spencermountain/topics-named-entity-recognition) |               [Utils](https://observablehq.com/@spencermountain/compromise-utils)               |            [Penn-tags](https://observablehq.com/@spencermountain/compromise-penn-tags) |
| [Whitespace](https://observablehq.com/@spencermountain/compromise-whitespace)               |                    [Verbs](https://observablehq.com/@spencermountain/verbs)                     | [Typeahead](https://observablehq.com/@spencermountain/compromise/compromise-typeahead) |
| [World data](https://observablehq.com/@spencermountain/compromise-world)                    |       [Normalization](https://observablehq.com/@spencermountain/compromise-normalization)       |                    [Sweep](https://observablehq.com/@spencermountain/compromise-sweep) |
| [Fuzzy-matching](https://observablehq.com/@spencermountain/compromise-fuzzy-matching)       |          [Typescript](https://observablehq.com/@spencermountain/compromise-typescript)          |              [Mutation](https://observablehq.com/@spencermountain/compromise-mutation) |
| [Root-forms](https://observablehq.com/@spencermountain/compromise-root)                     |

<div >
  <img height="25px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
</div>

##### Talks:

- **[Language as an Interface](https://www.youtube.com/watch?v=WuPVS2tCg8s)** - by Spencer Kelly
- **[Coding Chat Bots](https://www.youtube.com/watch?v=c_hmwFwvO0U)** - by KahWee Teng
- **[On Typing and data](https://vimeo.com/496095722)** - by Spencer Kelly

##### Articles:

- **[Geocoding Social Conversations with NLP and JavaScript](http://compromise.cool)** - by Microsoft
- **[Microservice Recipe](https://eventn.com/recipes/text-parsing-with-nlp-compromise)** - by Eventn
- **[Adventure Game Sentence Parsing with Compromise](https://killalldefects.com/2020/02/20/adventure-game-sentence-parsing-with-compromise/)**
- **[Building Text-Based Games](https://killalldefects.com/2019/09/24/building-text-based-games-with-compromise-nlp/)** - by Matt Eland
- **[Fun with javascript in BigQuery](https://medium.com/@hoffa/new-in-bigquery-persistent-udfs-c9ea4100fd83#6e09)** - by Felipe Hoffa
- **[Natural Language Processing... in the Browser?](https://dev.to/charlesdlandau/natural-language-processing-in-the-browser-52hj)** - by Charles Landau

##### Some fun Applications:

- **[Automated Bechdel Test](https://github.com/guardian/bechdel-test)** - by The Guardian
- **[Story generation framework](https://perchance.org/welcome)** - by Jose Phrocca
- **[Tumbler blog of lists](https://leanstooneside.tumblr.com/)** - horse-ebooks-like lists - by Michael Paulukonis
- **[Video Editing from Transcription](https://newtheory.io/)** - by New Theory
- **[Browser extension Fact-checking](https://github.com/AlexanderKidd/FactoidL)** - by Alexander Kidd
- **[Siri shortcut](https://routinehub.co/shortcut/3260)** - by Michael Byrns
- **[Amazon skill](https://github.com/tajddin/voiceplay)** - by Tajddin Maghni
- **[Tasking Slack-bot](https://github.com/kevinsuh/toki)** - by Kevin Suh
  [[see more]](https://observablehq.com/@spencermountain/compromise-projects)

##### Comparisons

- [Compromise and Spacy](https://observablehq.com/@spencermountain/compromise-and-spacy)
- [Compromise and NLTK](https://observablehq.com/@spencermountain/compromise-and-nltk)

<!-- spacer -->
<div align="center">
  <img height="25px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
  <hr/>
</div>
<div align="center">
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221632-b9094000-ffb7-11e9-99e0-b48edd6cdf8a.png"/>
</div>

<!-- <div align="center">
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221824-09809d80-ffb8-11e9-9ef0-6ed3574b0ce8.png"/>
</div> -->

### Plugins:

These are some helpful extensions:

##### Dates

`npm install compromise-dates`

- **[.dates()](https://observablehq.com/@spencermountain/compromise-dates)** - find dates like `June 8th` or `03/03/18`
  - **[.dates().get()](https://observablehq.com/@spencermountain/compromise-dates)** - simple start/end json result
  - **[.dates().json()](https://observablehq.com/@spencermountain/compromise-dates)** - overloaded output with date metadata
  - **[.dates().format('')](https://observablehq.com/@spencermountain/compromise-dates)** - convert the dates to specific formats
  - **[.dates().toShortForm()](https://observablehq.com/@spencermountain/compromise-dates)** - convert 'Wednesday' to 'Wed', etc
  - **[.dates().toLongForm()](https://observablehq.com/@spencermountain/compromise-dates)** - convert 'Feb' to 'February', etc
- **[.durations()](https://observablehq.com/@spencermountain/compromise-dates)** - `2 weeks` or `5mins`
  - **[.durations().get()](https://observablehq.com/@spencermountain/compromise-dates)** - return simple json for duration
  - **[.durations().json()](https://observablehq.com/@spencermountain/compromise-dates)** - overloaded output with duration metadata
- **[.times()](https://observablehq.com/@spencermountain/compromise-dates)** - `4:30pm` or `half past five`
  - **[.times().get()](https://observablehq.com/@spencermountain/compromise-dates)** - return simple json for times
  - **[.times().json()](https://observablehq.com/@spencermountain/compromise-dates)** - overloaded output with time metadata

##### Stats

`npm install compromise-stats`

- **[.tfidf({})](https://observablehq.com/@spencermountain/compromise-tfidf)** - rank words by frequency and uniqueness

- **[.ngrams({})](https://observablehq.com/@spencermountain/compromise-ngram)** - list all repeating sub-phrases, by word-count
- **[.unigrams()](https://observablehq.com/@spencermountain/compromise-ngram)** - n-grams with one word
- **[.bigrams()](https://observablehq.com/@spencermountain/compromise-ngram)** - n-grams with two words
- **[.trigrams()](https://observablehq.com/@spencermountain/compromise-ngram)** - n-grams with three words
- **[.startgrams()](https://observablehq.com/@spencermountain/compromise-ngram)** - n-grams including the first term of a phrase
- **[.endgrams()](https://observablehq.com/@spencermountain/compromise-ngram)** - n-grams including the last term of a phrase
- **[.edgegrams()](https://observablehq.com/@spencermountain/compromise-ngram)** - n-grams including the first or last term of a phrase

##### Speech

`npm install compromise-syllables`

- **[.syllables()](https://observablehq.com/@spencermountain/compromise-syllables)** - split each term by its typical pronunciation
- **[.soundsLike()](https://observablehq.com/@spencermountain/compromise-soundsLike)** - produce a estimated pronunciation

##### Wikipedia

`npm install compromise-wikipedia`

- **[.wikipedia()](https://observablehq.com/@spencermountain/compromise-wikipedia)** - compressed article reconciliation

<!-- spacer -->
<div >
  <img height="25px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
  <hr/>
</div>

### Typescript

we're committed to typescript/deno support, both in main and in the official-plugins:

```ts
import nlp from 'compromise'
import stats from 'compromise-stats'

const nlpEx = nlp.extend(stats)

nlpEx('This is type safe!').ngrams({ min: 1 })
```

<div align="right">
  <a href="https://docs.compromise.cool/compromise-typescript">typescript docs</a>
</div>

<div >
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>
</div>

#### Limitations:

- **slash-support:**
  We currently split slashes up as different words, like we do for hyphens. so things like this don't work:
  <code>nlp('the koala eats/shoots/leaves').has('koala leaves') //false</code>

- **inter-sentence match:**
  By default, sentences are the top-level abstraction.
  Inter-sentence, or multi-sentence matches aren't supported without <a href="https://github.com/spencermountain/compromise/tree/master/plugins/paragraphs">a plugin</a>:
  <code>nlp("that's it. Back to Winnipeg!").has('it back')//false</code>

- **nested match syntax:**
  the <s>danger</s> beauty of regex is that you can recurse indefinitely.
  Our match syntax is much weaker. Things like this are not <i>(yet)</i> possible:
  <code>doc.match('(modern (major|minor))? general')</code>
  complex matches must be achieved with successive **.match()** statements.

- **dependency parsing:**
  Proper sentence transformation requires understanding the [syntax tree](https://en.wikipedia.org/wiki/Parse_tree) of a sentence, which we don't currently do.
  We should! Help wanted with this.

##### FAQ

<ul align="left">
  <p>
    <details>
      <summary>☂️ Isn't javascript too...</summary>
      <p></p>
      <ul>
        yeah it is!
        <br/>
        it wasn't built to compete with NLTK, and may not fit every project.
        <br/>
        string processing is synchronous too, and parallelizing node processes is weird.
        <br/>
        See <a href="https://observablehq.com/@spencermountain/compromise-performance">here</a> for information about speed & performance, and
        <a href="https://observablehq.com/@spencermountain/compromise-justification">here</a> for project motivations
      </ul>
      <p></p>
    </details>
  </p>
  <p>
    <details>
      <summary>💃 Can it run on my arduino-watch?</summary>
      <p></p>
      <ul>
        Only if it's water-proof!
        <br/>
        Read <a href="https://observablehq.com/@spencermountain/compromise-quickstart">quick start</a> for running compromise in workers, mobile apps, and all sorts of funny environments.
      </ul>
      <p></p>
    </details>
  </p>
  <p>
    <details>
      <summary>🌎 Compromise in other Languages?</summary>
      <p></p>
      <ul>
        we've got work-in-progress forks for <a href="https://github.com/nlp-compromise/de-compromise">German</a>, <a href="https://github.com/nlp-compromise/fr-compromise">French</a>, <a href="https://github.com/nlp-compromise/es-compromise">Spanish</a>, and <a href="https://github.com/nlp-compromise/it-compromise">Italian</a> in the same philosophy.
        <br/>
        and need some help.
      </ul>
      <p></p>
    </details>
  </p>
  <p>
    <details>
      <summary>✨ Partial builds?</summary>
      <p></p>
      <ul>
        we do offer a <a href="https://observablehq.com/@spencermountain/compromise-filesize">tokenize-only</a> build, which has the POS-tagger pulled-out.
        <br/>
        but otherwise, compromise isn't easily tree-shaken.
        <br/>
        the tagging methods are competitive, and greedy, so it's not recommended to pull things out.
        <br/>
        Note that without a full POS-tagging, the contraction-parser won't work perfectly. (<i>(spencer's cool)</i> vs. <i>(spencer's house)</i>)
        <br/>
        It's recommended to run the library fully.
      </ul>
      <p></p>
    </details>
  </p>
</ul>

<div align="center">
  <img src="https://user-images.githubusercontent.com/399657/68221731-e8b84800-ffb7-11e9-8453-6395e0e903fa.png"/>
</div>

#### See Also:

- &nbsp; **[en-pos](https://github.com/finnlp/en-pos)** - very clever javascript pos-tagger _by [Alex Corvi](https://github.com/alexcorvi)_
- &nbsp; **[naturalNode](https://github.com/NaturalNode/natural)** - fancier statistical nlp in javascript
- &nbsp; **[winkJS](https://winkjs.org/)** - POS-tagger, tokenizer, machine-learning in javascript
- &nbsp; **[dariusk/pos-js ](https://github.com/dariusk/pos-js)** - fastTag fork in javascript
- &nbsp; **[compendium-js](https://github.com/Ulflander/compendium-js)** - POS and sentiment analysis in javascript
- &nbsp; **[nodeBox linguistics](https://www.nodebox.net/code/index.php/Linguistics)** - conjugation, inflection in javascript
- &nbsp; **[reText](https://github.com/wooorm/retext)** - very impressive [text utilities](https://github.com/wooorm/retext/blob/master/doc/plugins.md) in javascript
- &nbsp; **[superScript](https://github.com/superscriptjs/superscript)** - conversation engine in js
- &nbsp; **[jsPos](https://code.google.com/archive/p/jspos/)** - javascript build of the time-tested Brill-tagger

- &nbsp; **[spaCy](https://spacy.io/)** - speedy, multilingual tagger in C/python
- &nbsp; **[Prose](https://github.com/jdkato/prose/)** - quick tagger in Go by Joseph Kato
- &nbsp; **[TextBlob](https://github.com/sloria/TextBlob)** - python tagger

<img height="25px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

<b>MIT</b>
