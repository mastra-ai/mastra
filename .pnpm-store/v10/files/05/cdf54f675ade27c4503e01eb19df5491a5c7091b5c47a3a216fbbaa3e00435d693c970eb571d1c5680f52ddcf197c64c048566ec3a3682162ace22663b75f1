import pc from "picocolors";
import util from "util";

export let prefix = "🦋 ";

function format(args: Array<any>, customPrefix?: string) {
  let fullPrefix =
    prefix + (customPrefix === undefined ? "" : " " + customPrefix);
  return (
    fullPrefix +
    util
      .format("", ...args)
      .split("\n")
      .join("\n" + fullPrefix + " ")
  );
}

export function error(...args: Array<any>) {
  console.error(format(args, pc.red("error")));
}

export function info(...args: Array<any>) {
  console.info(format(args, pc.cyan("info")));
}

export function log(...args: Array<any>) {
  console.log(format(args));
}

export function success(...args: Array<any>) {
  console.log(format(args, pc.green("success")));
}

export function warn(...args: Array<any>) {
  console.warn(format(args, pc.yellow("warn")));
}
