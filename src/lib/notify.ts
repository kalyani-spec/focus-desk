"use client";

/** Ask once, on a user gesture (Start), so session-end notifications can show. */
export function requestNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") void Notification.requestPermission();
}

export function notify(title: string, body?: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: "focus-desk-timer" });
  } catch {
    // Some browsers only allow notifications from a service worker; the sound still plays.
  }
}

let audio: AudioContext | undefined;

/** A soft two-note chime, generated so there's no audio file to load. */
export function chime() {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const now = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.22;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  } catch {
    // Audio blocked until the first user gesture; nothing to do.
  }
}
