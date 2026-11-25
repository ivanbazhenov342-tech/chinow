import { parseHTML } from "linkedom";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url).pathname;
const { document, window } = parseHTML(
  await readFile(root + "index.html", "utf8"),
);
const dialog = document.getElementById("overlay");
dialog.showModal = () => {
  dialog.open = true;
};
dialog.close = () => {
  dialog.open = false;
};
let quiz;
window.HanziWriter = {
  create: (el, c, options) => {
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
        () => {},
        () => {},
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
              root + decodeURIComponent(url.replace("./", "")),
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
let game = await runInNewContext(
  "(async()=>{" +
    source +
    "\nreturn {interact,map,startLesson,lessonScreen,unlocked,lessonList,review,get state(){return state},get run(){return run},get course(){return course},get words(){return audioWords}};})()",
  context,
);
context.interaction = game.interact;
const tick = () => new Promise((r) => setTimeout(r, 25));
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
    click(
      i + 1 < l.words.length
        ? "Запомнить и посмотреть следующее"
        : "Встретить жителя",
    );
    if (l.id === 17 && i === 1) {
      const resumed = JSON.parse(stored.get("shanjiang-journey-v2"));
      assert.equal(resumed.session.run.word, 2);
      game.startLesson(17);
      assert.equal(game.run.word, 2);
    }
  }
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
