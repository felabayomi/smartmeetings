export function SiteFooter({ dark = false }: { dark?: boolean }) {
  const links = [
    ["Felentra", "https://felentra.com"],
    ["Felix Consult", "https://felixconsult.co"],
    ["Felix Platforms", "https://felixplatforms.com"],
  ];

  return (
    <footer className={dark ? "border-t border-white/10 bg-slate-950 text-slate-300" : "border-t border-slate-200 bg-white/70 text-slate-600"}>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-7 text-center text-sm sm:flex-row sm:text-left">
        <p>© {new Date().getFullYear()} The Felix Consulting Group. All rights reserved.</p>
        <nav aria-label="Felix Consulting Group websites" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {links.map(([label, href]) => (
            <a key={href} href={href} target="_blank" rel="noreferrer" className="font-medium transition-colors hover:text-primary">{label}</a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
