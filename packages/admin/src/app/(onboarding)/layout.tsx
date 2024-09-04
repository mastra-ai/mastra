function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-[#161616] relative grid h-full min-h-screen place-items-center">
      <div className="gradient-bg" />
      <div>
        <h1
          className="text-[28px] font-tasa"
          style={{
            background: 'linear-gradient(177deg, #FFF 2.82%, #999 176.55%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          arkwright
        </h1>
        <div
          style={{
            border: '1px solid rgba(52, 52, 52, 0.70)',
            background: 'rgba(26, 26, 26, 0.70)',
          }}
          className="rounded-[5px] mt-[25px] relative z-10"
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export default Layout;
