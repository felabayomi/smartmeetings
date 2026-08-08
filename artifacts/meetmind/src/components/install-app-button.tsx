import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function InstallAppButton({ className = "" }: { className?: string }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    setInstalled(Boolean(standalone));
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const markInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", markInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", markInstalled); };
  }, []);

  if (installed) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setPrompt(null);
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast({
      title: isIos ? "Add MeetMind to your Home Screen" : "Install MeetMind",
      description: isIos ? "Tap the Share button, then choose “Add to Home Screen.”" : "Open your browser menu and choose “Install app” or “Add to Home screen.”",
    });
  }

  return <Button variant="outline" onClick={install} className={className}>{/iphone|ipad|ipod/i.test(navigator.userAgent) ? <Share className="mr-2 h-4 w-4"/> : <Download className="mr-2 h-4 w-4"/>}Install app</Button>;
}
