"use client";

import { Alignment, Fit, Layout, Rive, RuntimeLoader } from "@rive-app/canvas";
import { useEffect, useRef } from "react";

/**
 * PBot, animated — the source's `<x-rive file="pbot" artboard="PBot Waving">`.
 *
 * The runtime's WASM is served from `public/pbot/rive/`, not the unpkg CDN the
 * package defaults to: the source app goes CDN-free on purpose, and a third-party
 * fetch on every page load is a dependency this app does not otherwise have.
 * `scripts/pbot-design/sync.mjs` copies that file out of node_modules, which is
 * why `@rive-app/canvas` is pinned to an exact version — the JS and the WASM must
 * be the same build.
 *
 * Decorative everywhere it is used, so it renders aria-hidden.
 */

let wasmPointed = false;

interface PBotRiveProps {
  size: number;
  className?: string;
}

export function PBotRive({ size, className }: PBotRiveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!wasmPointed) {
      RuntimeLoader.setWasmUrl("/pbot/rive/rive.wasm");
      wasmPointed = true;
    }

    const rive = new Rive({
      src: "/pbot/rive/pbot.riv",
      canvas,
      artboard: "PBot Waving",
      stateMachines: "State Machine 1",
      autoplay: true,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
      onLoad: () => rive.resizeDrawingSurfaceToCanvas(),
    });

    // The CSS sizes the canvas, often responsively; keep the backing store in
    // step so PBot stays crisp. One resize per frame, however many fire.
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => rive.resizeDrawingSurfaceToCanvas());
    });
    ro.observe(canvas);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      rive.cleanup();
    };
  }, []);

  return <canvas ref={canvasRef} width={size} height={size} className={className} aria-hidden="true" />;
}
