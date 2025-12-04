import {
  qv_Boolean_Handler,
  qv_Date_Handler,
  qv_Null_Handler,
  qv_Number_Handler,
  qv_String_Handler,
} from './data_types';

function qv_GetTypeOfField(value: Record<string, any>): string {
  if (value === null || value === undefined || Object.keys(value).length === 0) {
    return 'undefined';
  }
  // Go through each op,data in the value and get the type from them
  let typeOfField = 'undefined';
  for (const op in value) {
    const data = value[op];
    let dataType: string;
    if (data instanceof Date) {
      dataType = 'date';
    } else if (data === null) {
      dataType = 'null';
    } else {
      dataType = typeof data;
    }

    if (typeOfField === 'undefined') {
      typeOfField = dataType;
    } else if (dataType !== typeOfField) {
      throw new Error(`Mixed data types in field operators: found ${dataType} but expected ${typeOfField}`);
    }
  }
  return typeOfField;
}

function qv_OperatorHandler(typeOfField: any): any {
  switch (typeOfField) {
    case 'boolean':
      return qv_Boolean_Handler;
    case 'date':
      return qv_Date_Handler;
    case 'number':
      return qv_Number_Handler;
    case 'string':
      return qv_String_Handler;
    case 'null':
      return qv_Null_Handler;
    default:
      throw new Error(`Unsupported field type: ${typeOfField}`);
  }
}

export { qv_GetTypeOfField, qv_OperatorHandler };
