import type { ReactNode } from "react";
import { ArrowLeft, CalendarCheck2 } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

const updated = "August 8, 2026";

function InformationPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f9ff] text-slate-950 flex flex-col">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <a href="/" className="flex items-center gap-2 font-bold text-slate-950" aria-label="MeetMind home">
            <CalendarCheck2 className="h-7 w-7 text-primary" /> MeetMind
          </a>
          <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back home
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 sm:py-14">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">MeetMind</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">{intro}</p>
          <p className="mt-3 text-sm text-slate-500">Last updated: {updated}</p>
          <div className="mt-9 space-y-8 text-[15px] leading-7 text-slate-700 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-950 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

export function TermsOfUse() {
  return <InformationPage title="Terms of Use" intro="These terms govern your access to and use of MeetMind, a service of The Felix Consulting Group.">
    <section><h2>Using MeetMind</h2><p>You may use MeetMind to manage meetings, publish availability, accept bookings, create scheduling polls, and use available AI-assisted features. You must provide accurate information, keep your account secure, and use the service only for lawful purposes.</p></section>
    <section><h2>Your account and content</h2><p>You are responsible for activity under your account and for meeting details, booking pages, poll content, files, and other information you submit. You retain ownership of your content and authorize us to process it only as needed to operate, secure, and improve the service.</p></section>
    <section><h2>Acceptable use</h2><p>Do not misuse the service, interfere with its operation, attempt unauthorized access, upload malicious or unlawful material, impersonate others, send spam, or use public booking links to harass or deceive people.</p></section>
    <section><h2>AI-assisted features</h2><p>AI-generated meeting details may be incomplete or inaccurate. Review dates, times, time zones, participants, links, and other extracted information before saving or relying on it.</p></section>
    <section><h2>Availability and changes</h2><p>We may update, suspend, or discontinue features and may restrict access when reasonably necessary for security, maintenance, legal compliance, or abuse prevention. We do not guarantee uninterrupted or error-free service.</p></section>
    <section><h2>Disclaimers and liability</h2><p>MeetMind is provided “as is” and “as available” to the extent permitted by law. The Felix Consulting Group is not responsible for missed meetings, scheduling conflicts, incorrect AI output, third-party service failures, or indirect or consequential losses.</p></section>
    <section><h2>Termination</h2><p>You may stop using MeetMind at any time. We may suspend or terminate accounts that violate these terms or create a security, legal, or operational risk.</p></section>
    <section><h2>Contact</h2><p>Questions about these terms may be sent to <a className="text-primary underline" href="mailto:arkgco@outlook.com">arkgco@outlook.com</a>.</p></section>
  </InformationPage>;
}

export function DataPrivacy() {
  return <InformationPage title="Data Privacy" intro="This notice explains what MeetMind collects, why it is used, and the choices available to account holders and booking participants.">
    <section><h2>Information we process</h2><ul><li>Account and authentication information provided through our sign-in provider.</li><li>Meetings, availability, booking-page settings, scheduling polls, and responses.</li><li>Names, email addresses, time zones, notes, and selected times submitted by bookers or poll participants.</li><li>Images you intentionally submit for AI meeting extraction and the extracted results.</li><li>Basic technical, security, and diagnostic information generated when the service is used.</li></ul></section>
    <section><h2>How information is used</h2><p>We use information to authenticate users, display calendars, prevent scheduling conflicts, complete bookings and polls, operate requested AI features, troubleshoot problems, secure the service, and comply with applicable obligations.</p></section>
    <section><h2>Service providers</h2><p>MeetMind relies on service providers for hosting, authentication, database storage, and optional AI processing. Information is shared with them only as needed to provide those functions. Images sent for AI extraction are transmitted to the configured AI provider when you choose that feature.</p></section>
    <section><h2>Public links</h2><p>A booking page exposes the account holder’s display name, configured availability, meeting duration, and time-zone information needed for scheduling. It does not intentionally expose private calendar event details. Poll links expose the poll information and aggregate responses required for group scheduling.</p></section>
    <section><h2>Storage and security</h2><p>Account data is stored in cloud systems rather than only on your device. We use reasonable technical safeguards, but no online system can guarantee absolute security. Keep public links and account credentials appropriately protected.</p></section>
    <section><h2>Your choices</h2><p>You may edit or delete meetings and change scheduling settings through the app. You may request access, correction, or deletion of other personal information by contacting us. A booking participant may also contact the booking-page owner about information submitted through that page.</p></section>
    <section><h2>Contact</h2><p>For privacy questions or data requests, contact <a className="text-primary underline" href="mailto:arkgco@outlook.com">arkgco@outlook.com</a>.</p></section>
  </InformationPage>;
}

export function HowToUse() {
  return <InformationPage title="How to Use MeetMind" intro="A practical guide to managing your calendar, sharing availability, booking meetings, and finding a group consensus.">
    <section><h2>1. Create or access your account</h2><p>Select Sign Up or Sign In. Your meetings, availability, booking profile, and polls are associated with your account and available across supported devices.</p></section>
    <section><h2>2. Add meetings</h2><p>From Calendar, choose New Meeting and enter the details. You can also choose Scan Image to extract meeting information from a screenshot, then review every field before saving.</p></section>
    <section><h2>3. Publish your availability</h2><p>Open Scheduling, enter the name shown to bookers, confirm the owner time zone, choose a meeting length and buffer, and set the days and hours you accept meetings. Save the page, then use Copy link or Share to send your public booking address.</p></section>
    <section><h2>4. Accept direct bookings</h2><p>A guest opening your booking link sees only open times, displayed in the guest’s time zone with your time zone identified. A selected open time is confirmed immediately and added to your MeetMind calendar.</p></section>
    <section><h2>5. Find a group consensus</h2><p>In Scheduling, create a group poll, propose at least two times, and share the poll link. Participants select the times that work for them. Review the totals and finalize the preferred time to add it to your calendar.</p></section>
    <section><h2>6. Install on a phone</h2><p>Open <a className="text-primary underline" href="https://www.meetminder.app">www.meetminder.app</a> in your mobile browser and choose Add to Home Screen or Install App. If you previously installed it from another domain, remove the older copy first.</p></section>
    <section><h2>Tips</h2><ul><li>Confirm your owner time zone before publishing availability.</li><li>Calendar event details remain private; public booking pages show open times rather than event titles.</li><li>Use one primary domain when sharing links to avoid confusing guests.</li><li>Review AI-extracted details before saving them.</li></ul></section>
  </InformationPage>;
}
