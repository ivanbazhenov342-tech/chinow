import { parseHTML } from "linkedom";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url).pathname;
const { document, window } = parseHTML(
  await readFile(root + "index.html", "utf8"),
);
const createElement = document.createElement.bind(document);
document.createElement = (tag) => {
  const element = createElement(tag);
  if (tag === "canvas") element.getContext = () => null;
  return element;
};
const dialog = document.getElementById("overlay");
dialog.showModal = () => {
  dialog.open = true;
};
dialog.close = () => {
  dialog.open = false;
};
let quiz,
  pendingData = 0;
window.HanziWriter = {
  create: (el, c, options) => {
    pendingData++;
    const instance = {
      cancelQuiz() {},
      animateCharacter: async () => {},
      quiz: (options) => {
        quiz = options;
      },
    };
    queueMicrotask(() =>
      options.charDataLoader(
        c,
        () => {
          pendingData--;
        },
        () => {
          pendingData--;
        },
      ),
    );
    return instance;
  },
};
const stored = new Map();
const context = {
  document,
  window,
  console,
  Audio: class {
    play() {
      return Promise.resolve();
    }
    pause() {}
  },
  localStorage: {
    getItem: (k) => stored.get(k) || null,
    setItem: (k, v) => stored.set(k, v),
  },
  fetch: async (url) => {
    try {
      return {
        ok: true,
        json: async () =>
          JSON.parse(
            await readFile(
              root + decodeURIComponent(url.split("?")[0].replace("./", "")),
              "utf8",
            ),
          ),
      };
    } catch {
      return { ok: false };
    }
  },
  createWorld: () => ({
    highlight() {},
    studyWord() {},
    clearStudy() {},
    progress() {},
    visit: (id) => context.interaction(id),
    district() {},
    rotate() {},
    zoom() {},
  }),
  setTimeout: () => 0,
  clearTimeout() {},
  URL,
  Blob,
  location: { reload() {} },
};
let source = (await readFile(root + "app.js", "utf8")).replace(
  /^import[^\n]*\n/,
  "",
);
const bootstrap = () =>
  runInNewContext(
    "(async()=>{" +
      source +
      "\nreturn {interact,map,startLesson,lessonScreen,unlocked,lessonList,review,get state(){return state},get run(){return run},get course(){return course},get words(){return audioWords}};})()",
    context,
  );
