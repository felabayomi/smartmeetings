import { Link, Redirect } from "wouter";
import { useAuth } from "@clerk/react";
import { ArrowRight, BarChart3, CalendarCheck2, Camera, Clock3, Globe2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { InstallAppButton } from "@/components/install-app-button";

export default function Landing() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/app" />;

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-slate-950 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_75%_20%,rgba(99,102,241,.18),transparent_35%),radial-gradient(circle_at_20%_10%,rgba(45,212,191,.16),transparent_30%)] pointer-events-none" />
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <img src="/logo-transparent.png" alt="MeetMind" className="w-40 h-auto" />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/sign-in"><Button variant="ghost" className="rounded-xl">Sign in</Button></Link>
          <Link href="/sign-up"><Button className="rounded-xl px-5 shadow-lg shadow-primary/20">Get started</Button></Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-[1.05fr_.95fr] gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-4 py-2 text-sm font-semibold text-primary shadow-sm">
              <Sparkles className="w-4 h-4" /> Your schedule, made effortless
            </div>
            <h1 className="mt-7 text-5xl sm:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.02]">
              Never miss what <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-teal-500">matters next.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
              Turn screenshots into meetings, share instant-booking availability, find the best group time, and keep everything together in one private calendar.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link href="/sign-up"><Button size="lg" className="h-14 rounded-2xl px-7 text-base shadow-xl shadow-primary/25">Create your free account <ArrowRight className="w-5 h-5 ml-2" /></Button></Link>
              <Link href="/sign-in"><Button size="lg" variant="outline" className="h-14 rounded-2xl px-7 text-base bg-white/70">I already have an account</Button></Link>
              <InstallAppButton className="h-14 rounded-2xl px-7 bg-white/70" />
            </div>
            <p className="mt-4 text-sm text-slate-500 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Your meetings are isolated and secured to your account.</p>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-br from-primary/20 to-teal-400/20 blur-3xl rounded-full" />
            <div className="relative rounded-[2rem] bg-white/85 backdrop-blur-xl border border-white shadow-2xl shadow-indigo-200/50 p-5 sm:p-7 rotate-[1deg]">
              <div className="flex items-center justify-between pb-5 border-b">
                <div><p className="font-bold text-xl">Today</p><p className="text-slate-500 text-sm">Three things worth remembering</p></div>
                <div className="w-11 h-11 rounded-2xl bg-primary/10 grid place-items-center"><CalendarCheck2 className="text-primary" /></div>
              </div>
              <div className="space-y-4 mt-5">
                {[["09:30","Team planning","bg-indigo-500"],["13:00","Client review","bg-teal-500"],["16:15","Project follow-up","bg-amber-500"]].map(([time,title,color]) => (
                  <div key={title} className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm">
                    <div className={`w-2 h-12 rounded-full ${color}`} /><div className="w-14 font-semibold text-slate-500">{time}</div><div className="font-bold">{title}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-slate-950 text-white p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-white/10 grid place-items-center"><Camera className="w-5 h-5" /></div>
                <div><p className="font-semibold">Scan a meeting image</p><p className="text-sm text-slate-300">AI fills in the date, time, host, and link.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-24">
          <div className="text-center max-w-3xl mx-auto"><p className="font-semibold text-primary">One place for every way meetings happen</p><h2 className="mt-3 text-3xl sm:text-5xl font-display font-bold tracking-tight">Plan less. Meet smarter.</h2><p className="mt-4 text-lg text-slate-600">From a screenshot to a confirmed group time, MeetMind keeps the workflow simple and private.</p></div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              [Camera,"AI meeting scan","Upload a screenshot and let AI extract the date, host, link, and details.","bg-violet-100 text-violet-700"],
              [Clock3,"Instant booking","Publish only the hours you choose. Confirmed bookings appear immediately.","bg-emerald-100 text-emerald-700"],
              [BarChart3,"Group consensus","Create a Doodle-style poll, collect availability, and finalize the best time.","bg-amber-100 text-amber-700"],
              [Globe2,"Timezone aware","Bookers and participants see local time while the owner timezone stays authoritative.","bg-sky-100 text-sky-700"],
            ].map(([Icon,title,text,color]) => {
              const FeatureIcon = Icon as typeof Camera;
              return <article key={title as string} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className={`w-12 h-12 rounded-2xl grid place-items-center ${color}`}><FeatureIcon className="w-6 h-6"/></div><h3 className="mt-5 text-xl font-bold">{title as string}</h3><p className="mt-2 text-slate-600 leading-relaxed">{text as string}</p></article>;
            })}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-24">
          <div className="rounded-[2rem] bg-slate-950 text-white px-6 py-12 sm:p-14 grid lg:grid-cols-[1fr_auto] gap-8 items-center overflow-hidden relative"><div className="absolute right-0 top-0 w-80 h-80 bg-primary/30 blur-3xl rounded-full"/><div className="relative"><h2 className="text-3xl sm:text-4xl font-bold">Your calendar stays yours.</h2><p className="mt-3 text-slate-300 max-w-2xl text-lg">Public visitors see open booking times—not event names, attendees, notes, or anything else on your private calendar.</p></div><Link href="/sign-up" className="relative"><Button size="lg" className="h-14 rounded-2xl px-7">Start scheduling <ArrowRight className="ml-2 w-5 h-5"/></Button></Link></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
