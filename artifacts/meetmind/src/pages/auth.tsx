import type { ReactNode } from "react";
import { Link } from "wouter";
import { ShieldCheck, Sparkles } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export default function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.05fr] bg-[#f8f9ff]">
      <section className="hidden lg:flex relative overflow-hidden bg-slate-950 text-white p-14 flex-col justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(99,102,241,.42),transparent_35%),radial-gradient(circle_at_90%_75%,rgba(45,212,191,.25),transparent_32%)]" />
        <Link href="/" className="relative z-10"><img src="/logo-transparent.png" alt="MeetMind" className="w-44 brightness-0 invert" /></Link>
        <div className="relative z-10 max-w-lg">
          <Sparkles className="w-10 h-10 text-teal-300 mb-6" />
          <h1 className="text-5xl font-display font-bold leading-tight">A calmer way to stay ahead of every meeting.</h1>
          <p className="mt-5 text-lg text-slate-300 leading-relaxed">Your private calendar, AI image scanning, and timely reminders—available anywhere you sign in.</p>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="w-4 h-4 text-teal-300" /> Account-protected cloud storage</p>
      </section>
      <section className="flex flex-col min-h-screen">
        <header className="p-6 lg:p-8"><Link href="/"><img src="/logo-transparent.png" alt="MeetMind" className="w-40 lg:hidden" /></Link></header>
        <div className="flex-1 grid place-items-center px-5 pb-16">
          {children}
        </div>
        <SiteFooter />
      </section>
    </div>
  );
}
