import { useEffect, useRef, useState, useCallback } from "react";
import { Row, RowState } from "./Row";
import dictionary from "./dictionary.json";
import { Clue, clue, describeClue, violation } from "./clue";
import { Keyboard } from "./Keyboard";
import targetList from "./targets.json";
import {
  // describeSeed,
  dictionarySet,
  Difficulty,
  // gameName,
  pick,
  resetRng,
  seed,
  speak,
  urlParam,
  getTodaysSeed,
  mulberry32,
  setRandom,
} from "./util";
import { decode } from "./base64";

enum GameState {
  Playing,
  Won,
  Lost,
}

interface GameProps {
  maxGuesses: number;
  hidden: boolean;
  difficulty: Difficulty;
  colorBlind: boolean;
  keyboardLayout: string;
}

const targets = targetList.slice(0, targetList.indexOf("murky") + 1); // Words no rarer than this one
const minLength = 4;
const defaultLength = 5;
const maxLength = 11;
const limitLength = (n: number) =>
  n >= minLength && n <= maxLength ? n : defaultLength;

function randomTarget(wordLength: number): string {
  const eligible = targets.filter((word) => word.length === wordLength);
  let candidate: string;
  do {
    candidate = pick(eligible);
  } while (/\*/.test(candidate));

  // Add logging for today's word
  if (!urlParam("challenge")) {
    console.log(
      `Today's word (${new Date().toLocaleDateString()}):`,
      candidate
    );
  }

  return candidate;
}

// function getChallengeUrl(target: string): string {
//   return (
//     window.location.origin +
//     window.location.pathname +
//     "?challenge=" +
//     encode(target)
//   );
// }

let initChallenge = "";
let challengeError = false;
try {
  initChallenge = decode(urlParam("challenge") ?? "").toLowerCase();
} catch (e) {
  console.warn(e);
  challengeError = true;
}
if (initChallenge && !dictionarySet.has(initChallenge)) {
  initChallenge = "";
  challengeError = true;
}

function parseUrlLength(): number {
  const lengthParam = urlParam("length");
  if (!lengthParam) return defaultLength;
  return limitLength(Number(lengthParam));
}

function parseUrlGameNumber(): number {
  const gameParam = urlParam("game");
  if (!gameParam) return 1;
  const gameNumber = Number(gameParam);
  return gameNumber >= 1 && gameNumber <= 1000 ? gameNumber : 1;
}

