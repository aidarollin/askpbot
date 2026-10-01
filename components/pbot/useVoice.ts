"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceNote } from "@/lib/types";

/**
 * Voice notes — the source engine's recorder (getUserMedia → MediaRecorder,
 * with an AnalyserNode drawing the live waveform), plus the one thing the
 * source never needed: a TRANSCRIPT. The source's replies are mocked; ours come
 * from a model that reads text, and no audio input exists on this API path. So
 * the browser's own speech recognition runs alongside the recorder, and what is
 * sent to PBot is the words. The clip is kept so the bubble can play it back.
 *
 * Speech recognition is the Web Speech API: Chrome, Edge and Safari have it,
 * Firefox does not. Where it is missing the mic says so instead of recording
 * something PBot can never hear. In Chrome the recognition itself runs on
 * Google's servers — that is the browser's implementation, not this app's
 * choice, and it is recorded in docs/SCOPE.md.
 *
 * Three things must always happen or the browser leaks, and `cleanup` owns all
 * three so no path can forget one: every track is stopped (or the tab keeps the
 * mic and its recording indicator), the AudioContext is closed, and every object
 * URL is revoked except the one handed to a sent message.
 */

/** The recognition surface used here. Not in TypeScript's DOM lib. */
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface VoiceTake {
  state: "recording" | "recorded";
  seconds: number;
  bars: number[];
  url: string | null;
}

/** Hard cap, as in the source. */
const MAX_SECONDS = 120;
/** The bubble draws this many bars; the composer keeps up to 36. */
const BUBBLE_BARS = 22;

/** Pick evenly across the take so its shape survives, not just its tail. */
function resample(bars: number[], n: number): number[] {
  if (!bars.length) return new Array(n).fill(4);
  return Array.from({ length: n }, (_, i) => bars[Math.min(bars.length - 1, Math.round((i * (bars.length - 1)) / (n - 1)))]);
}

