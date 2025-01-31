"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, GitPullRequest } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { generateOpenApiSpec, makeMastraPR } from "@/actions";
import { CodeBlock } from "../ui/codeblock";
import { Button } from "../ui/button";
import Link from "next/link";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { BaseLogMessage } from "@mastra/core/logger";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface PredefinedUrl {
  label: string;
  value: string;
}

export interface OpenApiParameter {
  name: string;
  in: string;
  description: string;
  required: boolean;
}

export interface OpenApiPath {
  summary: string;
  description?: string;
  parameters?: OpenApiParameter[];
  responses?: Record<string, { description: string }>;
}

interface CodeLineProps {
  line: string;
}

interface CodeEditorProps {
  code: string;
}

export const CodeLine: React.FC<CodeLineProps> = ({ line }) => {
  const tokens = line
    .split(/([{}[\],]|"(?:\\.|[^"\\])*"|\b(?:true|false|null|\d+)\b|\s+)/g)
    .filter(Boolean);

  return (
    <div className="leading-6 text-sm">
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) {
          return <span key={i}>{token}</span>;
        } else if (/^".*":$/.test(token)) {
          return (
            <span key={i} className="text-yellow-300">
              {token}
            </span>
          );
        } else if (/^".*"$/.test(token)) {
          return (
            <span key={i} className="text-green-300">
              {token}
            </span>
          );
        } else if (/^-?\d+\.?\d*$/.test(token)) {
          return (
            <span key={i} className="text-blue-300">
              {token}
            </span>
          );
        } else if (/^(true|false|null)$/.test(token)) {
          return (
            <span key={i} className="text-blue-300">
              {token}
            </span>
          );
        } else if (/^[{}[\],]$/.test(token)) {
          return (
            <span key={i} className="text-gray-500">
              {token}
            </span>
          );
        } else {
          return <span key={i}>{token}</span>;
        }
      })}
    </div>
  );
};

