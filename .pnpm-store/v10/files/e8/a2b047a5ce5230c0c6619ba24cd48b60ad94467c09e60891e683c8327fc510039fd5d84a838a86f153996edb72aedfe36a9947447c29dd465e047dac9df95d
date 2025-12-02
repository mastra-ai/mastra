import easyMode from './01-easy.js'
import byNeighbour from './02-neighbours.js'
import matcher from './03-matcher.js'
import fallback from './04-fallback.js'
import fixUp from './05-fixUp.js'
/* Chunks:
    Noun
    Verb
    Adjective
    Pivot
*/

const findChunks = function (view) {
  const { document, world } = view
  easyMode(document)
  byNeighbour(document)
  matcher(view, document, world)
  // matcher(view, document, world) //run it 2nd time
  fallback(document, world)
  fixUp(document, world)
}
export default { chunks: findChunks }
