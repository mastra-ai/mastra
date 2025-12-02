const {readdirSync} = require("fs"), {join} = require("path")

let mode = join(__dirname, "mode")

module.exports = readdirSync(mode).filter(f => /\.js$/.test(f)).map(f => ({
  input: join(mode, f),
  output: {
    file: join(mode, f.replace(/\.js$/, ".cjs")),
    format: "cjs"
  },
  external: id => !/^(\.?\/|\w:)/.test(id)
}))
