function and(nodes: any[]): any {
  if (nodes.length === 0) {
    return {};
  }
  return {
    conjuncts: nodes,
  };
}

function or(nodes: any[]): any {
  if (nodes.length === 0) {
    return {};
  }
  return {
    disjuncts: nodes,
  };
}

function not(node: any): any {
  if (node === null || node === undefined || (typeof node === 'object' && Object.keys(node).length === 0)) {
    return {};
  }
  return {
    must_not: {
      disjuncts: [node],
    },
  };
}

function nor(nodes: any[]): any {
  if (nodes.length === 0) {
    return {};
  }
  return {
    must_not: {
      disjuncts: nodes,
    },
  };
}

function next_level_handler_for_array(translateNode: (node: any) => any): any {
  return (nodes: any[]) => {
    return nodes.map((node: any) => translateNode(node));
  };
}

function next_level_handler_for_object(translateNode: (node: any) => any): any {
  return (node: any) => {
    return translateNode(node);
  };
}

function LogicalHandler(
  operator: string,
  translateNode: (node: any) => any,
): [(nodeObj: any) => any, (nodeObj: any) => any] {
  switch (operator) {
    case '$and':
      return [and, next_level_handler_for_array(translateNode)];
    case '$or':
      return [or, next_level_handler_for_array(translateNode)];
    case '$not':
      return [not, next_level_handler_for_object(translateNode)];
    case '$nor':
      return [nor, next_level_handler_for_array(translateNode)];
    default:
      throw new Error(`Unsupported logical operator: ${operator}`);
  }
}

function IsLogicalOperator(operator: string): boolean {
  return ['$and', '$or', '$not', '$nor'].includes(operator);
}

export { and, or, not, nor, LogicalHandler, IsLogicalOperator };
