const sampleScript = `안녕하세요. 오늘은 문장 단위로 넘어가는 프롬프터를 테스트해보겠습니다.

짧은 문장은 잠깐만 보여줍니다.

조금 긴 문장은 읽는 데 시간이 더 필요하니까, 글자 수에 맞춰 더 오래 화면에 남아 있습니다.

카메라가 노트북 왼쪽 위에 있으면 표시 위치를 좌상단으로 옮기고, 외장 카메라가 오른쪽 위에 있으면 우상단으로 바꿔보세요.`;

const state = {
  sentences: [],
  durations: [],
  currentIndex: 0,
  playing: false,
  currentPosition: "top-center",
  startedAt: 0,
  elapsedBeforePause: 0,
  frameId: 0,
};

const playPauseKeys = new Set([" ", "Spacebar", "MediaPlayPause", "AudioPlay", "AudioPause", "k"]);
const nextKeys = new Set(["ArrowRight", "ArrowDown", "PageDown", "Enter", "N", "n"]);
const previousKeys = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "P", "p"]);

const elements = {
  scriptInput: document.querySelector("#scriptInput"),
  prepareButton: document.querySelector("#prepareButton"),
  sampleButton: document.querySelector("#sampleButton"),
  sentenceCount: document.querySelector("#sentenceCount"),
  totalDuration: document.querySelector("#totalDuration"),
  currentMeta: document.querySelector("#currentMeta"),
  speedRange: document.querySelector("#speedRange"),
  speedOutput: document.querySelector("#speedOutput"),
  minTimeRange: document.querySelector("#minTimeRange"),
  minTimeOutput: document.querySelector("#minTimeOutput"),
  maxTimeRange: document.querySelector("#maxTimeRange"),
  maxTimeOutput: document.querySelector("#maxTimeOutput"),
  positionGrid: document.querySelector("#positionGrid"),
  offsetXRange: document.querySelector("#offsetXRange"),
  offsetXOutput: document.querySelector("#offsetXOutput"),
  offsetYRange: document.querySelector("#offsetYRange"),
  offsetYOutput: document.querySelector("#offsetYOutput"),
  fontRange: document.querySelector("#fontRange"),
  fontOutput: document.querySelector("#fontOutput"),
  widthRange: document.querySelector("#widthRange"),
  widthOutput: document.querySelector("#widthOutput"),
  darkToggle: document.querySelector("#darkToggle"),
  mirrorToggle: document.querySelector("#mirrorToggle"),
  prevButton: document.querySelector("#prevButton"),
  playButton: document.querySelector("#playButton"),
  nextButton: document.querySelector("#nextButton"),
  resetButton: document.querySelector("#resetButton"),
  fullscreenButton: document.querySelector("#fullscreenButton"),
  prompterStage: document.querySelector("#prompterStage"),
  promptBox: document.querySelector("#promptBox"),
  sentenceText: document.querySelector("#sentenceText"),
  nextPreview: document.querySelector("#nextPreview"),
  nextSentenceText: document.querySelector("#nextSentenceText"),
  sentenceTimer: document.querySelector("#sentenceTimer"),
  sentenceIndex: document.querySelector("#sentenceIndex"),
  progressBar: document.querySelector("#progressBar"),
};

function splitIntoSentences(text) {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?。？！…]|[가-힣a-zA-Z0-9]["'”’)]?)(?:\s*\n+|\s{2,})|(?<=[.!?。？！…])\s+/gu)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getSettings() {
  const minTime = Number(elements.minTimeRange.value);
  const maxTime = Math.max(Number(elements.maxTimeRange.value), minTime + 0.2);

  return {
    charsPerSecond: Number(elements.speedRange.value),
    minTime,
    maxTime,
  };
}

function countReadableCharacters(sentence) {
  return sentence.replace(/\s/g, "").length;
}

function getDuration(sentence) {
  const { charsPerSecond, minTime, maxTime } = getSettings();
  const readableLength = countReadableCharacters(sentence);
  const punctuationBonus = /[.!?。？！…]$/.test(sentence) ? 0.25 : 0;
  const seconds = readableLength / charsPerSecond + punctuationBonus;

  return Math.min(Math.max(seconds, minTime), maxTime);
}

