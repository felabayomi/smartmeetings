const companyLinks = [
  ["Felentra", "https://felentra.com"],
  ["Felix Consult", "https://felixconsult.co"],
  ["Felix Platforms", "https://felixplatforms.com"],
];

const productLinks = [
  ["MeetMinder.app", "https://www.meetminder.app"],
  ["MeetMind.us", "https://www.meetmind.us"],
];

const informationLinks = [
  ["Terms of Use", "/terms"],
  ["Data Privacy", "/privacy"],
  ["How to Use", "/how-to-use"],
];

export function SiteFooter({ dark = false }: { dark?: boolean }) {
  return (
    <footer className={dark ? "border-t border-white/10 bg-slate-950 text-slate-300" : "border-t border-slate-200 bg-white/70 text-slate-600"}>
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 text-center text-sm sm:grid-cols-2 sm:text-left lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-medium">© {new Date().getFullYear()} The Felix Consulting Group. All rights reserved.</p>
          <nav aria-label="MeetMind websites" className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 sm:justify-start">
            {productLinks.map(([label, href]) => (
              <a key={href} href={href} target="_blank" rel="noreferrer" className="transition-colors hover:text-primary">{label}</a>
            ))}
          </nav>
        </div>
        <nav aria-label="Product information" className="flex flex-wrap content-start justify-center gap-x-4 gap-y-2 sm:justify-start">
          {informationLinks.map(([label, href]) => (
            <a key={href} href={href} className="font-medium transition-colors hover:text-primary">{label}</a>
          ))}
        </nav>
        <nav aria-label="Felix Consulting Group websites" className="flex flex-wrap content-start justify-center gap-x-4 gap-y-2 sm:justify-start">
          {companyLinks.map(([label, href]) => (
            <a key={href} href={href} target="_blank" rel="noreferrer" className="font-medium transition-colors hover:text-primary">{label}</a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
