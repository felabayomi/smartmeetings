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

function subscriptionUsesKey(
  subscription: PushSubscription,
  expectedKey: Uint8Array,
): boolean {
  const existingKey = subscription.options.applicationServerKey;
  if (!existingKey) return false;
  const existingBytes = new Uint8Array(existingKey);
  return (
    existingBytes.length === expectedKey.length &&
    existingBytes.every((value, index) => value === expectedKey[index])
  );
}

export type PushState =
  | "unsupported"
  | "denied"
  | "prompt"
  | "subscribed"
  | "loading";

export function usePushNotifications() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [state, setState] = useState<PushState>("loading");

  const saveSubscription = useCallback(
    async (sub: PushSubscription) => {
      if (!isLoaded || !isSignedIn) return false;
      const token = await getToken();
      if (!token) throw new Error("Authentication is temporarily unavailable");
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
      return true;
    },
    [getToken, isLoaded, isSignedIn],
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
        let sub = await reg.pushManager.getSubscription();
        if (cancelled) return;

        // A browser push subscription continues to work when a Clerk session
        // expires or the PWA is closed. Never remove it merely because the
        // user is temporarily signed out or offline.
        if (!isLoaded || !isSignedIn) {
          setState(
            sub && Notification.permission === "granted"
              ? "subscribed"
              : "prompt",
          );
          return;
        }

        const vapidKey = urlBase64ToUint8Array(await getVapidKey());
        if (sub) {
          if (!subscriptionUsesKey(sub, vapidKey)) {
            const token = await getToken();
            if (!token)
              throw new Error("Authentication is temporarily unavailable");
            await fetch(`${API_BASE}/api/push/unsubscribe`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: vapidKey.buffer as ArrayBuffer,
            });
          }
          await saveSubscription(sub);
          if (!cancelled) setState("subscribed");
          return;
        }

        // Do not ask for browser permission unless the server can finish the
        // subscription. This prevents an endless enable prompt on mobile.
        if (!cancelled) setState("prompt");
      } catch (err) {
        console.warn("Push notification check will retry:", err);
        if (cancelled) return;
        try {
          const reg = await navigator.serviceWorker.ready;
          const existing = await reg.pushManager.getSubscription();
          setState(
            existing && Notification.permission === "granted"
              ? "subscribed"
              : "prompt",
          );
        } catch {
          setState("prompt");
        }
      }
    };

    void refreshState();
    const refreshAfterResume = () => {
      if (document.visibilityState === "visible") void refreshState();
    };
    document.addEventListener("visibilitychange", refreshAfterResume);
    window.addEventListener("pageshow", refreshAfterResume);
    window.addEventListener("focus", refreshAfterResume);
    window.addEventListener("online", refreshAfterResume);
    const repairInterval = window.setInterval(refreshState, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", refreshAfterResume);
      window.removeEventListener("pageshow", refreshAfterResume);
      window.removeEventListener("focus", refreshAfterResume);
      window.removeEventListener("online", refreshAfterResume);
      window.clearInterval(repairInterval);
    };
  }, [getToken, isLoaded, isSignedIn, saveSubscription]);

  useEffect(() => {
    if (state !== "subscribed" || !isSignedIn) return;
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
  }, [getToken, isSignedIn, state]);

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
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
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
