import nlp from './nlp.js' // 5kb
import cache from './1-one/cache/plugin.js'
import change from './1-one/change/plugin.js'
import contractions from './1-one/contraction-one/plugin.js'
import freeze from './1-one/freeze/plugin.js'
import lexicon from './1-one/lexicon/plugin.js'
import lookup from './1-one/lookup/plugin.js'
import match from './1-one/match/plugin.js'
import output from './1-one/output/plugin.js'
import pointers from './1-one/pointers/plugin.js'
import sweep from './1-one/sweep/plugin.js'
import tag from './1-one/tag/plugin.js'
import tokenize from './1-one/tokenize/plugin.js'
import typeahead from './1-one/typeahead/plugin.js'

// order here matters
nlp.extend(change) //0kb
nlp.extend(output) //0kb
nlp.extend(match) //10kb
nlp.extend(pointers) //2kb
nlp.extend(tag) //2kb
nlp.plugin(contractions) //~6kb
nlp.extend(tokenize) //7kb
nlp.extend(freeze) //
nlp.plugin(cache) //~1kb
nlp.extend(lookup) //7kb
nlp.extend(typeahead) //1kb
nlp.extend(lexicon) //1kb
nlp.extend(sweep) //1kb

export default nlp // 40kb
