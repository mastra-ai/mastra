import {humanId, maxLength, minLength, poolSize} from './index'

const samples = 10
const list = [...Array(samples)]

console.info(`\npoolSize()               // = ${poolSize().toLocaleString()}`)
console.info(`minLength()              // = ${minLength().toLocaleString()}`)
console.info(`maxLength()              // = ${maxLength().toLocaleString()}`)
console.info(`\nhumanId()`)
list.forEach(_ => console.log(`> ${humanId()}`))

console.info(`\nhumanId('-')             // or { "separator": "-" }`)
list.forEach(_ => console.log(`> ${humanId('-')}`))

console.info(`\nhumanId(false)           // or { "capitalize": false }`)
list.forEach(_ => console.log(`> ${humanId(false)}`))

const options = { adjectiveCount: 2, addAdverb: true, separator: '.' }
console.info(`\nconst options = ${JSON.stringify(options, null, ' ')}`)
console.info(`poolSize(options)        // = ${poolSize(options).toLocaleString()}`)
console.info(`minLength(options)       // = ${minLength(options).toLocaleString()}`)
console.info(`maxLength(options)       // = ${maxLength(options).toLocaleString()}`)
console.info(`humanId(options)`)
list.forEach(_ => console.log(`> ${humanId(options)}`))