export const CodeEditor: React.FC<CodeEditorProps> = ({ code }) => {
  const lines = code.split("\n");
  const lineNumbers = Array.from({ length: lines.length }, (_, i) => i + 1);

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
        <div className="ml-4 bg-gray-700 text-gray-300 px-3 py-1 rounded-md text-sm">
          openapi.json
        </div>
      </div>
      <div className="overflow-auto max-h-[500px]">
        <div className="flex">
          <div className="py-4 pr-4 pl-4 text-gray-500 select-none bg-gray-800 text-right">
            {lineNumbers.map((num) => (
              <div key={num} className="leading-6 text-sm">
                {num}
              </div>
            ))}
          </div>
          <pre className="flex-1 p-4 overflow-auto text-gray-300">
            <code>
              {lines.map((line, i) => (
                <CodeLine key={i} line={line} />
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};

const OpenApiGenerator: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [selectedUrl, setSelectedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [prLoading, setPrLoading] = useState(false);
  const [prUrl, setPrUrl] = useState("");
  const [error, setError] = useState("");
  const [openApiSpec, setOpenApiSpec] = useState("");
  const comboboxRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("");
  const [logs, setLogs] = useState<BaseLogMessage[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const inputEl = inputRef.current;
    if (inputEl) {
      inputEl.focus();
    }
  }, []);

  const predefinedUrls: PredefinedUrl[] = [
    {
      label: "Browserbase",
      value: "https://docs.browserbase.com/reference/api",
    },
  ];

  const filteredOptions = predefinedUrls.filter(
    (option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
      option.value.toLowerCase().includes(inputValue.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        comboboxRef.current &&
        !comboboxRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (): Promise<void> => {
    const urlToSubmit = selectedUrl || inputValue;
    if (!urlToSubmit) {
      setError("Please enter a valid URL");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await generateOpenApiSpec({
        url: urlToSubmit,
        crawlOptions: { pathRegex: "" },
      });

      if (res.logs) setLogs((prev) => [...prev, ...res.logs]);

      if (res.message === "failed") {
        setError(res.data);
      }
      if (typeof res.data === "string") setOpenApiSpec(res.data);
      setStatus(res.message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while generating the specification"
      );
    } finally {
      setLoading(false);
    }
  };

  const triggerPR = async () => {
    if (!openApiSpec) {
      setError("No Open API Spec generated");
      return;
    }

    setPrLoading(true);
    setError("");

    try {
      const res = await makeMastraPR({
        crawledUrl: selectedUrl || inputValue,
        yaml: openApiSpec,
        integrationName: "BrowserBase",
      });

      if (res.logs) setLogs((prev) => [...prev, ...res.logs]);

      if (res.message === "failed") {
        setError(res.data);
        return;
      }

      setPrUrl(res.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while generating the specification"
      );
    } finally {
      setPrLoading(false);
    }
  };

  const isProduction = process.env.NODE_ENV === "production";

  return (
    <section className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-8">
      <div className="flex flex-col">
        <svg
          width="29"
          height="17"
          viewBox="0 0 29 17"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto w-16 h-16"
        >
          <path
            d="M6.13281 17C5.07812 17 4.16406 16.8008 3.39062 16.4023C2.61719 15.9961 2.01562 15.4531 1.58594 14.7734C1.16406 14.0938 0.953125 13.3477 0.953125 12.5352V5.41016C0.953125 4.58984 1.16406 3.84375 1.58594 3.17188C2.01562 2.49219 2.61719 1.95312 3.39062 1.55469C4.16406 1.14844 5.07812 0.945312 6.13281 0.945312H9.74219C10.7969 0.945312 11.7109 1.14844 12.4844 1.55469C13.2656 1.95312 13.8672 2.49219 14.2891 3.17188C14.7109 3.84375 14.9219 4.58984 14.9219 5.41016V12.5352C14.9219 13.3477 14.7109 14.0938 14.2891 14.7734C13.8672 15.4531 13.2656 15.9961 12.4844 16.4023C11.7109 16.8008 10.7969 17 9.74219 17H6.13281ZM6.90625 11.6914H10.0469L11.2539 11.5508L11.9922 10.8125L12.1562 9.80469V3.89844L11.9922 2.91406L11.2539 2.16406L10.0469 2H6.90625L5.71094 2.16406L4.96094 2.91406L4.82031 3.89844V9.80469L4.96094 10.8125L5.73438 11.5508L6.90625 11.6914ZM6.97656 10.4492L6.21484 10.332L6.03906 9.62891V4.01562L6.15625 3.37109L6.97656 3.24219H9.97656L10.7969 3.37109L10.9141 4.0625V9.67578L10.75 10.332L9.97656 10.4492H6.97656ZM20.0078 17C18.9531 17 18.0391 16.8008 17.2656 16.4023C16.4922 15.9961 15.8906 15.4531 15.4609 14.7734C15.0391 14.0938 14.8281 13.3477 14.8281 12.5352V5.41016C14.8281 4.58984 15.0391 3.84375 15.4609 3.17188C15.8906 2.49219 16.4922 1.95312 17.2656 1.55469C18.0391 1.14844 18.9531 0.945312 20.0078 0.945312H23.6172C24.6719 0.945312 25.5859 1.14844 26.3594 1.55469C27.1406 1.95312 27.7422 2.49219 28.1641 3.17188C28.5859 3.84375 28.7969 4.58984 28.7969 5.41016V12.5352C28.7969 13.3477 28.5859 14.0938 28.1641 14.7734C27.7422 15.4531 27.1406 15.9961 26.3594 16.4023C25.5859 16.8008 24.6719 17 23.6172 17H20.0078ZM20.9922 11.6914H23.9219L25.1055 11.5508L25.8672 10.8125L26.0312 9.80469V6.72266H22.6328V7.97656H24.7891V9.62891C24.75 9.75391 24.7227 9.87109 24.707 9.98047C24.6914 10.0898 24.6641 10.207 24.625 10.332L23.8516 10.4492H21.0156L20.3008 10.332L20.1367 9.58203V4.03906L20.2539 3.39453L21.0156 3.21875H24.0625L25.2695 3.41797L25.5039 2.16406L24.1445 2H20.9922L19.7969 2.1875L19.0469 2.9375L18.8828 3.92188V9.80469L19.0469 10.8125L19.8203 11.5508L20.9922 11.6914Z"
            fill="black"
          />
        </svg>
        <span className="font-medium -mt-1 text-center">
          Generate an open api spec from your documentation url.
        </span>
      </div>
      <div className="space-y-4 p-4 md:bg-white/50 md:p-2 md:backdrop:blur md:rounded-xl">
        <div className="flex gap-2 items-start">
          <div className="relative flex-1" ref={comboboxRef}>
            <div className="relative">
              <input
                type="text"
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setSelectedUrl("");
                  if (!isOpen) setIsOpen(true);
                }}
                onClick={() => setIsOpen(true)}
                placeholder="Search or enter API documentation URL..."
                className="w-full px-4 py-2 font-mono pr-8 rounded-md shadow-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:ring-[hsl(240,5%,64.9%,0.5)] border"
              />
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                type="button"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {isOpen && (
              <div className="absolute w-full mt-1 bg-white border rounded-md shadow-lg z-10 max-h-60 overflow-auto">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <button
                      key={option.value}
                      className="w-full px-4 py-2 font-mono text-left hover:bg-gray-100 flex items-center space-x-2"
                      onClick={() => {
                        setInputValue(option.value);
                        setSelectedUrl(option.value);
                        setIsOpen(false);
                      }}
                      type="button"
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="text-sm text-gray-500">
                        {option.value}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2 text-gray-500 text-sm">
                    Press Enter to use this URL
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || !inputValue}
            className="px-4 py-2 border bg-black/90 rounded-lg text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            {loading ? (
              <span>
                Generating{" "}
                <span className="animate-ellipsis">
                  <span className="inline-block animate-bounce [animation-delay:-0.3s]">
                    .
                  </span>
                  <span className="inline-block animate-bounce [animation-delay:-0.2s]">
                    .
                  </span>
                  <span className="inline-block animate-bounce [animation-delay:-0.1s]">
                    .
                  </span>
                </span>
              </span>
            ) : (
              "Generate"
            )}
          </button>
          {status === "successful" && !isProduction ? (
            <Button
              variant="secondary"
              onClick={triggerPR}
              className="border"
              // className="px-4 py-2 bg-black/90 rounded-lg text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              <GitPullRequest />
              {prLoading ? (
                <span>
                  Creating{" "}
                  <span className="animate-ellipsis">
                    <span className="inline-block animate-bounce [animation-delay:-0.3s]">
                      .
                    </span>
                    <span className="inline-block animate-bounce [animation-delay:-0.2s]">
                      .
                    </span>
                    <span className="inline-block animate-bounce [animation-delay:-0.1s]">
                      .
                    </span>
                  </span>
                </span>
              ) : (
                "Create PR"
              )}
            </Button>
          ) : null}

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline" className="border" type="button">
                <span>Logs</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
                  />
                </svg>
              </Button>
            </DrawerTrigger>
            <DrawerContent className=" ">
              <DrawerHeader>
                <DrawerTitle>Logs</DrawerTitle>
                <DrawerDescription>
                  View the logs for the last run.
                </DrawerDescription>
              </DrawerHeader>
              <div className="p-4 min-h-[200px] max-h-[80vh] overflow-auto">
                {logs.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {logs.map((log, idx) => (
                      <Accordion key={idx} type="single" collapsible>
                        <AccordionItem value={`log-${idx}`}>
                          <AccordionTrigger className="bg-slate-100 hover:bg-slate-200 transition-colors duration-200 p-4 rounded-md border-none hover:no-underline">
                            <span className="font-mono text-sm">
                              {log.type} : {log.message} :{" "}
                              {new Date(
                                (log as any)?.createdAt!
                              ).toLocaleString()}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="bg-slate-150 p-4 max-w-full max-h-[300px] overflow-auto">
                            {JSON.stringify(log, null, 4)}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    No logs currently.
                  </div>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        {error && (
          <Alert className="bg-red-50 border-red-200 text-red-800 p-4 rounded-md">
            <AlertDescription className="font-mono">{error}</AlertDescription>
          </Alert>
        )}

        {prUrl && (
          <Alert className="bg-green-50 border-green-200 text-green-800 p-4 rounded-md">
            <AlertDescription className="font-mono">
              PR created successfully.{" "}
              <Link className="cursor-pointer" href={prUrl} target="_blank">
                {prUrl}
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {status === "successful" && openApiSpec && (
          <CodeBlock value={openApiSpec} language="yaml" />
        )}
      </div>
    </section>
  );
};

export default OpenApiGenerator;
