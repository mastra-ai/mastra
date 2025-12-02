// longest common prefix
const findOverlap = (from, to) => {
  let all = []
  for (let i = 0; i < from.length; i += 1) {
    if (from[i] === to[i]) {
      all.push(from[i])
    } else {
      break
    }
  }
  return all.join('')
}

// run-length encode any shared prefix
let compress = function (key, val) {
  let prefix = findOverlap(key, val)
  if (prefix.length < 1) {
    return val
  }
  let out = prefix.length + val.substr(prefix.length)
  return out
}

export default compress
// console.log(compress('fixture', 'fixturing'))