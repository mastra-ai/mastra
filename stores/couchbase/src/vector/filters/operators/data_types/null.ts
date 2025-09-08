function Null_Handler(_: string, __: Record<string, any>): any {
  return {};
}

export { Null_Handler };

function qv_Null_Handler(field: string, __: Record<string, any>): any {
  return `(${field} IS NULL)`;
}

export { qv_Null_Handler };
