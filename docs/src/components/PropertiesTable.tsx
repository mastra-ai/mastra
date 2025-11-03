import React from "react";

interface Parameter {
  name: string;
  type: string;
  isOptional?: boolean;
  description: string;
}

interface Property {
  type: string;
  parameters: Parameter[];
}

interface ContentItem {
  name: string;
  type: string;
  isOptional?: boolean;
  description: string;
  properties?: Property[];
  defaultValue?: string;
}

interface PropertiesTableProps {
  content?: ContentItem[];
}

const PropertiesTable: React.FC<PropertiesTableProps> = ({ content = [] }) => {
  const renderType = ({
    properties = [],
  }: {
    properties: Property[] | undefined;
  }) => {
    if (properties && properties.length > 0) {
      return (
        <div className="flex flex-col">
          {properties.map((prop, idx) => (
            <div
              key={idx}
              className="m-2 rounded-lg flex flex-col relative my-4 border border-(--ifm-color-emphasis-300)"
            >
              <div className="flex flex-col">
                <div className="cursor-pointer font-(family-name:--ifm-font-family-monospace) text-xs absolute -top-3 right-2 bg-(--ifm-color-emphasis-200) px-2 py-1 rounded-md text-(--ifm-color-emphasis-700) z-20">
                  {prop.type}
                </div>
                {prop.parameters &&
                  prop.parameters.map((param, paramIdx) => (
                    <div
                      key={paramIdx}
                      className="flex flex-col border-b p-3 gap-1 last:border-none border-(--ifm-color-emphasis-300)"
                    >
                      <div className="relative flex flex-row items-start gap-2 group">
                        <h3 className="font-(family-name:--ifm-font-family-monospace)! text-sm! font-medium! cursor-pointer m-0">
                          {param.name}
                          <span>{param.isOptional ? "?:" : ":"}</span>
                        </h3>
                        <div className="font-(family-name:--ifm-font-family-monospace) text-(--ifm-color-emphasis-700) text-sm w-full">
                          {param.type}
                        </div>
                      </div>
                      <div className="text-sm leading-5 text-(--ifm-color-emphasis-700)">
                        {param.description}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col">
      {content.map((item, index) => {
        return (
          <div
            key={index}
            id={item.name}
            className="flex flex-col gap-1 py-3 border-b border-(--ifm-color-emphasis-300)"
          >
            <div className="flex flex-row gap-2 group items-start">
              <h3 className="font-(family-name:--ifm-font-family-monospace)! text-sm! font-medium! cursor-pointer m-0 border-b-0! pb-0!">
                {item.name}
                <span>{item.isOptional ? "?:" : ":"}</span>
              </h3>
              <div className="text-sm leading-5 font-(family-name:--ifm-font-family-monospace) text-(--ifm-color-emphasis-700)">
                {item.type}
              </div>
              {item.defaultValue && (
                <div className="text-sm leading-5 text-(--ifm-color-emphasis-700)">
                  = {item.defaultValue}
                </div>
              )}
            </div>
            <div className="text-sm leading-5 text-(--ifm-color-emphasis-700)">
              {item.description}
            </div>
            {renderType({ properties: item.properties })}
          </div>
        );
      })}
    </div>
  );
};

export default PropertiesTable;
