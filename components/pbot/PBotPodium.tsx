"use client";

/**
 * The hero mascot on its podium.
 *
 * The source stacks three SVGs — `mascot/pbot.svg` standing on
 * `askpbot/podium-stage.svg` on `askpbot/podium.svg`. Those binaries were never
 * supplied, so the mascot is the same emoji placeholder used elsewhere in this
 * port and the base and stage are CSS discs at the source's geometry. The rise
 * on entry is real and lives in `globals.css`.
 *
 * Swap the three spans for <img> tags when the assets land; the geometry and
 * the animation are already correct, so nothing else moves.
 */
export function PBotPodium() {
  return (
    <div className="pbot-podium" aria-hidden="true">
      <span className="pbot-podium__mascot">
        <span className="pbot-podium__face">🐼</span>
      </span>
      <span className="pbot-podium__stage" />
      <span className="pbot-podium__base" />
    </div>
  );
}
