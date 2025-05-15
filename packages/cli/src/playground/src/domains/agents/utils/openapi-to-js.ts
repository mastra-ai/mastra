import { ApiEndpoint } from '@/types';

const buildUrl = (data: ApiEndpoint, dynamicParams: Record<string, string>) => {
  const { endpoint, parameters } = data;

  const params = parameters.filter(p => p.in === 'path');
  const queryParams = parameters.filter(p => p.in === 'query');

  let formattedEndpoint = endpoint;

  params.forEach(p => {
    formattedEndpoint = formattedEndpoint.replace(`{${p.name}}`, `\${${p.name}}`);
  });

  const qpStringArray: string[] = [];

  queryParams.forEach(p => {
    qpStringArray.push(`${p.name}=\${${p.name}}`);
  });

  const qString = qpStringArray.join('&');
  const urlString = qString ? `${formattedEndpoint}?${qString}` : formattedEndpoint;

  let paramStringArray: string[] = [];

  parameters.forEach(p => {
    const currentParam = dynamicParams?.[p.name];
    if (p.schema.type !== 'string') {
      const strParam = currentParam ? `${currentParam};` : `undefined; // You have to set it yourself`;
      paramStringArray.push(`const ${p.name} = ${strParam}`);
    } else {
      const strParam = currentParam ? `'${currentParam}';` : `undefined; // You have to set it yourself`;
      paramStringArray.push(`const ${p.name} = ${strParam}`);
    }
  });

  const paramString = paramStringArray.length ? paramStringArray.join('\n') + '\n\n' : '';

  return {
    parameters: paramString,
    url: urlString,
  };
};

const buildBody = (body: ApiEndpoint['body']) => {
  if (!body) return undefined;

  if (body.type !== 'object') {
    console.log(`[Endpoints] body type"${body.type}" not implemented yet. Please report to the team.`);
    return `{}`;
  }

  const bodyStringArray: string[] = [];

  Object.entries(body.properties).forEach(([key, value]) => {
    if (value.type === 'string') {
      bodyStringArray.push(`${key}: ''`);
    } else if (value.type === 'number') {
      bodyStringArray.push(`${key}: 0`);
    } else if (value.type === 'boolean') {
      bodyStringArray.push(`${key}: false`);
    } else if (value.type === 'array') {
      bodyStringArray.push(`${key}: []`);
    } else if (value.type === 'object') {
      bodyStringArray.push(`${key}: {}`);
    } else {
      console.log(`[Endpoints] value type"${value.type}" not implemented yet. Please report to the team.`);
    }
  });

  return `const body = {
 ${bodyStringArray.join(',\n ')}
};\n\n`;
};

export const openApiToJs = (data: ApiEndpoint, dynamicParams: Record<string, string>) => {
  const { method } = data;

  const { parameters: paramString, url: urlString } = buildUrl(data, dynamicParams);

  const bodyStr = buildBody(data.body);

  return `${paramString}${bodyStr || ''}fetch(\`${urlString}\`, {
  method: '${method.toUpperCase()}',${bodyStr ? ` body: { JSON.stringify(body) }` : ''}
})`;
};
