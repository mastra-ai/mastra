import React from 'react';

import Image from 'next/image';
import Link from 'next/link';

const WelcomePage = () => {
  return (
    <div
      className="w-[920px]"
      style={{
        background:
          'radial-gradient(174.23% 100% at 50% 100%, rgba(165, 250, 255, 0.10) 1.17%, rgba(165, 250, 255, 0.04) 23.76%, rgba(0, 0, 0, 0.00) 100%), rgba(26, 26, 26, 0.70)',
      }}
    >
      <div className="p-12 bg-[#D9D9D9]/[0.02] flex items-center gap-20">
        <div>
          <h2 className="text-[22px] font-tasa font-medium text-[#E6E6E6]">Welcome to Admin</h2>
          <p className="text-[13px] text-[#A6A6A6] mt-[14px]">
            Mastra Admin is a developer tool that helps you test integrations and sync data to your database. Mastra
            Admin helps you add integrations to third parties to YOUR app. Mastra Admin is a UI layer on top of your
            Mastra configuration file and workflows.
          </p>
        </div>
        <div className="flex-shrink-0">
          <Link
            href="/setup"
            style={{
              boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.09)',
            }}
            className="mt-3 border border-[#121212]/5 bg-white/[0.08] text-center text-[#E6E6E6] text-[13px] w-full py-2 px-4 rounded-[4px] hover:bg-white/[0.10] transition-colors duration-150"
          >
            Connect first integration
          </Link>
        </div>
      </div>

      <div className="flex py-6 justify-center items-center">
        <Image src="/images/onboarding-bg.svg" width={740} height={407} alt="onboarding" />
      </div>
    </div>
  );
};

export default WelcomePage;
