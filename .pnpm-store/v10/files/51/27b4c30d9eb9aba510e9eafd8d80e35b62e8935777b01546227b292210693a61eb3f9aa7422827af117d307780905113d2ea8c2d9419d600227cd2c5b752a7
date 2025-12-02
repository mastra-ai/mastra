/*
unique & ordered term ids, based on time & term index

Base 36 (numbers+ascii)
  3 digit 4,600
  2 digit 1,200
  1 digit 36

  TTT|NNN|II|R

TTT -> 46 terms since load
NNN -> 46 thousand sentences (>1 inf-jest)
II  -> 1,200 words in a sentence (nuts)
R   -> 1-36 random number 

novels: 
  avg 80,000 words
    15 words per sentence
  5,000 sentences

Infinite Jest:
  36,247 sentences
  https://en.wikipedia.org/wiki/List_of_longest_novels

collisions are more-likely after
    46 seconds have passed,
  and 
    after 46-thousand sentences

*/
let index = 0

const pad3 = (str) => {
  str = str.length < 3 ? '0' + str : str
  return str.length < 3 ? '0' + str : str
}

const toId = function (term) {
  let [n, i] = term.index || [0, 0]
  index += 1

  //don't overflow index
  index = index > 46655 ? 0 : index
  //don't overflow sentences
  n = n > 46655 ? 0 : n
  // //don't overflow terms
  i = i > 1294 ? 0 : i

  // 3 digits for time
  let id = pad3(index.toString(36))
  // 3 digit  for sentence index (46k)
  id += pad3(n.toString(36))

  // 1 digit for term index (36)
  let tx = i.toString(36)
  tx = tx.length < 2 ? '0' + tx : tx //pad2
  id += tx

  // 1 digit random number
  let r = parseInt(Math.random() * 36, 10)
  id += (r).toString(36)

  return term.normal + '|' + id.toUpperCase()
}

export default toId

// setInterval(() => console.log(toId(4, 12)), 100)
