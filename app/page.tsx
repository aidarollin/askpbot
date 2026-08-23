import { PBotWeb } from "@/components/pbot/PBotWeb";

/**
 * The product.
 *
 * AskPBot ships as a two-column web app: history in a persistent sidebar, hero
 * or conversation in the main column. The docked-panel variant it was first
 * ported as still exists and still works — it lives at /embed, which doubles as
 * the demonstration of the `pbot-open` integration contract.
 */
export default function Home() {
  return <PBotWeb />;
}
