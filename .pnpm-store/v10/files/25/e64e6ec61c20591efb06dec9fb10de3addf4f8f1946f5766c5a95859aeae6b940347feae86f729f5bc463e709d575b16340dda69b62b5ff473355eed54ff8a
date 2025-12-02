/** alphabetical order */
const alpha = (a, b) => {
  if (a.normal < b.normal) {
    return -1
  }
  if (a.normal > b.normal) {
    return 1
  }
  return 0
}

/** count the # of characters of each match */
const length = (a, b) => {
  let left = a.normal.trim().length
  let right = b.normal.trim().length
  if (left < right) {
    return 1
  }
  if (left > right) {
    return -1
  }
  return 0
}

/** count the # of terms in each match */
const wordCount = (a, b) => {
  if (a.words < b.words) {
    return 1
  }
  if (a.words > b.words) {
    return -1
  }
  return 0
}

/** count the # of terms in each match */
const sequential = (a, b) => {
  if (a[0] < b[0]) {
    return 1
  }
  if (a[0] > b[0]) {
    return -1
  }
  return a[1] > b[1] ? 1 : -1
}

/** sort by # of duplicates in the document*/
const byFreq = function (arr) {
  let counts = {}
  arr.forEach(o => {
    counts[o.normal] = counts[o.normal] || 0
    counts[o.normal] += 1
  })
  // sort by freq
  arr.sort((a, b) => {
    let left = counts[a.normal]
    let right = counts[b.normal]
    if (left < right) {
      return 1
    }
    if (left > right) {
      return -1
    }
    return 0
  })
  return arr
}

export default { alpha, length, wordCount, sequential, byFreq }
