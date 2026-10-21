import { createContext, useContext, type ReactNode } from "react";
import {
  usePushNotifications,
  type PushState,
} from "@/hooks/use-push-notifications";

type PushNotificationsValue = {
  state: PushState;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
};

const PushNotificationsContext = createContext<PushNotificationsValue | null>(
  null,
);

export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const notifications = usePushNotifications();

  return (
    <PushNotificationsContext.Provider value={notifications}>
      {children}
    </PushNotificationsContext.Provider>
  );
}

export function usePushNotificationsContext() {
  const context = useContext(PushNotificationsContext);
  if (!context) {
    throw new Error(
      "usePushNotificationsContext must be used inside PushNotificationsProvider",
    );
  }
  return context;
}
