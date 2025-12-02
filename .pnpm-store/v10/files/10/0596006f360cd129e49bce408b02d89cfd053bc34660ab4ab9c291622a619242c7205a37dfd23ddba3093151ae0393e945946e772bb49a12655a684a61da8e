import {javascript} from "./javascript.js"

function identifier(stream) {
  return stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)
}

export const pegjs = {
  name: "pegjs",
  startState: function () {
    return {
      inString: false,
      stringType: null,
      inComment: false,
      inCharacterClass: false,
      braced: 0,
      lhs: true,
      localState: null
    }
  },
  token: function (stream, state) {
    if (!state.inString &&
        !state.inComment &&
        (stream.peek() === '"' || stream.peek() === "'")) {
      //check for state changes
      state.stringType = stream.peek()
      stream.next() // Skip quote
      state.inString = true // Update state
    }
    if (!state.inString && !state.inComment && stream.match("/*"))
      state.inComment = true

    if (state.inString) {
      while (state.inString && !stream.eol()) {
        if (stream.peek() === state.stringType) {
          stream.next() // Skip quote
          state.inString = false // Clear flag
        } else if (stream.peek() === "\\") {
          stream.next()
          stream.next()
        } else {
          stream.match(/^.[^\\"']*/)
        }
      }
      return state.lhs ? "property string" : "string" // Token style
    } else if (state.inComment) {
      while (state.inComment && !stream.eol()) {
        if (stream.match("*/")) state.inComment = false // Clear flag
        else stream.match(/^.[^*]*/)
      }
      return "comment"
    } else if (state.inCharacterClass) {
      while (state.inCharacterClass && !stream.eol()) {
        if (!(stream.match(/^[^\]\\]+/) || stream.match(/^\\./)))
          state.inCharacterClass = false
      }
    } else if (stream.peek() === "[") {
      stream.next()
      state.inCharacterClass = true
      return "bracket"
    } else if (stream.match("//")) {
      stream.skipToEnd()
      return "comment"
    } else if (state.braced || stream.peek() === "{") {
      if (state.localState === null) state.localState = javascript.startState()
      var token = javascript.token(stream, state.localState)
      var text = stream.current()
      if (!token) {
        for (var i = 0; i < text.length; i++) {
          if (text[i] === "{") state.braced++
          else if (text[i] === "}") state.braced--
        }
      }
      return token
    } else if (identifier(stream)) {
      if (stream.peek() === ":") return "variable"
      return "variable-2"
    } else if (["[", "]", "(", ")"].indexOf(stream.peek() || "") !== -1) {
      stream.next()
      return "bracket"
    } else if (!stream.eatSpace()) {
      stream.next()
    }
    return null
  }
}
