import {build, watch} from "@marijn/buildtool"
import {fileURLToPath} from "url"
import {dirname, join} from "path"

let tsOptions = {
  lib: ["es5", "es6"],
  target: "es6"
}

let main = join(dirname(fileURLToPath(import.meta.url)), "src", "index.ts")

if (process.argv.includes("--watch")) {
  watch([main], [], {tsOptions})
} else {
  build(main, {tsOptions})
}