function recalculateDurations() {
  state.durations = state.sentences.map(getDuration);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${rest}`;
}

function updateStats() {
  const total = state.durations.reduce((sum, seconds) => sum + seconds, 0);
  const count = state.sentences.length;
  const current = count ? state.currentIndex + 1 : 0;

  elements.sentenceCount.textContent = count;
  elements.totalDuration.textContent = formatTime(total);
  elements.currentMeta.textContent = `${current} / ${count}`;
}

function updateOutputs() {
  elements.speedOutput.textContent = elements.speedRange.value;
  elements.minTimeOutput.textContent = Number(elements.minTimeRange.value).toFixed(1);
  elements.maxTimeOutput.textContent = Number(elements.maxTimeRange.value).toString();
  elements.offsetXOutput.textContent = elements.offsetXRange.value;
  elements.offsetYOutput.textContent = elements.offsetYRange.value;
  elements.fontOutput.textContent = elements.fontRange.value;
  elements.widthOutput.textContent = elements.widthRange.value;
}

function applyDisplaySettings() {
  elements.promptBox.style.setProperty("--offset-x", `${elements.offsetXRange.value}%`);
  elements.promptBox.style.setProperty("--offset-y", `${elements.offsetYRange.value}%`);
  elements.promptBox.style.setProperty("--font-size", `${elements.fontRange.value}px`);
  elements.promptBox.style.setProperty("--box-width", `${elements.widthRange.value}%`);
  elements.promptBox.classList.toggle("mirrored", elements.mirrorToggle.checked);
  elements.prompterStage.classList.toggle("dark", elements.darkToggle.checked);
  elements.prompterStage.classList.toggle("light", !elements.darkToggle.checked);
  updateOutputs();
}

function setPosition(position) {
  state.currentPosition = position;
  elements.promptBox.className = `prompt-box ${position}`;
  elements.promptBox.classList.toggle("mirrored", elements.mirrorToggle.checked);

  elements.positionGrid.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.position === position);
  });
}

function showSentence(index = state.currentIndex) {
  const count = state.sentences.length;

  if (!count) {
    elements.sentenceText.textContent = "대본을 붙여넣고 프롬프터 준비를 누르세요.";
    elements.nextSentenceText.textContent = "대본을 준비하면 다음 문장이 여기에 보입니다.";
    elements.nextPreview.classList.remove("is-empty");
    elements.sentenceTimer.textContent = "0.0초";
    elements.sentenceIndex.textContent = "0 / 0";
    elements.progressBar.style.width = "0%";
    updateStats();
    return;
  }

  state.currentIndex = Math.min(Math.max(index, 0), count - 1);
  const sentence = state.sentences[state.currentIndex];
  const nextSentence = state.sentences[state.currentIndex + 1];
  const duration = state.durations[state.currentIndex];

  elements.sentenceText.textContent = sentence;
  elements.nextSentenceText.textContent = nextSentence || "다음 문장이 없습니다.";
  elements.nextPreview.classList.toggle("is-empty", !nextSentence);
  elements.sentenceTimer.textContent = `${duration.toFixed(1)}초`;
  elements.sentenceIndex.textContent = `${state.currentIndex + 1} / ${count}`;
  elements.progressBar.style.width = "0%";
  state.elapsedBeforePause = 0;
  state.startedAt = performance.now();
  updateStats();
}

function stopLoop() {
  cancelAnimationFrame(state.frameId);
  state.frameId = 0;
}

function tick(now) {
  if (!state.playing || !state.sentences.length) return;

  const durationMs = state.durations[state.currentIndex] * 1000;
  const elapsed = state.elapsedBeforePause + now - state.startedAt;
  const progress = Math.min(elapsed / durationMs, 1);
  elements.progressBar.style.width = `${progress * 100}%`;

  if (progress >= 1) {
    if (state.currentIndex < state.sentences.length - 1) {
      showSentence(state.currentIndex + 1);
    } else {
      pause();
      elements.progressBar.style.width = "100%";
      return;
    }
  }

  state.frameId = requestAnimationFrame(tick);
}

function play() {
  if (!state.sentences.length) {
    prepareScript();
  }
  if (!state.sentences.length || state.playing) return;

  state.playing = true;
  state.startedAt = performance.now();
  elements.playButton.textContent = "일시정지";
  elements.playButton.classList.add("is-playing");
  stopLoop();
  state.frameId = requestAnimationFrame(tick);
}

function pause() {
  if (!state.playing) return;

  state.elapsedBeforePause += performance.now() - state.startedAt;
  state.playing = false;
  elements.playButton.textContent = "재생";
  elements.playButton.classList.remove("is-playing");
  stopLoop();
}

function togglePlay() {
  if (state.playing) {
    pause();
  } else {
    play();
  }
}

function goToSentence(index) {
  const wasPlaying = state.playing;
  pause();
  showSentence(index);
  if (wasPlaying) play();
}

function prepareScript() {
  const sentences = splitIntoSentences(elements.scriptInput.value);
  state.sentences = sentences;
  state.currentIndex = 0;
  recalculateDurations();
  pause();
  showSentence(0);
  saveDraft();
  elements.prompterStage.focus({ preventScroll: true });
}

function saveDraft() {
  localStorage.setItem(
    "sentencePrompter",
    JSON.stringify({
      script: elements.scriptInput.value,
      speed: elements.speedRange.value,
      minTime: elements.minTimeRange.value,
      maxTime: elements.maxTimeRange.value,
      position: state.currentPosition,
      offsetX: elements.offsetXRange.value,
      offsetY: elements.offsetYRange.value,
      font: elements.fontRange.value,
      width: elements.widthRange.value,
      dark: elements.darkToggle.checked,
      mirror: elements.mirrorToggle.checked,
    }),
  );
}

function loadDraft() {
  const raw = localStorage.getItem("sentencePrompter");
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    elements.scriptInput.value = draft.script || "";
    elements.speedRange.value = draft.speed || elements.speedRange.value;
    elements.minTimeRange.value = draft.minTime || elements.minTimeRange.value;
    elements.maxTimeRange.value = draft.maxTime || elements.maxTimeRange.value;
    elements.offsetXRange.value = draft.offsetX || elements.offsetXRange.value;
    elements.offsetYRange.value = draft.offsetY || elements.offsetYRange.value;
    elements.fontRange.value = draft.font || elements.fontRange.value;
    elements.widthRange.value = draft.width || elements.widthRange.value;
    elements.darkToggle.checked = draft.dark ?? true;
    elements.mirrorToggle.checked = draft.mirror ?? false;
    setPosition(draft.position || state.currentPosition);
  } catch {
    localStorage.removeItem("sentencePrompter");
  }
}

async function toggleFullscreen() {
  const isFullscreen = document.body.classList.contains("is-fullscreen");

  if (!isFullscreen && document.documentElement.requestFullscreen) {
    await document.documentElement.requestFullscreen();
  } else if (isFullscreen && document.fullscreenElement) {
    await document.exitFullscreen();
  }

  document.body.classList.toggle("is-fullscreen", !isFullscreen);
  elements.prompterStage.focus({ preventScroll: true });
}

function bindEvents() {
  elements.prepareButton.addEventListener("click", prepareScript);
  elements.sampleButton.addEventListener("click", () => {
    elements.scriptInput.value = sampleScript;
    prepareScript();
  });
  elements.prevButton.addEventListener("click", () => goToSentence(state.currentIndex - 1));
  elements.nextButton.addEventListener("click", () => goToSentence(state.currentIndex + 1));
  elements.resetButton.addEventListener("click", () => goToSentence(0));
  elements.playButton.addEventListener("click", togglePlay);
  elements.fullscreenButton.addEventListener("click", toggleFullscreen);
  elements.prompterStage.addEventListener("click", () => goToSentence(state.currentIndex + 1));

  elements.positionGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    setPosition(button.dataset.position);
    saveDraft();
  });

  [
    elements.speedRange,
    elements.minTimeRange,
    elements.maxTimeRange,
    elements.offsetXRange,
    elements.offsetYRange,
    elements.fontRange,
    elements.widthRange,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      updateOutputs();
      applyDisplaySettings();
      recalculateDurations();
      showSentence(state.currentIndex);
      saveDraft();
    });
  });

  [elements.darkToggle, elements.mirrorToggle].forEach((input) => {
    input.addEventListener("change", () => {
      applyDisplaySettings();
      saveDraft();
    });
  });

  elements.scriptInput.addEventListener("input", saveDraft);

  document.addEventListener("keydown", (event) => {
    const isEditingControl = event.target.matches("textarea, input, select");
    if (isEditingControl) return;

    if (playPauseKeys.has(event.key)) {
      event.preventDefault();
      togglePlay();
    }
    if (nextKeys.has(event.key)) {
      event.preventDefault();
      goToSentence(state.currentIndex + 1);
    }
    if (previousKeys.has(event.key)) {
      event.preventDefault();
      goToSentence(state.currentIndex - 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      goToSentence(0);
    }
    if (event.key === "Escape" && document.body.classList.contains("is-fullscreen")) {
      toggleFullscreen();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    document.body.classList.toggle("is-fullscreen", Boolean(document.fullscreenElement));
  });
}

function init() {
  bindEvents();
  setPosition(state.currentPosition);
  loadDraft();
  setPosition(state.currentPosition);
  applyDisplaySettings();

  if (elements.scriptInput.value.trim()) {
    state.sentences = splitIntoSentences(elements.scriptInput.value);
    recalculateDurations();
    showSentence(0);
  } else {
    showSentence();
  }
}

init();