function Game(props: GameProps) {
  const [gameState, setGameState] = useState(GameState.Playing);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string>("");
  const [challenge, setChallenge] = useState<string>(initChallenge);
  const [wordLength, setWordLength] = useState(
    challenge ? challenge.length : parseUrlLength()
  );
  const [gameNumber, setGameNumber] = useState(parseUrlGameNumber());
  const [target, setTarget] = useState(() => {
    if (challenge) {
      return challenge;
    }
    resetRng();
    setRandom(mulberry32(getTodaysSeed()));
    return randomTarget(wordLength);
  });
  const [hint, setHint] = useState<string>(
    challengeError
      ? `Invalid challenge string, playing random game.`
      : `Make your first guess!`
  );
  const currentSeedParams = useCallback(
    () => `?seed=${seed}&length=${wordLength}&game=${gameNumber}`,
    [wordLength, gameNumber]
  );
  useEffect(() => {
    if (seed) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + currentSeedParams()
      );
    }
  }, [currentSeedParams]);
  const tableRef = useRef<HTMLTableElement>(null);
  const startNextGame = useCallback(() => {
    if (challenge) {
      // First clear the URL and challenge state
      window.history.replaceState({}, document.title, window.location.pathname);
      // Dispatch custom event for URL change
      window.dispatchEvent(new Event("replacestate"));
      setChallenge("");
      // Then reset RNG to today's seed
      resetRng();
      setRandom(mulberry32(getTodaysSeed()));
      // Finally set the new target
      setTarget(randomTarget(wordLength));
    }
    // Reset game state
    setGuesses([]);
    setCurrentGuess("");
    setGameState(GameState.Playing);
    // Set hint
    setHint(challenge ? "Make your first guess!" : "");
  }, [challenge, wordLength]);

  // async function share(copiedHint: string, text?: string) {
  //   const url = seed
  //     ? window.location.origin + window.location.pathname + currentSeedParams()
  //     : getChallengeUrl(target);
  //   const body = url + (text ? "\n\n" + text : "");
  //   if (
  //     /android|iphone|ipad|ipod|webos/i.test(navigator.userAgent) &&
  //     !/firefox/i.test(navigator.userAgent)
  //   ) {
  //     try {
  //       await navigator.share({ text: body });
  //       return;
  //     } catch (e) {
  //       console.warn("navigator.share failed:", e);
  //     }
  //   }
  //   try {
  //     await navigator.clipboard.writeText(body);
  //     setHint(copiedHint);
  //     return;
  //   } catch (e) {
  //     console.warn("navigator.clipboard.writeText failed:", e);
  //   }
  //   setHint(url);
  // }

  const onKey = useCallback(
    (key: string) => {
      if (document.querySelector(".modal")) {
        return; // Don't handle keyboard input when modal is open
      }

      if (gameState !== GameState.Playing) {
        if (key === "Enter") {
          startNextGame();
        }
        return;
      }
      if (guesses.length === props.maxGuesses) return;
      if (/^[a-z]$/i.test(key)) {
        setCurrentGuess((guess) =>
          (guess + key.toLowerCase()).slice(0, wordLength)
        );
        tableRef.current?.focus();
        setHint("");
      } else if (key === "Backspace") {
        setCurrentGuess((guess) => guess.slice(0, -1));
        setHint("");
      } else if (key === "Enter") {
        if (currentGuess.length !== wordLength) {
          setHint("Too short");
          return;
        }
        if (!dictionary.includes(currentGuess)) {
          setHint("Not a valid word");
          return;
        }
        for (const g of guesses) {
          const c = clue(g, target);
          const feedback = violation(props.difficulty, c, currentGuess);
          if (feedback) {
            setHint(feedback);
            return;
          }
        }
        setGuesses((guesses) => guesses.concat([currentGuess]));
        setCurrentGuess((guess) => "");

        const gameOver = (verbed: string) =>
          `You ${verbed}! The answer was ${target.toUpperCase()}. (Enter to ${
            challenge ? "play today's wordle" : "play again"
          })`;

        if (currentGuess === target) {
          setHint(gameOver("won"));
          setGameState(GameState.Won);
        } else if (guesses.length + 1 === props.maxGuesses) {
          setHint(gameOver("lost"));
          setGameState(GameState.Lost);
        } else {
          setHint("");
          speak(describeClue(clue(currentGuess, target)));
        }
      }
    },
    [
      gameState,
      currentGuess,
      guesses,
      props.maxGuesses,
      props.difficulty,
      target,
      wordLength,
      startNextGame,
      challenge,
    ]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        onKey(e.key);
      }
      if (e.key === "Backspace") {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onKey]);

  let letterInfo = new Map<string, Clue>();
  const tableRows = Array(props.maxGuesses)
    .fill(undefined)
    .map((_, i) => {
      const guess = [...guesses, currentGuess][i] ?? "";
      const cluedLetters = clue(guess, target);
      const lockedIn = i < guesses.length;
      if (lockedIn) {
        for (const { clue, letter } of cluedLetters) {
          if (clue === undefined) break;
          const old = letterInfo.get(letter);
          if (old === undefined || clue > old) {
            letterInfo.set(letter, clue);
          }
        }
      }
      return (
        <Row
          key={i}
          wordLength={wordLength}
          rowState={
            lockedIn
              ? RowState.LockedIn
              : i === guesses.length
              ? RowState.Editing
              : RowState.Pending
          }
          cluedLetters={cluedLetters}
        />
      );
    });

  return (
    <div className="Game" style={{ display: props.hidden ? "none" : "block" }}>
      {/* Temporarily hide the letters adjustment UI
      <div className="Game-options">
        <label htmlFor="wordLength">Letters:</label>
        <input
          type="range"
          min={minLength}
          max={maxLength}
          id="wordLength"
          disabled={
            gameState === GameState.Playing &&
            (guesses.length > 0 || currentGuess !== "" || challenge !== "")
          }
          value={wordLength}
          onChange={(e) => {
            const length = Number(e.target.value);
            resetRng();
            setGameNumber(1);
            setGameState(GameState.Playing);
            setGuesses([]);
            setCurrentGuess("");
            setTarget(randomTarget(length));
            setWordLength(length);
            setHint(`${length} letters`);
          }}
        ></input>
        <button
          style={{ flex: "0 0 auto" }}
          disabled={gameState !== GameState.Playing || guesses.length === 0}
          onClick={() => {
            setHint(
              `The answer was ${target.toUpperCase()}. (Enter to play again)`
            );
            setGameState(GameState.Lost);
            (document.activeElement as HTMLElement)?.blur();
          }}
        >
          Give up
        </button>
      </div>
      */}
      <table
        className="Game-rows"
        tabIndex={0}
        aria-label="Table of guesses"
        ref={tableRef}
      >
        <tbody>{tableRows}</tbody>
      </table>
      <p
        role="alert"
        style={{
          userSelect: /https?:/.test(hint) ? "text" : "none",
          whiteSpace: "pre-wrap",
        }}
      >
        {hint || `\u00a0`}
      </p>
      {challenge && (
        <div className="challenge-mode-indicator">
          You are playing a challenge game
        </div>
      )}
      {/* Temporarily hidden: Game mode indicator - will be used for future features
      <div className="Game-seed-info">
        {challenge
          ? "playing a challenge game"
          : seed
          ? `${describeSeed(seed)} — length ${wordLength}, game ${gameNumber}`
          : "playing a random game"}
      </div>
      */}

      {/* Temporarily hidden: Share functionality - will be implemented in future updates
      <p>
        <button
          onClick={() => {
            share("Link copied to clipboard!");
          }}
        >
          Share a link to this game
        </button>{" "}
        {gameState !== GameState.Playing && (
          <button
            onClick={() => {
              const emoji = props.colorBlind
                ? ["⬛", "🟦", "🟧"]
                : ["⬛", "🟨", "🟩"];
              const score = gameState === GameState.Lost ? "X" : guesses.length;
              share(
                "Result copied to clipboard!",
                `${gameName} ${score}/${props.maxGuesses}\n` +
                  guesses
                    .map((guess) =>
                      clue(guess, target)
                        .map((c) => emoji[c.clue ?? 0])
                        .join("")
                    )
                    .join("\n")
              );
            }}
          >
            Share emoji results
          </button>
        )}
      </p>
      */}
      <Keyboard
        layout={props.keyboardLayout}
        letterInfo={letterInfo}
        onKey={onKey}
      />
    </div>
  );
}

export default Game;
