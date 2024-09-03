function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-arkw-bg-1 relative grid h-full min-h-screen place-items-center">
      <div className="gradient-bg" />
      <div className="z-20 flex flex-col items-center gap-10">{children}</div>
    </section>
  );
}

export default Layout;
