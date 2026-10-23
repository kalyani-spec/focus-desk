export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-6">
      <div className="flex flex-col gap-0.5">
        {subtitle && <span className="text-sm text-neutral-700">{subtitle}</span>}
        <h1 className="m-0 whitespace-nowrap text-[22px] font-semibold">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-w-0 animate-screen-in flex-col gap-6 px-9 pt-7 pb-16">{children}</main>
  );
}

export function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-16 text-center shadow-hairline">
      <span className="text-accent-700">{icon}</span>
      <p className="m-0 text-[15px] font-medium">{title}</p>
      <p className="m-0 max-w-sm text-[13px] text-neutral-700">{body}</p>
    </section>
  );
}
