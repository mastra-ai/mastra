import { Suspense } from "react";
import { BirdChecker } from "./components/bird-checker";

const Page = () => {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <div className="h-screen w-screen fixed z-10 flex justify-center">
        <div className="absolute z-20 w-full h-full top-0 bg-[radial-gradient(circle,rgba(2,0,36,0)_0,_#fafafa_100%)]"></div>
        <div className="z-30 w-full gradient absolute h-full blur-[100px] saturate-[150%] top-[80px] opacity-[0.15]"></div>
      </div>
      <div className="relative z-50">
        <BirdChecker />
      </div>
    </Suspense>
  );
};

export default Page;