let game = await bootstrap();
context.interaction = game.interact;
game.map();
assert.equal(document.querySelectorAll(".map-place").length, 12);
assert.equal(
  [...document.querySelectorAll(".map-place")].filter((b) => b.disabled).length,
  11,
);
dialog.close();
const tick = async () => {
  const deadline = Date.now() + 3000;
  while (pendingData) {
    assert.ok(Date.now() < deadline, "Handwriting data did not load");
    await new Promise((r) => setTimeout(r, 5));
  }
};
function click(text, id = "overlay-content") {
  const parent = document.getElementById(id);
  const b = [...parent.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  );
  assert.ok(
    b,
    "Missing button " + text + " in " + parent.textContent.slice(0, 300),
  );
  assert.ok(!b.disabled, "Disabled button " + text);
  b.click();
}
const story = (text) => click(text, "actions");
story("Подойти к дежурному");
assert.equal(game.state.intro, 1);
story("Послушал, идём дальше");
game.interact("entry");
assert.equal(game.state.intro, 2);
game.interact("exit");
story("Подойти к Линь");
story("你好");
story("Готов узнать слово");
story("mǎ · лошадь");
story("Идти к чайной");
story("茶 · чай");
for (const token of ["我", "要", "一杯", "茶"]) story(token);
story("谢谢");
story("出口");
assert.equal(game.state.intro, 11);
story("Открыть прописи");
await tick();
click("Обвести");
await tick();
quiz.onComplete();
click("Написать самостоятельно");
assert.equal(
  document.getElementById("overlay-title").textContent,
  "Напиши по памяти",
);
await tick();
quiz.onComplete();
click("Продолжить");
assert.equal(game.state.intro, 12);
assert.ok(game.state.written.includes("口"));
assert.equal(game.unlocked(1), false);
console.log(
  "PASS first chapter, wrong entrance, tone choice, writing stages and saved progress",
);
for (const l of game.course) {
  assert.ok(game.unlocked(l.district), "District not unlocked " + l.district);
  game.startLesson(l.id);
  for (let i = 0; i < l.words.length; i++) {
    assert.equal(game.run.stage, "explore");
    assert.equal(
      dialog.open,
      false,
      "Word discovery should happen in the city",
    );
    story("Подойти к записке · " + (i + 1) + "/" + l.words.length);
    assert.equal(game.run.stage, "inspect");
    assert.ok(
      document.getElementById("speech").textContent.includes(l.words[i].hanzi),
    );
    story(
      i + 1 < l.words.length
        ? "Найти следующее слово"
        : "Слова собраны — к собеседнику",
    );
    if (l.id === 17 && i === 1) {
      const resumed = JSON.parse(stored.get("shanjiang-journey-v2"));
      assert.equal(resumed.session.run.word, 2);
      resumed.session.run.stage = "words";
      stored.set("shanjiang-journey-v2", JSON.stringify(resumed));
      game = await bootstrap();
      context.interaction = game.interact;
      assert.equal(game.run.word, 2);
      assert.equal(game.run.stage, "explore");
      assert.equal(dialog.open, false);
    }
  }
  assert.equal(game.run.stage, "meet");
  const meeting = [
    ...document.getElementById("actions").querySelectorAll("button"),
  ].find((b) => b.textContent.startsWith("Поговорить ·"));
  assert.ok(meeting);
  meeting.click();
  assert.equal(game.run.stage, "dialogue");
  click("Помочь жителю");
  click(l.options[0]);
  click("Собрать фразу");
  for (const t of l.tokens) click(t);
  click("Произнести реплику");
  while (game.run.stage === "recall") {
    const trial = game.run.trials[game.run.trial];
    click(trial.w.ru);
    click("Продолжить");
  }
  assert.equal(game.run.stage, "write");
  await tick();
  click("Обвести");
  await tick();
  quiz.onComplete();
  click("Написать самостоятельно");
  assert.equal(
    document.getElementById("overlay-title").textContent,
    "Напиши по памяти",
  );
  await tick();
  quiz.onComplete();
  click("Продолжить");
  assert.equal(game.run.stage, "task");
  const field = document.querySelector("textarea");
  field.value = "我学习汉语。";
  field.oninput();
  click("Завершить миссию");
  assert.ok(game.state.completed.includes(l.id));
}
// Only answered words get their review dates changed, and a mistake returns later.
context.Math = Object.assign(Object.create(Math), { random: () => 0.5 });
const untouched = JSON.stringify(game.state.reviews["你"]);
game.state.reviews["出口"] = { interval: 1, due: 0 };
game.state.reviews["我"] = { interval: 1, due: 0 };
game.review();
let options = [...document.querySelectorAll(".options button")];
assert.ok(options.length >= 2);
options[1].click();
options[0].click();
click("Следующая записка");
assert.ok(
  document.querySelector(".context-sentence"),
  "Review should use the word in a sentence",
);
options = [...document.querySelectorAll(".options button")];
options[0].click();
click("Следующая записка");
options = [...document.querySelectorAll(".options button")];
options[0].click();
click("Следующая записка");
assert.ok(
  document
    .getElementById("overlay-content")
    .textContent.includes("Записки разобраны"),
);
assert.equal(game.state.reviews["我"].interval, 2);
assert.equal(game.state.reviews["出口"].interval, 1);
assert.ok(game.state.reviews["出口"].due < Date.now() + 610000);
assert.equal(JSON.stringify(game.state.reviews["你"]), untouched);
console.log(
  "PASS contextual review, retry queue, due dates and legacy-session migration",
);

assert.equal(game.state.completed.length, 72);
assert.equal(game.state.words.length >= 663, true);
assert.equal(game.state.session, null);
assert.ok(
  JSON.parse(stored.get("shanjiang-journey-v2")).completed.length === 72,
);
for (const l of game.course) {
  assert.equal(l.options.length, 3);
  assert.ok(l.sentenceRu && l.words.length > 0 && l.tokens.length > 0);
  for (const c of l.characters) {
    const d = JSON.parse(await readFile(root + "hanzi/" + c + ".json", "utf8"));
    assert.ok(d.strokes.length > 0);
    assert.equal(d.strokes.length, d.medians.length);
  }
}
for (const word of game.words) {
  const data = await readFile(root + "audio/" + word + ".mp3");
  assert.ok(data.length > 1000);
}
console.log(
  "PASS all 72 missions, district gates, sentence assembly, recall, handwriting handoff, diary and completion",
);
console.log(
  "PASS " + game.words.size + " audio assets and every lesson handwriting file",
);

for (const word of ["出口", "你好", "妈", "马", "茶", "谢谢", "水"])
  assert.ok(game.words.has(word), "First chapter needs audio for " + word);
const sources = JSON.parse(await readFile(root + "audio/sources.json", "utf8"));
assert.equal(
  new Set([...sources.native, ...sources.synthetic]).size,
  game.words.size,
);
assert.ok(sources.synthetic.every((word) => !sources.native.includes(word)));
console.log("PASS first-chapter audio coverage and recording provenance");
