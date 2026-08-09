import { useState, useEffect, useCallback } from "react";
import { getCalendarToken } from "@/lib/calendar-token";

const BASE_URL = import.meta.env.BASE_URL || "/";
const API_BASE = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

async function getVapidKey(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/push/vapid-key`);
  if (!res.ok) throw new Error("Failed to fetch VAPID key");
  const { publicKey } = await res.json();
  return publicKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushState = "unsupported" | "denied" | "prompt" | "subscribed" | "loading";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");

  useEffect(() => {
    let cancelled = false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const refreshState = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (sub) {
          setState("subscribed");
          return;
        }

        // Do not ask for browser permission unless the server can finish the
        // subscription. This prevents an endless enable prompt on mobile.
        await getVapidKey();
        if (!cancelled) setState("prompt");
      } catch (err) {
        console.warn("Push notifications are not configured:", err);
        if (!cancelled) setState("unsupported");
      }
    };

    void refreshState();
    const refreshAfterResume = () => {
      if (document.visibilityState === "visible") void refreshState();
    };
    document.addEventListener("visibilitychange", refreshAfterResume);
    window.addEventListener("pageshow", refreshAfterResume);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", refreshAfterResume);
      window.removeEventListener("pageshow", refreshAfterResume);
    };
  }, []);

  const subscribe = useCallback(async () => {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const vapidKey = await getVapidKey();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const calendarToken = getCalendarToken();
      const subJson = sub.toJSON();
      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subJson, calendarToken }),
      });
      setState("subscribed");
    } catch (err) {
      console.error("Push subscribe error:", err);
      setState(Notification.permission === "granted" ? "unsupported" : "prompt");
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API_BASE}/api/push/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("prompt");
    } catch (err) {
      console.error("Push unsubscribe error:", err);
      setState("subscribed");
    }
  }, []);

  return { state, subscribe, unsubscribe };
}
