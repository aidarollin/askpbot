"use client";

import { Btn } from "./ds";

/**
 * A plain button that opens the panel. Deliberately does not import the panel
 * or share state with it — it dispatches the same `pbot-open` event any host
 * page would, which is the whole integration surface.
 */
export function PBotLauncher() {
  return (
    <Btn
      variant="primary"
      size="l"
      iconEnd="chevron-btn-m"
      onClick={() => window.dispatchEvent(new CustomEvent("pbot-open"))}
    >
      Ask PBot
    </Btn>
  );
}
