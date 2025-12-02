const termLoop = function (view, cb) {
  view.docs.forEach(terms => {
    terms.forEach(cb)
  })
}

export default {
  // remove titlecasing, uppercase
  'case': (doc) => {
    termLoop(doc, (term) => {
      term.text = term.text.toLowerCase()
    })
  },
  // visually romanize/anglicize 'Björk' into 'Bjork'.
  'unicode': (doc) => {
    const world = doc.world
    const killUnicode = world.methods.one.killUnicode
    termLoop(doc, (term) => term.text = killUnicode(term.text, world))
  },
  // remove hyphens, newlines, and force one space between words
  'whitespace': (doc) => {
    termLoop(doc, (term) => {
      // one space between words
      term.post = term.post.replace(/\s+/g, ' ')
      term.post = term.post.replace(/\s([.,?!:;])/g, '$1')//no whitespace before a period, etc
      // no whitepace before a word
      term.pre = term.pre.replace(/\s+/g, '')
    })
  },
  // remove commas, semicolons - but keep sentence-ending punctuation
  'punctuation': (doc) => {
    termLoop(doc, (term) => {
      // turn dashes to spaces
      term.post = term.post.replace(/[–—-]/g, ' ')
      // remove comma, etc 
      term.post = term.post.replace(/[,:;]/g, '')
      // remove elipses
      term.post = term.post.replace(/\.{2,}/g, '')
      // remove repeats
      term.post = term.post.replace(/\?{2,}/g, '?')
      term.post = term.post.replace(/!{2,}/g, '!')
      // replace ?!
      term.post = term.post.replace(/\?!+/g, '?')
    })
    // trim end
    let docs = doc.docs
    let terms = docs[docs.length - 1]
    if (terms && terms.length > 0) {
      let lastTerm = terms[terms.length - 1]
      lastTerm.post = lastTerm.post.replace(/ /g, '')
    }
  },

  // ====== subsets ===

  // turn "isn't" to "is not"
  'contractions': (doc) => {
    doc.contractions().expand()
  },
  //remove periods from acronyms, like 'F.B.I.'
  'acronyms': (doc) => {
    doc.acronyms().strip()
  },
  //remove words inside brackets (like these)
  'parentheses': (doc) => {
    doc.parentheses().strip()
  },
  // turn "Google's tax return" to "Google tax return"
  'possessives': (doc) => {
    doc.possessives().strip()
  },
  // turn "tax return" to tax return
  'quotations': (doc) => {
    doc.quotations().strip()
  },

  // remove them
  'emoji': (doc) => {
    doc.emojis().remove()
  },
  //turn 'Vice Admiral John Smith' to 'John Smith'
  'honorifics': (doc) => {
    doc.match('#Honorific+ #Person').honorifics().remove()
  },
  // remove needless adverbs
  'adverbs': (doc) => {
    doc.adverbs().remove()
  },

  // turn "batmobiles" into "batmobile"
  'nouns': (doc) => {
    doc.nouns().toSingular()
  },
  // turn all verbs into Infinitive form - "I walked" → "I walk"
  'verbs': (doc) => {
    doc.verbs().toInfinitive()
  },
  // turn "fifty" into "50"
  'numbers': (doc) => {
    doc.numbers().toNumber()
  },

  /** remove bullets from beginning of phrase */
  'debullet': (doc) => {
    const hasBullet = /^\s*([-–—*•])\s*$/
    doc.docs.forEach(terms => {
      //remove bullet symbols
      if (hasBullet.test(terms[0].pre)) {
        terms[0].pre = terms[0].pre.replace(hasBullet, '')
      }
    })
    return doc
  }
}
