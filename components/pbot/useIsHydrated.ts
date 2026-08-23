"use client";

import { useSyncExternalStore } from "react";

/**
 * True once hydrated, false on the server.
 *
 * `useSyncExternalStore` with a never-firing subscription is the canonical way
 * to ask this: the server snapshot is false and the client snapshot is true, so
 * React handles the transition itself. The older `useState` + `useEffect`
 * pattern does the same thing by triggering a second render, which React 19's
 * lint correctly flags as a cascading render.
 *
 * Used to gate anything whose first paint would otherwise differ between server
 * and client — the panel's portal, and the web sidebar's localStorage-backed
 * history list.
 */
const neverChanges = () => () => {};

export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
}
