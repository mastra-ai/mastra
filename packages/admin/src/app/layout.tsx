import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/sidebar";

const inter = Inter({ subsets: ["latin"] });


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="bg-main-bg grid h-full w-full grid-cols-[15rem_minmax(0,_1fr)] overflow-clip">
          <div className="z-20 h-full">
            <div className="h-full"><Sidebar/></div>
          </div>
          <div className="bg-window-bg grid place-items-center border-primary-border rounded-xs border-thin m-2 overflow-hidden border-solid">
            {children}
          </div> 
        </main>
       </body>
    </html>
  );
}
