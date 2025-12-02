#!/usr/bin/env node
import { humanId } from './index'

// @ts-ignore
const args = process.argv.slice(2)

const options = {
  adjectiveCount: 1,
  addAdverb: false,
  separator: '',
  capitalize: true
}

const adverb = ['a', 'adverb', 'addadverb']
const lower = ['l', 'lower', 'lowercase']

let reps = 1

for(const arg of args){
  if(String(parseInt(arg)) === String(arg))
    options.adjectiveCount = parseInt(arg)
  else if(typeof arg === 'string'){
    const lc = arg.toLowerCase()
    if(adverb.includes(lc))
      options.addAdverb = true
    else if(lower.includes(lc))
      options.capitalize = false
    else if(lc.endsWith('x'))
      reps = parseInt(arg)
    else if(lc === 'space')
      options.separator = ' '
    else if(!options.separator && arg.length === 1)
      options.separator = arg
  }
}

for(let i = 0; i < reps; i++){
  console.log(humanId(options))
}
