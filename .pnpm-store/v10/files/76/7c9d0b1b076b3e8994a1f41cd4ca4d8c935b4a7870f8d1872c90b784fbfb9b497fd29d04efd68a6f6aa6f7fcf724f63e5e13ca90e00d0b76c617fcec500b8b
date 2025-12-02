export function validateArg(
  arg: any,
  idx: number,
  method: string,
  argName: string,
) {
  if (arg === undefined) {
    throw new TypeError(
      `Must provide arg ${idx} \`${argName}\` to \`${method}\``,
    );
  }
}

export function validateArgIsInteger(
  arg: any,
  idx: number,
  method: string,
  argName: string,
) {
  if (!Number.isInteger(arg)) {
    throw new TypeError(
      `Arg ${idx} \`${argName}\` to \`${method}\` must be an integer`,
    );
  }
}

export function validateArgIsNonNegativeInteger(
  arg: any,
  idx: number,
  method: string,
  argName: string,
) {
  if (!Number.isInteger(arg) || arg < 0) {
    throw new TypeError(
      `Arg ${idx} \`${argName}\` to \`${method}\` must be a non-negative integer`,
    );
  }
}
