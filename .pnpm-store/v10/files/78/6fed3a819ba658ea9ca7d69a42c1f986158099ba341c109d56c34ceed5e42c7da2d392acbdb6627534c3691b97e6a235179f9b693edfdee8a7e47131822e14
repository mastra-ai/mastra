const round = n => Math.round(n * 100) / 100

export default function (View) {
  // average tagger score
  View.prototype.confidence = function () {
    let sum = 0
    let count = 0
    this.docs.forEach(terms => {
      terms.forEach(term => {
        count += 1
        sum += term.confidence || 1
      })
    })
    if (count === 0) {
      return 1
    }
    return round(sum / count)
  }

  // (re-) run the POS-tagger
  View.prototype.tagger = function () {
    return this.compute(['tagger'])
  }
}