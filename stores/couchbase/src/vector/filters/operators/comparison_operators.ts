import { Boolean_Handler, Date_Handler, Null_Handler, Number_Handler, String_Handler } from './data_types';

function GetTypeOfField(value: Record<string, any>): string {
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

function OperatorHandler(typeOfField: any): any {
  switch (typeOfField) {
    case 'boolean':
      return Boolean_Handler;
    case 'date':
      return Date_Handler;
    case 'number':
      return Number_Handler;
    case 'string':
      return String_Handler;
    case 'null':
      return Null_Handler;
    default:
      throw new Error(`Unsupported field type: ${typeOfField}`);
  }
}

export { GetTypeOfField, OperatorHandler };
