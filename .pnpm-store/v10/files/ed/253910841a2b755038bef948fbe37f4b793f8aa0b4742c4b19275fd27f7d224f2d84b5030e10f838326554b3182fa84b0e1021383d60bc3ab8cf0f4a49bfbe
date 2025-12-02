import person from './_person.js'

// 'april o'neil'  -  'april 1st'

const m = 'Month'
const p = 'Person'
const month = {
  beforeTags: {
    Date: m,
    Value: m,
  },
  afterTags: {
    Date: m,
    Value: m,
  },
  beforeWords: {
    by: m,
    in: m,
    on: m,
    during: m,
    after: m,
    before: m,
    between: m,
    until: m,
    til: m,
    sometime: m,
    of: m, //5th of april
    this: m, //this april
    next: m,
    last: m,
    previous: m,
    following: m,
    with: p,
    // for: p,
  },
  afterWords: {
    sometime: m,
    in: m,
    of: m,
    until: m,
    the: m, //june the 4th
  },
}
export default {
  beforeTags: Object.assign({}, person.beforeTags, month.beforeTags),
  afterTags: Object.assign({}, person.afterTags, month.afterTags),
  beforeWords: Object.assign({}, person.beforeWords, month.beforeWords),
  afterWords: Object.assign({}, person.afterWords, month.afterWords),
}
