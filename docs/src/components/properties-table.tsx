"use client";
import React from "react";
import { T } from "gt-next/client";

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

export const PropertiesTable: React.FC<PropertiesTableProps> = ({
  content = [],
}) => {
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
              className="m-2 rounded-lg flex flex-col relative my-4 border border-neutral-300 dark:border-neutral-900"
            >
              <div className="flex flex-col">
                <div className="cursor-pointer font-mono text-xs absolute -top-3 right-2 bg-zinc-200 dark:bg-neutral-700 dark:text-zinc-400 px-2 py-1 rounded-md text-zinc-600 z-20">
                  {prop.type}
                </div>
                {prop.parameters &&
                  prop.parameters.map((param, paramIdx) => (
                    <div
                      key={paramIdx}
                      className="flex flex-col border-b p-3 gap-1 last:border-none dark:border-neutral-700"
                    >
                      <div className="relative flex flex-row items-start gap-2 group">
                        <h3 className="font-mono text-sm font-medium cursor-pointer">
                          {param.name}
                          <span>
                            {param.isOptional ? (
                              <T id="components.properties_table.0">{"?:"}</T>
                            ) : (
                              <T id="components.properties_table.1">{":"}</T>
                            )}
                          </span>
                        </h3>
                        <div className="font-mono text-zinc-500 text-sm w-full">
                          {param.type}
                        </div>
                      </div>
                      <div className="text-sm leading-5 text-zinc-500">
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
            className="flex flex-col gap-1 py-3 border-b first:pt-0 first:pb-3 border-neutral-300 dark:border-neutral-900"
          >
            <div className="flex flex-row gap-2 group items-start">
              <h3 className="font-mono text-sm font-medium cursor-pointer">
                {item.name}
                <span>
                  {item.isOptional ? (
                    <T id="components.properties_table.2">{"?:"}</T>
                  ) : (
                    <T id="components.properties_table.3">{":"}</T>
                  )}
                </span>
              </h3>
              <div className="text-sm leading-5 text-zinc-500">{item.type}</div>
              {item.defaultValue && (
                <div className="text-sm leading-5 text-zinc-500">
                  = {item.defaultValue}
                </div>
              )}
            </div>
            <div className="text-sm leading-5 text-zinc-500">
              {item.description}
            </div>
            {renderType({ properties: item.properties })}
          </div>
        );
      })}
    </div>
  );
};
