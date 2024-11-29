import OpenApiGenerator from "@/components/open-api-spec-generator";

export const maxDuration = 300;

export default function Home() {
  return (
    <main>
      <div className="min-h-screen w-screen fixed z-10 flex justify-center">
        <div className="absolute z-20 w-full h-full top-0 bg-[radial-gradient(circle,rgba(2,0,36,0)_0,_#fafafa_100%)]"></div>
        <div className="bg-grid z-10 absolute w-full h-full top-0 opacity-40 invert"></div>
        <div className="z-30 w-full gradient absolute h-full blur-[100px] saturate-[150%] top-[80px] opacity-[0.15]"></div>
      </div>
      <div className="relative z-50">
        <OpenApiGenerator />
      </div>
      <footer className="z-50 fixed bottom-2 -translate-x-1/2 left-1/2 w-fit mx-auto py-1 bg-gray-100 duration-300 ease-out transition-all rounded-full px-2 border-[hsla(256,2%,99%,.08)] justify-center items-center font-medium border text-sm">
        <div className="flex gap-2">
          <a
            href="https://github.com/mastra-ai/examples/tree/main/bird-checker"
            target="_blank"
            className="uppercase inline-flex items-center h-4 rounded-full text-black px-1.5 leading-tight tracking-widest text-[9px] bg-gray-50 font-semibold"
          >
            see the code
          </a>
          <span className="text-xs text-black font-semibold">
            Built with{" "}
            <a href="https://mastra.ai/" className="underline" target="_blank">
              Mastra.ai
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}
