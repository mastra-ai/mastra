import localFont from 'next/font/local';

import '../global.css';

const geistSans = localFont({ src: './font/GeistVF.woff', variable: '--font-geist-sans' });
import { Analytics } from "@vercel/analytics/next"


export default function Nextra({ Component, pageProps }) {
  return (
    <>
      <style jsx global>{`
        html {
          font-family: ${geistSans.style.fontFamily};
        }
      `}</style>
     
      <main className={`${geistSans.variable} font-sans`}>
        <Component {...pageProps} />
      </main>
       <Analytics />
    </>
  );
}
