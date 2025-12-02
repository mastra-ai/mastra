'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var reserve = "><+-.,[]".split("");
/*
  comments can be either:
  placed behind lines

  +++    this is a comment

  where reserved characters cannot be used
  or in a loop
  [
  this is ok to use [ ] and stuff
  ]
  or preceded by #
*/
const brainfuck = {
  name: "brainfuck",
  startState: function() {
    return {
      commentLine: false,
      left: 0,
      right: 0,
      commentLoop: false
    }
  },
  token: function(stream, state) {
    if (stream.eatSpace()) return null
    if(stream.sol()){
      state.commentLine = false;
    }
    var ch = stream.next().toString();
    if(reserve.indexOf(ch) !== -1){
      if(state.commentLine === true){
        if(stream.eol()){
          state.commentLine = false;
        }
        return "comment";
      }
      if(ch === "]" || ch === "["){
        if(ch === "["){
          state.left++;
        }
        else {
          state.right++;
        }
        return "bracket";
      }
      else if(ch === "+" || ch === "-"){
        return "keyword";
      }
      else if(ch === "<" || ch === ">"){
        return "atom";
      }
      else if(ch === "." || ch === ","){
        return "def";
      }
    }
    else {
      state.commentLine = true;
      if(stream.eol()){
        state.commentLine = false;
      }
      return "comment";
    }
    if(stream.eol()){
      state.commentLine = false;
    }
  }
};

exports.brainfuck = brainfuck;
