import pc from 'picocolors';
import util from 'util';

let prefix = "🦋 ";

function format(args, customPrefix) {
  let fullPrefix = prefix + (customPrefix === undefined ? "" : " " + customPrefix);
  return fullPrefix + util.format("", ...args).split("\n").join("\n" + fullPrefix + " ");
}

function error(...args) {
  console.error(format(args, pc.red("error")));
}
function info(...args) {
  console.info(format(args, pc.cyan("info")));
}
function log(...args) {
  console.log(format(args));
}
function success(...args) {
  console.log(format(args, pc.green("success")));
}
function warn(...args) {
  console.warn(format(args, pc.yellow("warn")));
}

export { error, info, log, prefix, success, warn };
