function qv_and(nodes: any[]): any {
  const filteredNodes = nodes.filter(node => node && node.length !== 0);
  if (filteredNodes.length === 0) {
    return '';
  }
  if (filteredNodes.length === 1) {
    return filteredNodes[0];
  }
  return `(${filteredNodes.join(' AND ')})`;
}

function qv_or(nodes: any[]): any {
  const filteredNodes = nodes.filter(node => node && node.length !== 0);
  if (filteredNodes.length === 0) {
    return '';
  }
  if (filteredNodes.length === 1) {
    return filteredNodes[0];
  }
  return `(${filteredNodes.join(' OR ')})`;
}

function qv_not(node: any): any {
  if (node === null || node === undefined || (typeof node === 'object' && Object.keys(node).length === 0)) {
    return '';
  }
  return `(NOT ${node})`;
}

function qv_nor(nodes: any[]): any {
  const filteredNodes = nodes.filter(node => node && node.length !== 0);
  if (filteredNodes.length === 0) {
    return '';
  }
  return qv_not(qv_or(filteredNodes));
}

function qv_next_level_handler_for_array(translateNode: (node: any) => any): any {
  return (nodes: any[]) => {
    return nodes.map((node: any) => translateNode(node));
  };
}

function qv_next_level_handler_for_object(translateNode: (node: any) => any): any {
  return (node: any) => {
    return translateNode(node);
  };
}

function qv_LogicalHandler(
  operator: string,
  translateNode: (node: any) => any,
): [(nodeObj: any) => any, (nodeObj: any) => any] {
  switch (operator) {
    case '$and':
      return [qv_and, qv_next_level_handler_for_array(translateNode)];
    case '$or':
      return [qv_or, qv_next_level_handler_for_array(translateNode)];
    case '$not':
      return [qv_not, qv_next_level_handler_for_object(translateNode)];
    case '$nor':
      return [qv_nor, qv_next_level_handler_for_array(translateNode)];
    default:
      throw new Error(`Unsupported logical operator: ${operator}`);
  }
}

function qv_IsLogicalOperator(operator: string): boolean {
  return ['$and', '$or', '$not', '$nor'].includes(operator);
}

export { qv_and, qv_or, qv_not, qv_nor, qv_LogicalHandler, qv_IsLogicalOperator };
