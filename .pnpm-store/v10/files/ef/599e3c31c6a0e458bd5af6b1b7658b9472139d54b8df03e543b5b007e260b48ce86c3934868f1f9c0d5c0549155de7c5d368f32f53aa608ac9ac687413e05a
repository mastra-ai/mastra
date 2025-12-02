import {Tree} from "@lezer/common"

export function compareTree(a: Tree, b: Tree) {
  let curA = a.cursor(), curB = b.cursor()
  for (;;) {
    let mismatch = null, next = false
    if (curA.type != curB.type) mismatch = `Node type mismatch (${curA.name} vs ${curB.name})`
    else if (curA.from != curB.from) mismatch = `Start pos mismatch for ${curA.name}: ${curA.from} vs ${curB.from}`
    else if (curA.to != curB.to) mismatch = `End pos mismatch for ${curA.name}: ${curA.to} vs ${curB.to}`
    else if ((next = curA.next()) != curB.next()) mismatch = `Tree size mismatch`
    if (mismatch) throw new Error(`${mismatch}\n  ${a}\n  ${b}`)
    if (!next) break
  }
}
