import data from './_data.js'
import { unpack } from 'efrt'

Object.keys(data).forEach(ambig => {
  data[ambig].forEach(sense => {
    sense.words = unpack(sense.words)
  })
})

export default {
  four: {
    senses: data,
  },
}
