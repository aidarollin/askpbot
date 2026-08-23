import { PBotLauncher } from "@/components/pbot/PBotLauncher";
import { PBotMascot } from "@/components/pbot/PBotMascot";
import { PBotPanel } from "@/components/pbot/PBotPanel";

/**
 * The embeddable variant, and a host page for it to dock over.
 *
 * The product itself is the web layout at `/`. This route exists because the
 * panel is the form AskPBot takes inside another application, and `pbot-open`
 * is a public contract: a host app renders one component and fires one event.
 * Keeping the panel on a real route means that contract stays exercised rather
 * than rotting as unrendered code.
 */
export default function EmbedDemo() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-accent text-sm font-semibold tracking-wide uppercase">
        Embeddable variant
      </p>

      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        Ask PBot, docked 🐼
      </h1>

      <p className="text-muted mt-4 max-w-xl text-lg leading-relaxed">
        The same assistant as the main app, delivered as a slide-in panel that
        overlays a host application. This page stands in for that host — on its
        own there would be nothing to overlay.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <PBotLauncher />
        <span className="text-muted text-sm">or press the panda, bottom-right</span>
      </div>

      <div className="border-border bg-surface mt-12 rounded-2xl border p-5">
        <h2 className="text-sm font-semibold">Dropping it into a host app</h2>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Render <code className="font-mono">&lt;PBotPanel /&gt;</code> once at
          the app root. Anything, anywhere, can then open it — no props, no
          context, no import:
        </p>
        <pre className="bg-surface-muted mt-3 overflow-x-auto rounded-xl p-3 font-mono text-xs">
          window.dispatchEvent(new CustomEvent(&quot;pbot-open&quot;))
        </pre>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          That is the same contract the original Blade/Alpine component used, so
          an existing host page keeps working unchanged.
        </p>
      </div>

      <p className="text-muted mt-10 text-xs">
        Esc, the scrim, or the X closes the panel. Conversations are stored in
        this browser only, and are shared with the main app.
      </p>

      <PBotMascot />
      <PBotPanel side="right" />
    </main>
  );
}