export function useVoice() {
  const [take, setTake] = useState<VoiceTake | null>(null);
  const [error, setError] = useState("");

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const actx = useRef<AudioContext | null>(null);
  const raf = useRef(0);
  const ticker = useRef(0);
  const speech = useRef<Recognition | null>(null);
  const words = useRef<string[]>([]);
  // Resolves when recognition has delivered its last result — `stop()` asks for
  // it, but the final words arrive after, on `end`.
  const heard = useRef<Promise<void> | null>(null);
  // Mirrors `take` for the callbacks (recorder, analyser, ticker) that outlive
  // the render they were created in. Every write goes through `update`, so the
  // two cannot disagree.
  const takeRef = useRef<VoiceTake | null>(null);
  const update = useCallback((next: (t: VoiceTake | null) => VoiceTake | null) => {
    takeRef.current = next(takeRef.current);
    setTake(takeRef.current);
  }, []);

  const releaseMic = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (actx.current && actx.current.state !== "closed") void actx.current.close().catch(() => {});
    actx.current = null;
    rec.current = null;
  }, []);

  const cleanup = useCallback(
    (keepUrl: string | null) => {
      window.clearInterval(ticker.current);
      cancelAnimationFrame(raf.current);
      if (rec.current && rec.current.state !== "inactive") {
        try {
          rec.current.stop();
        } catch {
          /* already stopping */
        }
      }
      speech.current?.abort();
      speech.current = null;
      releaseMic();
      const url = takeRef.current?.url;
      if (url && url !== keepUrl) URL.revokeObjectURL(url);
      chunks.current = [];
      words.current = [];
      heard.current = null;
      update(() => null);
    },
    [releaseMic, update],
  );

  // Leaving the screen mid-take must still hand the microphone back.
  useEffect(() => () => cleanup(null), [cleanup]);

  const stop = useCallback(() => {
    window.clearInterval(ticker.current);
    cancelAnimationFrame(raf.current);
    update((t) => (t ? { ...t, state: "recorded" } : t));
    speech.current?.stop();
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    else releaseMic();
  }, [releaseMic, update]);

  const start = useCallback(async () => {
    if (takeRef.current) return;
    setError("");
    const Speech = recognitionCtor();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined" || !Speech) {
      setError("Voice notes need speech recognition, which this browser doesn't have. Try Chrome, Edge or Safari.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access was blocked. Allow it in your browser to record."
          : "No microphone was found.",
      );
      return;
    }

    update(() => ({ state: "recording", seconds: 0, bars: [], url: null }));
    chunks.current = [];
    words.current = [];

    const recorder = new MediaRecorder(stream.current);
    rec.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data?.size) chunks.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      update((t) => (t ? { ...t, url } : t));
      releaseMic();
    };
    recorder.start();

    const recognition = new Speech();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) words.current.push(e.results[i][0].transcript.trim());
      }
    };
    recognition.onerror = (e) => {
      // `no-speech` and `aborted` are ordinary outcomes; the empty-transcript
      // check at send time already covers them.
      if (e.error === "network") setError("Speech recognition is offline, so PBot can't hear this one. Try typing it.");
      else if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setError("Speech recognition was blocked, so PBot can't hear this one.");
    };
    heard.current = new Promise((resolve) => {
      recognition.onend = () => resolve();
    });
    speech.current = recognition;
    try {
      recognition.start();
    } catch {
      /* a second start throws; the first is still running */
    }

    // Live waveform from the real signal. Sampled every frame, committed every
    // ~120ms — a bar per frame scrolls far too fast to read.
    try {
      const ctx = new AudioContext();
      actx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream.current).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let last = 0;
      const tick = (now: number) => {
        if (takeRef.current?.state !== "recording") return;
        if (now - last > 120) {
          last = now;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          const rms = Math.sqrt(sum / buf.length);
          // 4px floor so silence still draws a rail; 19px ceiling, the DS range.
          const h = Math.max(4, Math.min(19, Math.round(4 + rms * 90)));
          update((t) => (t && t.state === "recording" ? { ...t, bars: [...t.bars, h].slice(-36) } : t));
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch {
      /* No analyser: the take still records, the rail just stays flat. */
    }

    ticker.current = window.setInterval(() => {
      update((t) => (t && t.state === "recording" ? { ...t, seconds: t.seconds + 1 } : t));
      if ((takeRef.current?.seconds ?? 0) >= MAX_SECONDS) stop();
    }, 1000);
  }, [releaseMic, stop, update]);

  /**
   * Ends the take and hands it over as a sendable note, or null with `error`
   * set when nothing was understood — sending a waveform PBot cannot read would
   * produce a reply to nothing.
   */
  const finish = useCallback(async (): Promise<{ transcript: string; note: VoiceNote } | null> => {
    const current = takeRef.current;
    if (!current) return null;
    if (current.state === "recording") stop();
    await heard.current;
    // The recorder's onstop sets the URL; give it the tick it needs.
    await new Promise((r) => setTimeout(r, 0));
    const latest = takeRef.current ?? current;
    const transcript = words.current.join(" ").replace(/\s+/g, " ").trim();
    if (!transcript) {
      cleanup(null);
      setError("PBot couldn't make out any words in that recording. Try again, or type your question.");
      return null;
    }
    const note: VoiceNote = {
      seconds: Math.max(1, latest.seconds),
      bars: resample(latest.bars, BUBBLE_BARS),
      ...(latest.url ? { url: latest.url } : {}),
    };
    cleanup(latest.url);
    return { transcript, note };
  }, [cleanup, stop]);

  return { take, error, setError, start, stop, finish, discard: () => cleanup(null) };
}

/**
 * Which clip is playing — one at a time, shared by the composer's take and
 * every bubble. Progress rides rAF, not `timeupdate`, which fires ~4x a second
 * and makes the playhead visibly stutter.
 */
export function usePlayback() {
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const player = useRef<HTMLAudioElement | null>(null);
  const raf = useRef(0);

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(raf.current);
    player.current?.pause();
    player.current = null;
    setPlayingUrl(null);
    setProgress(0);
  }, []);

  useEffect(() => stopPlayback, [stopPlayback]);

  const toggle = useCallback(
    (url: string | null | undefined) => {
      if (!url) return;
      if (player.current && playingUrl === url) {
        stopPlayback();
        return;
      }
      stopPlayback();
      const a = new Audio(url);
      player.current = a;
      setPlayingUrl(url);
      const tick = () => {
        if (player.current !== a) return;
        if (a.duration && Number.isFinite(a.duration)) setProgress(Math.min(1, a.currentTime / a.duration));
        raf.current = requestAnimationFrame(tick);
      };
      a.onended = stopPlayback;
      a.onerror = stopPlayback;
      a.play().then(() => (raf.current = requestAnimationFrame(tick)), stopPlayback);
    },
    [playingUrl, stopPlayback],
  );

  return {
    isPlaying: (url: string | null | undefined) => !!url && playingUrl === url,
    progress,
    toggle,
  };
}

/** m:ss, as the source's `clock()`. */
export function clock(seconds: number | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
