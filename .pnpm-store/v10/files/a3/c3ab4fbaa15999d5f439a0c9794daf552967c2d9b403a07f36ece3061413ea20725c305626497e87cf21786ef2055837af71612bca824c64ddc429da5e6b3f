import convert from './_convert.js'

const getPercent = (part, total) => {
  if (total === 0) {
    return 100
  }
  let num = (part / total) * 100;
  num = Math.round(num * 10) / 10;
  return num;
};

// decide whether this rule performs well or not
const considerRule = function (rule, pairs) {
  let total = 0
  let clear = new Set()
  if (!rule) {
    return { total, percent: 0, rule, clear, count: 0 }
  }
  if (pairs.length === 0) {
    return { total, percent: 100, rule, clear, count: 0 }
  }
  pairs.forEach(pair => {
    let res = convert(pair[0], rule)
    if (res !== null) {
      total += 1
      if (res === pair[1]) {
        clear.add(pair[0])
      }
    }
  })
  return {
    total,
    count: clear.size,
    percent: getPercent(clear.size, total),
    rule,
    clear
  }
}
export default considerRule