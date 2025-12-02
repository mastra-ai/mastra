<div align="center">
  <!-- spacer -->
  <img height="15px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>


  <img src="https://cloud.githubusercontent.com/assets/399657/23590290/ede73772-01aa-11e7-8915-181ef21027bc.png" />

  <div>find the optimal transormations between sets of words</div>
  
  <!-- npm version -->
  <a href="https://npmjs.org/package/suffix-thumb">
    <img src="https://img.shields.io/npm/v/suffix-thumb.svg?style=flat-square" />
  </a>
  
  <!-- file size -->
  <a href="https://unpkg.com/suffix-thumb/builds/suffix-thumb.min.js">
    <img src="https://badge-size.herokuapp.com/spencermountain/suffix-thumb/master/builds/suffix-thumb.min.js" />
  </a>

   <div align="center">
    <code>npm install suffix-thumb</code>
  </div>
  
  <!-- spacer -->
  <img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

  
</div>

discover the minimal rules for mapping two sets of words to one another, according to changes in their suffix.

It was built for learning rules about verb conjugations, but in a way, it is just a generic compression algorithm.

The assumption is that a word's _suffix_ is the most-often changed part of a word.

<!-- ![carbon(1)](https://user-images.githubusercontent.com/399657/79898840-e7e66780-83d9-11ea-9ff3-099bf39cf892.png) -->

![preview](https://user-images.githubusercontent.com/399657/147783157-f8bdf781-0925-4af3-9fdc-beb84073803e.png)


<!-- spacer -->
<img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

### Learn → Convert

```js
import { learn, convert } from 'suffix-thumb'

let pairs = [
  ['walk', 'walked'],
  ['talk', 'talked'],
  ['go', 'went'],
]
let model = learn(pairs)
/* {
  rules: { k: [ [ 'alk', 'alked' ] ] },
  exceptions: { go: 'went' },
}*/

let out = convert('walk', model)
// 'walked'
```

you can pass-in options:
```js
let opts={
  threshold:80, //how sloppy our initial rules can be
  min:0, //rule must satisfy # of pairs
  reverse:true, //compute backward transformation, too
}
let model = learn(pairs, opts)
```
<!-- spacer -->
<img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

### Reverse
the model also works transforming the words the other way:
```js
import { learn, reverse, convert } from 'suffix-thumb'

let pairs = [
  ['walk', 'walked'],
  ['talk', 'talked'],
  ['go', 'went'],
]
let model = learn(pairs)
let rev = reverse(model)
let out = convert('walked', rev)
// 'walk'
```
by default, the model ensures all two-way transformation - if you only require 1-way, you can do:
```js
learn(pairs, {reverse: false})
```
you can expect the model to be 5% smaller or so - not much.

<!-- spacer -->
<img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

### Compress
by default, the model is small, but remains human-readable (and human-editable).
We can compress it further, turning it into a snowball inscrutible characters:

```js
import { learn, compress, uncompress, convert } from 'suffix-thumb'

let pairs = [
  ['walk', 'walked'],
  ['talk', 'talked'],
  ['go', 'went'],
]
let model = learn(pairs)
// shrink it
model = compress(shrink)
// {rules:'LSKs3H2-LNL.S3DH'}
// pop it back
model = uncompress(model)
let out = convert('walk', model)
// 'walked'

```
The models must be uncompressed before they are used, or reversed.

<!-- spacer -->
<img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

### Validation
sometimes you can accidentally send in an impossible set of transformations. This library quietly ignores duplicates, by default.
You can use `{verbose:true}` to log warnings about this, or validate your input manually:
```js
import { validate } from 'suffix-thumb'
let pairs = [
  ['left', 'right'],
  ['left', 'right-two'],
  ['ok', 'right'],
]
pairs = validate(pairs) //remove dupes (on both sides)
```

If you are just doing one-way transformation, and not reverse, you may want to allow duplicates on the right side:
```js
let pairs = [
  ['left', 'right'],
  ['ok', 'right'],
]
let model = learn(pairs, {reverse: false})
let out = convert('ok', model)
// 'right'
```
<!-- 
### Classify
the model can also be used to classify whether a given word belongs to either Left or Right sides.

```js
import { learn, classify } from 'suffix-thumb'
let pairs = [
  ['walk', 'walked'],
  ['talk', 'talked'],
  ['go', 'went'],
]
let model = learn(pairs)
let out = classify('stalked', model)
// 'Right'
out = classify('waited', model)
// null
```
Unlike convert, the classifier is not guarnteed to return 100% on the training data.
The classifier will generally hit high-90s on the given dataset, but how-well it generalizes to novel input is up-to the dataset. -->

<!-- spacer -->
<img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

## How it works

For each word-pair, it generates all **n-suffixes** of the left-side, and **n-suffixes** of the right-side.

any good correlations between the two suffix pairs begins to pop out. Exceptions to these rules are remembered. It then exhaustively reduces any redundancies in these rules.

There are some compromises, magic-numbers, and opinionated decisions - in-order to allow productive, but imperfect rules.

* The library is meant optimize for file-size of the model
* compression is slow, uncompression is fast
* it should always return a perfect result

The library drops case-information - and numbers and some characters[1](https://github.com/spencermountain/efrt) will not compress properly.

There may be wordlists with few helpful patterns. Conjugation datasets in English and French tend to get ~85% filesize compression.

<!-- spacer -->
<img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>


### See also
* [efrt](https://github.com/spencermountain/efrt) - trie-based prefix compression for JSON
  
<!-- spacer -->
<img height="50px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>


MIT
