import "./App.css";
import { maxGuesses, seed, urlParam, dictionarySet, pick } from "./util";
import Game from "./Game";
import { useEffect, useState } from "react";
import { About } from "./About";
import { encode } from "./base64";

function useSetting<T>(
  key: string,
  initial: T
): [T, (value: T | ((t: T) => T)) => void] {
  const [current, setCurrent] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initial;
    } catch (e) {
      return initial;
    }
  });
  const setSetting = (value: T | ((t: T) => T)) => {
    try {
      const v = value instanceof Function ? value(current) : value;
      setCurrent(v);
      window.localStorage.setItem(key, JSON.stringify(v));
    } catch (e) {}
  };
  return [current, setSetting];
}

const now = new Date();
const todaySeed =
  now.toLocaleDateString("en-US", { year: "numeric" }) +
  now.toLocaleDateString("en-US", { month: "2-digit" }) +
  now.toLocaleDateString("en-US", { day: "2-digit" });

function App() {
  type Page = "game" | "about" | "settings";
  const [page, setPage] = useState<Page>("game");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [dark, setDark] = useSetting<boolean>("dark", prefersDark);
  const [colorBlind, setColorBlind] = useSetting<boolean>("colorblind", false);
  const [difficulty, setDifficulty] = useSetting<number>("difficulty", 0);
  const [keyboard, setKeyboard] = useSetting<string>(
    "keyboard",
    "qwertyuiop-asdfghjkl-BzxcvbnmE"
  );
  const [enterLeft, setEnterLeft] = useSetting<boolean>("enter-left", false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeOptions, setChallengeOptions] = useState<string[]>([]);

  useEffect(() => {
    document.body.className = dark ? "dark" : "";
    if (urlParam("today") !== null || urlParam("todas") !== null) {
      document.location = "?seed=" + todaySeed;
    }
    setTimeout(() => {
      // Avoid transition on page load
      document.body.style.transition = "0.3s background-color ease-out";
    }, 1);
  }, [dark]);

  const link = (emoji: string, label: string, page: Page) => (
    <button
      className="emoji-link"
      onClick={() => setPage(page)}
      title={label}
      aria-label={label}
    >
      {emoji}
    </button>
  );

  const CHALLENGE_OPTIONS_COUNT = 5;

  const openChallengeModal = () => {
    const options: string[] = [];
    const words = Array.from(dictionarySet).filter((word) => word.length === 5);
    while (options.length < CHALLENGE_OPTIONS_COUNT) {
      const word = pick(words);
      if (!options.includes(word)) {
        options.push(word);
      }
    }
    setChallengeOptions(options);
    setShowChallengeModal(true);
  };

  const createChallenge = (word: string) => {
    const challengeUrl = `${window.location.origin}${
      window.location.pathname
    }?challenge=${encode(word)}`;
    navigator.clipboard.writeText(challengeUrl);
    alert("Challenge link copied to clipboard!");
    setShowChallengeModal(false);
  };

  return (
    <div className="App">
      <div className={`App-container${colorBlind ? " color-blind" : ""}`}>
        <h1>Today's Wordle</h1>
        <div className="top-left">
          <button className="emoji-link" onClick={openChallengeModal}>
            🎯
          </button>
        </div>
        <div className="top-right">
          {page !== "game" ? (
            link("❌", "Close", "game")
          ) : (
            <>
              {link("❓", "About", "about")}
              {link("⚙️", "Settings", "settings")}
            </>
          )}
        </div>
        {page === "about" && <About />}
        {page === "settings" && (
          <div className="Settings">
            <div className="Settings-setting">
              <input
                id="dark-setting"
                type="checkbox"
                checked={dark}
                onChange={() => setDark((x: boolean) => !x)}
              />
              <label htmlFor="dark-setting">Dark theme</label>
            </div>
            <div className="Settings-setting">
              <input
                id="colorblind-setting"
                type="checkbox"
                checked={colorBlind}
                onChange={() => setColorBlind((x: boolean) => !x)}
              />
              <label htmlFor="colorblind-setting">High-contrast colors</label>
            </div>
            <div className="Settings-setting">
              <input
                id="difficulty-setting"
                type="range"
                min="0"
                max="2"
                value={difficulty}
                onChange={(e) => setDifficulty(+e.target.value)}
              />
              <div>
                <label htmlFor="difficulty-setting">Difficulty:</label>
                <strong>{["Normal", "Hard", "Ultra Hard"][difficulty]}</strong>
                <div
                  style={{
                    fontSize: 14,
                    height: 40,
                    marginLeft: 8,
                    marginTop: 8,
                  }}
                >
                  {
                    [
                      `Guesses must be valid dictionary words.`,
                      `Wordle's "Hard Mode". Green letters must stay fixed, and yellow letters must be reused.`,
                      `An even stricter Hard Mode. Yellow letters must move away from where they were clued, and gray clues must be obeyed.`,
                    ][difficulty]
                  }
                </div>
              </div>
            </div>
            <div className="Settings-setting">
              <label htmlFor="keyboard-setting">Keyboard layout:</label>
              <select
                name="keyboard-setting"
                id="keyboard-setting"
                value={keyboard}
                onChange={(e) => setKeyboard(e.target.value)}
              >
                <option value="qwertyuiop-asdfghjkl-BzxcvbnmE">QWERTY</option>
                <option value="azertyuiop-qsdfghjklm-BwxcvbnE">AZERTY</option>
                <option value="qwertzuiop-asdfghjkl-ByxcvbnmE">QWERTZ</option>
                <option value="BpyfgcrlE-aoeuidhtns-qjkxbmwvz">Dvorak</option>
                <option value="qwfpgjluy-arstdhneio-BzxcvbkmE">Colemak</option>
              </select>
              <input
                style={{ marginLeft: 20 }}
                id="enter-left-setting"
                type="checkbox"
                checked={enterLeft}
                onChange={() => setEnterLeft((x: boolean) => !x)}
              />
              <label htmlFor="enter-left-setting">"Enter" on left side</label>
            </div>
          </div>
        )}
        <Game
          maxGuesses={maxGuesses}
          hidden={page !== "game"}
          difficulty={difficulty}
          colorBlind={colorBlind}
          keyboardLayout={keyboard.replaceAll(
            /[BE]/g,
            (x) => (enterLeft ? "EB" : "BE")["BE".indexOf(x)]
          )}
        />

        {showChallengeModal && (
          <div className="modal">
            <div className="modal-content">
              <h2>Create Challenge</h2>
              <p>Select a word to create a challenge:</p>
              <div className="challenge-options">
                {challengeOptions.map((word) => (
                  <button
                    key={word}
                    onClick={() => createChallenge(word)}
                    className="challenge-word-button"
                  >
                    {word}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowChallengeModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
