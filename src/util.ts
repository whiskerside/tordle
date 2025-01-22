import dictionary from "./dictionary.json";
import { Buffer } from "buffer";

export enum Difficulty {
  Normal,
  Hard,
  UltraHard,
}

export const gameName = "Today's Wordle";
export const maxGuesses = 6;

export const dictionarySet: Set<string> = new Set(dictionary);

export function mulberry32(a: number) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function urlParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export const seed = Number(urlParam("seed"));

// Add this function to get today's seed consistently
export function getTodaysSeed(): number {
  const now = new Date();
  const dateStr =
    now.getUTCFullYear().toString() +
    (now.getUTCMonth() + 1).toString().padStart(2, "0") +
    now.getUTCDate().toString().padStart(2, "0");
  return Number(dateStr);
}

// Modify makeRandom to always use today's seed unless in challenge mode
export const makeRandom = () => {
  if (urlParam("challenge")) {
    return () => Math.random();
  }
  return mulberry32(getTodaysSeed());
};

export let random = makeRandom();

export function resetRng(): void {
  random = makeRandom();
}

export function pick<T>(array: Array<T>): T {
  return array[Math.floor(array.length * random())];
}

// https://a11y-guidelines.orange.com/en/web/components-examples/make-a-screen-reader-talk/
export function speak(
  text: string,
  priority: "polite" | "assertive" = "assertive"
) {
  var el = document.createElement("div");
  var id = "speak-" + Date.now();
  el.setAttribute("id", id);
  el.setAttribute("aria-live", priority || "polite");
  el.classList.add("sr-only");
  document.body.appendChild(el);

  window.setTimeout(function () {
    document.getElementById(id)!.innerHTML = text;
  }, 100);

  window.setTimeout(function () {
    document.body.removeChild(document.getElementById(id)!);
  }, 1000);
}

export function ordinal(n: number): string {
  return n + (["st", "nd", "rd"][(n % 100 >> 3) ^ 1 && n % 10] || "th");
}

export const englishNumbers =
  "zero one two three four five six seven eight nine ten eleven".split(" ");

export function describeSeed(seed: number): string {
  const year = Math.floor(seed / 10000);
  const month = Math.floor(seed / 100) % 100;
  const day = seed % 100;
  const isLeap = year % (year % 25 ? 4 : 16) === 0;
  const feb = isLeap ? 29 : 28;
  const days = [0, 31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year >= 2000 &&
    year <= 2100 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month]
  ) {
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } else {
    return "seed " + seed;
  }
}

export function setRandom(newRandom: () => number) {
  random = newRandom;
}

// Encoded sequence for keyboard shortcut (original: ['KeyT', 'KeyW', 'KeyH'])
const encoder = (str: string) =>
  Buffer.from(
    str
      .split("")
      .map((c) => String.fromCharCode(c.charCodeAt(0) ^ 0x7f))
      .join("")
  ).toString("base64");
const decoder = (str: string) =>
  Buffer.from(str, "base64")
    .toString()
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) ^ 0x7f))
    .join("");

// Encoded sequence
const ENCODED_SEQUENCE = encoder(JSON.stringify(["KeyT", "KeyW", "KeyH"]));

// Decoder function for the game
export const getSecretSequence = (): string[] => {
  try {
    return JSON.parse(decoder(ENCODED_SEQUENCE));
  } catch {
    return ["KeyX"]; // Fallback sequence that will never match
  }
};
