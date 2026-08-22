import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";

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

export type PushState =
  | "unsupported"
  | "denied"
  | "prompt"
  | "subscribed"
  | "loading";

export function usePushNotifications() {
  const { getToken } = useAuth();
  const [state, setState] = useState<PushState>("loading");

  const saveSubscription = useCallback(
    async (sub: PushSubscription) => {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ||
            "Failed to save notification subscription",
        );
    },
    [getToken],
  );

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
          await saveSubscription(sub);
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
  }, [saveSubscription]);

  useEffect(() => {
    if (state !== "subscribed") return;
    let cancelled = false;
    const runReminders = async () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      try {
        const token = await getToken();
        const response = await fetch(`${API_BASE}/api/push/send-reminders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Reminder service is unavailable");
      } catch (error) {
        console.warn("Reminder check failed:", error);
      }
    };
    void runReminders();
    const interval = window.setInterval(runReminders, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [getToken, state]);

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
      await saveSubscription(sub);
      setState("subscribed");
    } catch (err) {
      console.error("Push subscribe error:", err);
      setState(
        Notification.permission === "granted" ? "unsupported" : "prompt",
      );
    }
  }, [saveSubscription]);

  const unsubscribe = useCallback(async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const token = await getToken();
        const response = await fetch(`${API_BASE}/api/push/unsubscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        if (!response.ok)
          throw new Error("Failed to remove notification subscription");
        await sub.unsubscribe();
      }
      setState("prompt");
    } catch (err) {
      console.error("Push unsubscribe error:", err);
      setState("subscribed");
    }
  }, [getToken]);

  return { state, subscribe, unsubscribe };
}
