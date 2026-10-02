"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether `query` matches, or `null` on the server and during hydration.
 *
 * `null` rather than a guess: the server cannot know the viewport, and a guess
 * that turns out wrong swaps the whole layout under the user's thumb. Callers
 * render a neutral first paint for `null` instead. Same shape as
 * `useIsHydrated`, and for the same reason — no `useState` + `useEffect`.
 */
export function useMediaQuery(query: string): boolean | null {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => null,
  );
}
