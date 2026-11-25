import { createWorld } from "./world.js?v=3";
const $ = (id) => document.getElementById(id);
const districts = [
  [
    "Восточный вокзал",
    "初见",
    "От вокзала до чайной",
    "Первые звуки, тоны и знаки",
  ],
  [
    "Улица знакомств",
    "相识",
    "Соседи становятся друзьями",
    "Имя, страна, знакомство",
  ],
  [
    "Рыночная площадь",
    "市集",
    "Город торгуется и улыбается",
    "Числа, покупки и цены",
  ],
  [
    "Семейный двор",
    "小院",
    "Место за общим столом",
    "Семья, дом и повседневные вещи",
  ],
  [
    "Часовая башня",
    "时光",
    "У каждого дня своя история",
    "Время, расписание и встречи",
  ],
  ["Чайный переулок", "茶巷", "Ещё одну чашку?", "Еда, напитки и заказы"],
  [
    "Мосты и каналы",
    "问路",
    "Все дороги ведут к людям",
    "Направления и транспорт",
  ],
  [
    "Улица мастерских",
    "匠心",
    "Дело, которое любишь",
    "Работа, учёба и распорядок",
  ],
  [
    "Сад воспоминаний",
    "往事",
    "Вчера тоже было приключением",
    "Прошлое и пережитый опыт",
  ],
  [
    "Театральная площадь",
    "心意",
    "Выбрать то, что нравится",
    "Сравнения, желания и причины",
  ],
  [
    "Сад спокойствия",
    "安康",
    "Позаботиться о себе",
    "Здоровье, помощь и самочувствие",
  ],
  [
    "Праздник фонарей",
    "灯会",
    "Теперь этот город — твой",
    "Планы, приглашения и итог A2",
  ],
];
let course = [],
  quests = [],
  audioWords = new Set(),
  world = null,
  activeDistrict = 0,
  currentLesson = null,
  writer = null,
  writingGeneration = 0,
  toastTimer;
const fresh = () => ({
  version: 2,
  intro: 0,
  completed: [],
  words: [],
  written: [],
  notes: {},
  reviews: {},
  district: 0,
});
let state = fresh();
try {
  const saved = JSON.parse(
    localStorage.getItem("shanjiang-journey-v2") || "null",
  );
  if (saved?.version === 2)
    state = {
      ...fresh(),
      ...saved,
      completed: Array.isArray(saved.completed) ? saved.completed : [],
      words: Array.isArray(saved.words) ? saved.words : [],
      written: Array.isArray(saved.written) ? saved.written : [],
      notes: saved.notes || {},
      reviews: saved.reviews || {},
    };
  else
    state.intro = Math.min(
      3,
      Math.max(0, Number(localStorage.getItem("shanjiang-station-step")) || 0),
    );
} catch {}
state.intro = Math.max(0, Math.min(12, Math.trunc(Number(state.intro) || 0)));
function save() {
  try {
    localStorage.setItem("shanjiang-journey-v2", JSON.stringify(state));
  } catch {
    toast("Хранилище недоступно. Прогресс сохранится до закрытия страницы.");
  }
  $("word-count").textContent = state.words.length;
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 4000);
}
function node(tag, text, className) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function button(label, action, className = "") {
  const b = node("button", label, className);
  b.onclick = action;
  return b;
}
function addButton(parent, label, action, className = "") {
  const b = button(label, action, className);
  parent.append(b);
  return b;
}
function learn(word) {
  if (!state.words.includes(word)) {
    state.words.push(word);
    state.reviews[word] = { due: Date.now() + 86400000, interval: 1 };
  }
  save();
}
let currentAudio = null;
function hear(word, onEnd) {
  if (!audioWords.has(word)) {
    toast(
      "Для этого слова запись ещё готовится. Произношение указано в пиньине.",
    );
    return;
  }
  currentAudio?.pause();
  currentAudio = new Audio("./audio/" + encodeURIComponent(word) + ".mp3");
  if (onEnd) currentAudio.onended = onEnd;
  currentAudio
    .play()
    .catch(() =>
      toast(
        "Запись не загрузилась. Проверь соединение и нажми «Слушать» ещё раз.",
      ),
    );
}
function speakButton(parent, word, label = "Слушать") {
  if (audioWords.has(word)) addButton(parent, "♫ " + label, () => hear(word));
}
function openOverlay(label, title) {
  writingGeneration++;
  writer?.cancelQuiz();
  writer = null;
  $("overlay-label").textContent = label;
  $("overlay-title").textContent = title;
  $("overlay-content").replaceChildren();
  if (!$("overlay").open) $("overlay").showModal();
  return $("overlay-content");
}
function closeOverlay() {
  writingGeneration++;
  writer?.cancelQuiz();
  writer = null;
  $("overlay").close();
}
$("close-overlay").onclick = closeOverlay;
$("overlay").addEventListener("cancel", () => {
  writingGeneration++;
  writer?.cancelQuiz();
  writer = null;
});
$("overlay").addEventListener("click", (e) => {
  if (e.target === $("overlay")) {
    const r = $("overlay").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeOverlay();
  }
});
function unlocked(d) {
  return (
    d === 0 ||
    (state.intro === 12 &&
      course
        .filter((l) => l.district < d)
        .every((l) => state.completed.includes(l.id)))
  );
}
function chooseDistrict(d) {
  activeDistrict = d;
  state.district = d;
  save();
  world?.district(d);
  $("world").classList.remove("arriving");
  void $("world").offsetWidth;
  $("world").classList.add("arriving");
  $("place").textContent = districts[d][0];
  $("district-hanzi").textContent = districts[d][1];
  $("district-subtitle").textContent = districts[d][2];
  closeOverlay();
  renderStory();
}
function map() {
  const body = openOverlay(
    "Путешествие · Старт — A2",
    "Город, который ты узнаешь",
  );
  body.append(
    node(
      "p",
      "Каждые шесть миссий открывают новый район. Начни с дороги от вокзала до чайной.",
      "intro-copy",
    ),
  );
  const stats = node("div", undefined, "stats");
  for (const [n, label] of [
    [state.completed.length + "/72", "миссий пройдено"],
    [state.words.length, "слов в блокноте"],
    [state.written.length, "знаков написано"],
  ]) {
    const s = node("div");
    s.append(node("b", n), node("small", label));
    stats.append(s);
  }
  body.append(stats);
  const positions = [
    [12, 84],
    [34, 78],
    [57, 84],
    [81, 78],
    [85, 53],
    [63, 56],
    [42, 50],
    [18, 53],
    [12, 22],
    [36, 24],
    [59, 19],
    [82, 22],
  ];
  const mapWrap = node("div", undefined, "city-map-wrap");
  const grid = node("div", undefined, "city-map");
  const canvas = node("canvas");
  canvas.width = 2000;
  canvas.height = 1440;
  canvas.setAttribute("aria-hidden", "true");
  grid.append(canvas);
  drawCityMap(canvas, positions);
  mapWrap.append(grid);
  districts.forEach((d, i) => {
    const available = unlocked(i),
      done = course.filter(
        (l) => l.district === i && state.completed.includes(l.id),
      ).length;
    const b = button(
      "",
      () => chooseDistrict(i),
      "map-place" + (i === activeDistrict ? " current" : ""),
    );
    b.disabled = !available;
    b.style.left = positions[i][0] + "%";
    b.style.top = positions[i][1] + "%";
    b.append(
      node("span", d[1], "cn"),
      node("strong", d[0]),
      node(
        "small",
        (i === 0 ? "Старт" : i < 6 ? "A1" : "A2") +
          " · " +
          (available
            ? done + " / 6 миссий"
            : "Откроется после предыдущего района"),
      ),
    );
    grid.append(b);
  });
  body.append(
    node(
      "p",
      "Выбери открытый район. На телефоне карту можно прокручивать в сторону.",
      "camera-hint",
    ),
    mapWrap,
  );
  const row = node("div", undefined, "row");
  addButton(row, "Об игре и источниках", about);
  addButton(row, "Сохранить прогресс в файл", exportProgress);
  body.append(row);
}
function drawCityMap(canvas, positions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(2, 2);
  const gradient = ctx.createLinearGradient(0, 0, 1000, 720);
  gradient.addColorStop(0, "#c7d6b7");
  gradient.addColorStop(1, "#e8dfbe");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, 720);
  function random(n) {
    return Math.abs(Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1;
  }
  // The canal winds through the whole city and links the separate districts.
  ctx.beginPath();
  ctx.moveTo(680, -20);
  ctx.bezierCurveTo(620, 120, 740, 220, 570, 340);
  ctx.bezierCurveTo(420, 450, 550, 560, 430, 750);
  ctx.strokeStyle = "#a9c3b1";
  ctx.lineWidth = 79;
  ctx.stroke();
  ctx.strokeStyle = "#79a6a0";
  ctx.lineWidth = 58;
  ctx.stroke();
  for (let i = 0; i < 90; i++) {
    const x = random(i + 3) * 1000,
      y = random(i + 94) * 720;
    ctx.fillStyle = ["#829b71", "#9cac78", "#6b8f70"][i % 3];
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      6 + random(i + 7) * 13,
      4 + random(i + 6) * 9,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  for (let i = 0; i < 100; i++) {
    const x = random(i + 99) * 980,
      y = random(i + 34) * 700,
      w = 10 + random(i + 12) * 14;
    if (x > 480 && x < 680) continue;
    ctx.fillStyle = "#b7ad87";
    ctx.fillRect(x + 3, y + 4, w, 12);
    ctx.fillStyle = "#ecdbb4";
    ctx.fillRect(x, y, w, 12);
    ctx.fillStyle = ["#6c8272", "#788475", "#9a7b61"][i % 3];
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x + w / 2, y - 8);
    ctx.lineTo(x + w + 3, y);
    ctx.closePath();
    ctx.fill();
  }
  const point = (p) => [p[0] * 10, p[1] * 7.2];
  for (let i = 1; i < positions.length; i++) {
    const [x, y] = point(positions[i - 1]),
      [nx, ny] = point(positions[i]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x, (y + ny) / 2, nx, (y + ny) / 2, nx, ny);
    ctx.lineWidth = 13;
    ctx.strokeStyle = "#eee5c8";
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = unlocked(i) ? "#9b7b50" : "#afb29a";
    ctx.setLineDash([3, 7]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Pale washes mark districts that the learner has yet to discover.
  for (let i = 1; i < positions.length; i++)
    if (!unlocked(i)) {
      const [x, y] = point(positions[i]),
        fog = ctx.createRadialGradient(x, y, 20, x, y, 130);
      fog.addColorStop(0, "#f0eed8c0");
      fog.addColorStop(1, "#f0eed800");
      ctx.fillStyle = fog;
      ctx.fillRect(x - 130, y - 130, 260, 260);
    }
  ctx.fillStyle = "#344e3a";
  ctx.font = "26px serif";
  ctx.fillText("山江", 30, 43);
  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#5d7459";
  ctx.fillText("Шаньцзян", 30, 65);
}
const intro = [
  [
    "Ваш поезд прибыл",
    "В билете записка: «Буду ждать у выхода с синим зонтом». Дежурный знает, какую надпись искать.",
    "Подойти к дежурному",
    "guard",
  ],
  [
    "Одно слово открывает город",
    "出口 · chūkǒu — выход. Послушай слово и повтори его. Знак 口 встречается и в других названиях проходов.",
    "Послушал, идём дальше",
    "guard",
  ],
  [
    "Какой проход ведёт в город?",
    "Найди надпись, которую назвал дежурный. Коснись вывески в мире или выбери проход ниже.",
    null,
    "exit",
  ],
  [
    "Человек с синим зонтом",
    "У ворот тебя встречает Линь — хозяйка маленькой чайной. Подойди и познакомься.",
    "Подойти к Линь",
    "friend",
  ],
  [
    "Первое приветствие",
    "你好 · nǐ hǎo — привет. Два третьих тона рядом: первый в речи меняется на второй. Поздоровайся с Линь.",
    null,
    "friend",
  ],
  [
    "У слов есть мелодия",
    "Линь объясняет: mā — мама, mǎ — лошадь. Высота голоса меняет значение. Послушай два слова, затем узнай слово на слух.",
    null,
    "friend",
  ],
  [
    "Пойдём в чайную",
    "茶 · chá — чай. Линь приглашает отдохнуть с дороги. Найди вывеску 茶馆. Касайся земли, чтобы идти, веди пальцем, чтобы осмотреться.",
    "Идти к чайной",
    "tea",
  ],
  [
    "Что будешь пить?",
    "На столе чай и вода. Линь произносит 茶 · chá. Выбери то, что она предлагает.",
    null,
    "tea",
  ],
  [
    "Одна чашка чая",
    "我 — я, 要 — хотеть, 一杯 — одну чашку, 茶 — чая. Собери заказ, касаясь слов по порядку.",
    null,
    "tea",
  ],
  [
    "Маленькое спасибо",
    "Линь ставит чашку на стол. 谢谢 · xièxie — спасибо. Как поблагодаришь хозяйку?",
    null,
    "tea",
  ],
  [
    "Помоги следующему путешественнику",
    "За окном новый пассажир ищет выход с вокзала. Какую надпись ему показать? Вспомни слово с платформы.",
    null,
    "exit",
  ],
  [
    "Знак в путевом блокноте",
    "口 · kǒu — рот, отверстие. Этот знак есть в слове 出口. Посмотри на три черты, обведи их и напиши знак самостоятельно.",
    "Открыть прописи",
    "tea",
  ],
];
let introFeedback = "",
  toneListening = false,
  introTokens = [];
function districtCompleted(d) {
  return course.filter(
    (l) => l.district === d && state.completed.includes(l.id),
  ).length;
}
function nextMission(d) {
  return course.find(
    (l) => l.district === d && !state.completed.includes(l.id),
  );
}
function renderQuest() {
  const l = currentLesson,
    q = quests[l.id],
    actions = $("actions");
  $("eyebrow").textContent = q.name + " · " + (l.id + 1) + " / 72";
  $("story-title").textContent = l.title;
  $("story-progress").style.width = (run.word / l.words.length) * 55 + "%";
  if (run.stage === "explore" || run.stage === "inspect") {
    const w = l.words[run.word];
    world?.studyWord(w.hanzi, run.word);
    world?.highlight("study");
    if (run.stage === "explore") {
      $("story-text").textContent =
        q.setup + " Найди подсвеченную записку в городе.";
      addButton(
        actions,
        "Подойти к записке · " + (run.word + 1) + "/" + l.words.length,
        () => visit("study"),
        "primary",
      );
    } else {
      $("story-text").textContent =
        "Слово " + (run.word + 1) + " из " + l.words.length + ". " + l.goal;
      speech(w.hanzi, w.pinyin, w.ru);
      speakButton(actions, w.hanzi);
      if (!audioWords.has(w.hanzi))
        $("feedback").textContent =
          "Произношение — " + w.pinyin + ". Запись готовится.";
      addButton(
        actions,
        run.word + 1 < l.words.length
          ? "Найти следующее слово"
          : "Слова собраны — к собеседнику",
        () => {
          run.word++;
          run.stage = run.word < l.words.length ? "explore" : "meet";
          lessonScreen();
        },
        "primary",
      );
    }
  } else {
    world?.clearStudy();
    world?.highlight(q.npc);
    $("story-progress").style.width = (run.stage === "meet" ? 60 : 85) + "%";
    $("story-text").textContent = q.setup;
    if (run.stage === "meet")
      addButton(
        actions,
        "Поговорить · " + q.name,
        () => visit(q.npc),
        "primary",
      );
    else addButton(actions, "Продолжить разговор", lessonScreen, "primary");
  }
  addButton(actions, "Миссии района", () => lessonList(activeDistrict));
}
function renderStory() {
  $("feedback").textContent = introFeedback;
  $("speech").replaceChildren();
  $("actions").replaceChildren();
  if (state.intro < 12 && activeDistrict === 0) {
    const s = intro[state.intro];
    $("eyebrow").textContent =
      "От вокзала до чайной · " + (state.intro + 1) + " / 12";
    $("story-progress").style.width = (state.intro / 12) * 100 + "%";
    $("story-title").textContent = s[0];
    $("story-text").textContent = s[1];
    world?.highlight(s[3]);
    const a = $("actions");
    if ([0, 3, 6].includes(state.intro))
      addButton(a, s[2], () => visit(s[3]), "primary");
    if ([4, 6, 7, 9].includes(state.intro))
      addButton(a, "Послушать Линь", linSpeech);
    if (state.intro === 1) {
      speech("出口", "chūkǒu", "выход");
      speakButton(a, "出口");
      addButton(a, s[2], () => nextIntro(), "primary");
    }
    if (state.intro === 2) {
      addButton(a, "入口", () => visit("entry"), "answer");
      addButton(a, "出口", () => visit("exit"), "answer");
      speakButton(a, "出口", "Повторить");
    }
    if (state.intro === 4) {
      speech("你好", "nǐ hǎo", "привет");
      speakButton(a, "你好");
      addButton(
        a,
        "你好",
        () => {
          learn("你好");
          nextIntro();
        },
        "primary answer",
      );
      addButton(
        a,
        "再见",
        () =>
          wrongIntro(
            "再见 · zàijiàn — до свидания. Линь только встретила тебя.",
          ),
        "answer",
      );
    }
    if (state.intro === 5) {
      if (!toneListening) {
        speakButton(a, "妈", "mā — мама");
        speakButton(a, "马", "mǎ — лошадь");
        addButton(
          a,
          "Готов узнать слово",
          () => {
            toneListening = true;
            hear("马");
            renderStory();
          },
          "primary",
        );
      } else {
        speakButton(a, "马", "Повторить вопрос");
        addButton(a, "mā · мама", () =>
          wrongIntro(
            "Вслушайся: третий тон mǎ начинается низко. Сравни с ровным mā.",
          ),
        );
        addButton(
          a,
          "mǎ · лошадь",
          () => {
            learn("马");
            learn("妈");
            nextIntro();
          },
          "primary",
        );
      }
    }
    if (state.intro === 7) {
      speakButton(a, "茶");
      addButton(
        a,
        "茶 · чай",
        () => {
          learn("茶");
          nextIntro();
        },
        "answer",
      );
      addButton(
        a,
        "水 · вода",
        () => wrongIntro("水 читается shuǐ. Линь предложила chá — чай."),
        "answer",
      );
    }
    if (state.intro === 8) {
      speech(
        introTokens.join(" ") || "…",
        "wǒ yào yì bēi chá",
        "я хочу одну чашку чая",
      );
      for (const t of ["茶", "要", "我", "一杯"])
        addButton(
          a,
          t,
          () => {
            introTokens.push(t);
            if (introTokens.length === 4) {
              if (introTokens.join("") === "我要一杯茶") {
                ["我", "要", "一", "杯", "茶"].forEach(learn);
                introTokens = [];
                nextIntro();
              } else {
                introTokens = [];
                wrongIntro("Начни с «я», затем «хочу», количество и напиток.");
              }
            } else renderStory();
          },
          "answer",
        );
      if (introTokens.length)
        addButton(a, "Собрать заново", () => {
          introTokens = [];
          renderStory();
        });
    }
    if (state.intro === 9) {
      speakButton(a, "谢谢");
      addButton(
        a,
        "谢谢",
        () => {
          learn("谢谢");
          nextIntro();
        },
        "answer",
      );
      addButton(
        a,
        "你好",
        () =>
          wrongIntro("你好 — приветствие. Для благодарности выбери xièxie."),
        "answer",
      );
    }
    if (state.intro === 10) {
      addButton(
        a,
        "出口",
        () => {
          learn("出口");
          learn("入口");
          nextIntro();
        },
        "answer",
      );
      addButton(
        a,
        "入口",
        () => wrongIntro("入口 ведёт внутрь вокзала. Пассажиру нужен выход."),
        "answer",
      );
    }
    if (state.intro === 11)
      addButton(
        a,
        s[2],
        () =>
          writing("口", () => {
            nextIntro();
            closeOverlay();
          }),
        "primary",
      );
    return;
  }
  world?.progress(districtCompleted(activeDistrict));
  if (currentLesson && run && currentLesson.district === activeDistrict) {
    renderQuest();
    return;
  }
  world?.clearStudy();
  const next = nextMission(activeDistrict),
    q = next ? quests[next.id] : null;
  const completed = districtCompleted(activeDistrict);
  $("eyebrow").textContent =
    (activeDistrict < 6 ? "Старт · A1" : "A2") +
    " · " +
    districts[activeDistrict][0];
  $("story-progress").style.width = (completed / 6) * 100 + "%";
  $("story-title").textContent = next ? next.title : "Район готов к празднику";
  $("story-text").textContent = q
    ? q.setup
    : "Все шесть просьб выполнены. Можно вернуться к знакомым словам или продолжить путь по городу.";
  world?.highlight(q?.npc);
  if (next)
    addButton(
      $("actions"),
      "Начать встречу · " + q.name,
      () => startLesson(next.id),
      "primary",
    );
  else if (activeDistrict < 11)
    addButton(
      $("actions"),
      "Открыть " + districts[activeDistrict + 1][0],
      () => chooseDistrict(activeDistrict + 1),
      "primary",
    );
  addButton($("actions"), "Миссии района · " + completed + "/6", () =>
    lessonList(activeDistrict),
  );
  if (state.words.length) addButton($("actions"), "Вспомнить слова", review);
  addButton($("actions"), "Карта города", map);
}
function linSpeech() {
  const body = openOverlay("Голос Линь", "Добро пожаловать в Шаньцзян");
  const lines = [
    [
      "你好，欢迎来到山江！我是林。",
      "Nǐ hǎo, huānyíng láidào Shānjiāng! Wǒ shì Lín.",
      "Привет, добро пожаловать в Шаньцзян! Я Линь.",
    ],
    [
      "出口在那边。跟我来，我们去茶馆。",
      "Chūkǒu zài nàbiān. Gēn wǒ lái, wǒmen qù cháguǎn.",
      "Выход вон там. Пойдём со мной в чайную.",
    ],
    [
      "你想喝茶，还是喝水？",
      "Nǐ xiǎng hē chá, háishi hē shuǐ?",
      "Хочешь чай или воду?",
    ],
    [
      "好，一杯热茶。请慢慢喝。",
      "Hǎo, yì bēi rè chá. Qǐng mànmàn hē.",
      "Хорошо, чашку горячего чая. Пей не спеша.",
    ],
  ];
  for (const [cn, py, ru] of lines) {
    const block = node("div", undefined, "rule");
    block.append(node("h3", cn), node("p", py), node("p", ru));
    body.append(block);
  }
  speakButton(body, "lin", "Слушать Линь");
  body.append(
    node(
      "p",
      "Слушай знакомые слова в связной речи. Голос Ladaisy, синтез ElevenLabs.",
      "writing-caption",
    ),
  );
}
function speech(hanzi, pinyin, ru) {
  const s = $("speech");
  s.append(
    node("div", hanzi, "hanzi"),
    node("div", pinyin, "pinyin"),
    node("small", ru),
  );
}
function wrongIntro(text) {
  introFeedback = text;
  renderStory();
}
function nextIntro() {
  state.intro = Math.min(12, state.intro + 1);
  introFeedback = "";
  save();
  renderStory();
  if (state.intro === 12)
    toast("Вокзал и чайная открыты. Продолжай знакомиться с городом.");
}
function visit(id) {
  if (world) {
    if (world.visit(id) === false)
      toast("Этот путь пока занят. Попробуй подойти с другой стороны.");
  } else interact(id);
}
function interact(id) {
  if (activeDistrict !== 0 || state.intro === 12) {
    if (currentLesson && run && currentLesson.district === activeDistrict) {
      const q = quests[currentLesson.id];
      if (
        id === "study" &&
        (run.stage === "explore" || run.stage === "inspect")
      ) {
        const w = currentLesson.words[run.word];
        run.stage = "inspect";
        learn(w.hanzi);
        lessonScreen();
        if (audioWords.has(w.hanzi)) hear(w.hanzi);
        return;
      }
      if (id === q.npc) {
        if (run.stage === "meet") run.stage = "dialogue";
        if (run.stage === "explore" || run.stage === "inspect") {
          toast("Сначала посмотри подсвеченную записку.");
          return;
        }
        lessonScreen();
        return;
      }
      toast(q.name + " ждёт тебя. " + currentLesson.goal);
      return;
    }
    const next = nextMission(activeDistrict);
    if (next && id === quests[next.id].npc) startLesson(next.id);
    else lessonList(activeDistrict);
    return;
  }
  const s = state.intro;
  if (s === 0 && id === "guard") {
    learn("出口");
    nextIntro();
    hear("出口");
    return;
  }
  if (s === 2 && id === "exit") {
    nextIntro();
    return;
  }
  if (s === 2 && id === "entry") {
    wrongIntro("入口 · rùkǒu — вход. Дежурный назвал другой проход.");
    learn("入口");
    return;
  }
  if (s === 3 && id === "friend") {
    nextIntro();
    hear("你好");
    return;
  }
  if (s === 6 && id === "tea") {
    nextIntro();
    hear("茶");
    return;
  }
  toast("Сейчас " + intro[s][0].toLocaleLowerCase() + ".");
}
function lessonList(d) {
  const body = openOverlay(districts[d][0], districts[d][2]);
  body.append(
    node(
      "p",
      districts[d][3] +
        ". В каждой миссии новые слова, диалог, задача, письмо и возвращение к знакомым словам.",
      "intro-copy",
    ),
  );
  const list = node("div", undefined, "lesson-list");
  course
    .filter((l) => l.district === d)
    .forEach((l) => {
      const available = l.id === 0 || state.completed.includes(l.id - 1),
        done = state.completed.includes(l.id);
      const b = button("", () => startLesson(l.id), "lesson-row");
      b.disabled = !available;
      const text = node("span");
      text.append(node("strong", l.title), node("small", quests[l.id].setup));
      b.append(
        node("span", l.characters[0], "lesson-icon"),
        text,
        node(
          "span",
          done
            ? "✓"
            : available
              ? state.session?.lessonId === l.id
                ? "Продолжить"
                : "Начать"
              : "Позже",
          "check",
        ),
      );
      list.append(b);
    });
  body.append(list);
  const row = node("div", undefined, "row");
  addButton(row, "Карта города", map);
  body.append(row);
}
function shuffled(list) {
  return [...list]
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.value);
}
let run = null;
function startLesson(id) {
  currentLesson = course[id];
  run =
    state.session?.lessonId === id
      ? state.session.run
      : {
          stage: "explore",
          word: 0,
          trial: 0,
          trials: [],
          selected: [],
          remaining: [],
        };
  if (run.stage === "words") run.stage = "explore";
  if (activeDistrict !== currentLesson.district)
    chooseDistrict(currentLesson.district);
  lessonScreen();
}
function stageBody(label) {
  const body = openOverlay(
    currentLesson.level + " · " + districts[currentLesson.district][0],
    currentLesson.title,
  );
  const wrap = node("div", undefined, "lesson-stage");
  body.append(wrap);
  wrap.append(node("small", label, "eyebrow"));
  return wrap;
}
function lessonScreen() {
  const l = currentLesson;
  state.session = { lessonId: l.id, run };
  save();
  if (["explore", "inspect", "meet"].includes(run.stage)) {
    closeOverlay();
    renderStory();
    return;
  }
  if (run.stage === "dialogue") {
    const body = stageBody("Встреча в городе");
    speakButton(body, "dialogue-" + l.id, "Слушать разговор");
    body.append(node("h3", quests[l.id].name), node("p", quests[l.id].setup));
    l.dialogue.forEach((line, i) => {
      const block = node("div", undefined, "rule");
      block.append(
        node("small", i ? "Твой ответ" : quests[l.id].name),
        node("h3", line.hanzi),
        node("p", line.pinyin),
        node("p", line.ru),
      );
      body.append(block);
      const row = node("div", undefined, "row");
      speakButton(row, line.hanzi);
      body.append(row);
    });
    const detail = document.createElement("details");
    detail.append(node("summary", "Разобраться, как устроена фраза"));
    const rule = node("div", undefined, "rule");
    l.rule.split(" // ").forEach((p) => rule.append(node("p", p)));
    detail.append(rule);
    body.append(detail);
    addButton(
      body,
      "Помочь жителю",
      () => {
        run.stage = "grammar";
        lessonScreen();
      },
      "primary",
    );
  }
  if (run.stage === "grammar") {
    const body = stageBody("Пойми собеседника");
    body.append(node("h3", l.q));
    const message = node("div", "", "lesson-message"),
      options = node("div", undefined, "options");
    shuffled(l.options).forEach((option) =>
      addButton(options, option, (e) => {
        if (option === l.options[0]) {
          message.textContent = l.why;
          options
            .querySelectorAll("button")
            .forEach((b) => (b.disabled = true));
          addButton(
            body,
            "Собрать фразу",
            () => {
              run.stage = "sentence";
              run.selected = [];
              run.remaining = shuffled(
                l.tokens.map((text, id) => ({ text, id })),
              );
              lessonScreen();
            },
            "primary",
          );
        } else message.textContent = "Попробуй ещё раз. " + l.why;
      }),
    );
    body.append(options, message);
  }
  if (run.stage === "sentence") {
    const body = stageBody("Твоя реплика");
    body.append(node("h3", l.sentenceRu));
    const example = node("details");
    example.append(
      node("summary", "Подсмотреть образец"),
      node("p", l.tokens.join(" ")),
    );
    body.append(example);
    const built = node("div", undefined, "tokens"),
      bank = node("div", undefined, "token-bank");
    run.selected.forEach((t) =>
      addButton(built, t.text, () => {
        run.remaining.push(t);
        run.selected = run.selected.filter((x) => x.id !== t.id);
        lessonScreen();
      }),
    );
    run.remaining.forEach((t) =>
      addButton(bank, t.text, () => {
        run.selected.push(t);
        run.remaining = run.remaining.filter((x) => x.id !== t.id);
        lessonScreen();
      }),
    );
    body.append(built, bank);
    const message = node("p", undefined, "lesson-message");
    body.append(message);
    const check = addButton(
      body,
      "Произнести реплику",
      () => {
        if (run.selected.map((t) => t.text).join("") === l.tokens.join("")) {
          run.stage = "recall";
          run.trial = 0;
          run.trials = shuffled(
            l.words.map((w, i) => ({
              w,
              type:
                i % 2 === 0 && audioWords.has(w.hanzi) ? "listen" : "meaning",
            })),
          );
          lessonScreen();
        } else
          message.textContent =
            "Порядок пока не совпал. Коснись слова, чтобы вернуть его, или посмотри образец.";
      },
      "primary",
    );
    check.disabled = run.remaining.length > 0;
  }
  if (run.stage === "recall") {
    recallScreen();
    return;
  }
  if (run.stage === "write") {
    writing(
      l.characters[0],
      () => {
        run.stage = "task";
        lessonScreen();
      },
      l.title,
    );
    return;
  }
  if (run.stage === "task") {
    const body = stageBody("Свой ответ · Путевой дневник");
    body.append(node("h3", "Теперь расскажи свою историю"), node("p", l.task));
    const field = node("textarea");
    field.setAttribute("aria-label", "Твой ответ на задание");
    field.placeholder = "Напиши свою реплику по-китайски…";
    field.value = state.notes[l.id] || "";
    body.append(
      field,
      node(
        "p",
        "Прочитай ответ вслух и сравни с примерами диалога. Эта запись остаётся в твоём дневнике.",
        "writing-caption",
      ),
    );
    field.oninput = () => {
      state.notes[l.id] = field.value;
      save();
    };
    const message = node("p", undefined, "lesson-message");
    body.append(message);
    addButton(
      body,
      "Завершить миссию",
      () => {
        if (field.value.trim().length < 2) {
          message.textContent =
            "Оставь хотя бы короткую реплику для своего дневника.";
          return;
        }
        if (!state.completed.includes(l.id)) state.completed.push(l.id);
        l.words.forEach((w) => {
          state.reviews[w.hanzi] = { due: Date.now() + 86400000, interval: 1 };
        });
        state.session = null;
        save();
        completeLesson(l);
      },
      "primary",
    );
  }
}
function recallScreen() {
  const l = currentLesson;
  if (run.trial >= run.trials.length) {
    run.stage = "write";
    lessonScreen();
    return;
  }
  const { w, type } = run.trials[run.trial],
    body = stageBody(
      "Помоги вспомнить · " + (run.trial + 1) + " / " + run.trials.length,
    );
  body.append(
    node(
      "h3",
      type === "listen"
        ? "Какое слово произнёс житель?"
        : "Что означает эта надпись?",
    ),
  );
  if (type === "listen") speakButton(body, w.hanzi, "Послушать вопрос");
  else body.append(node("div", w.hanzi, "vocab-large"));
  const options = node("div", undefined, "options"),
    message = node("p", undefined, "lesson-message");
  const distractors = [
    ...new Map(
      l.words.filter((x) => x.ru !== w.ru).map((x) => [x.ru, x]),
    ).values(),
  ];
  const choices = shuffled([w, ...shuffled(distractors).slice(0, 3)]);
  choices.forEach((choice) =>
    addButton(options, choice.ru, () => {
      if (choice.hanzi === w.hanzi) {
        options.querySelectorAll("button").forEach((b) => (b.disabled = true));
        message.textContent = w.hanzi + " · " + w.pinyin + " — " + w.ru;
        addButton(
          body,
          "Продолжить",
          () => {
            run.trial++;
            lessonScreen();
          },
          "primary",
        );
      } else {
        message.textContent =
          "Посмотри ещё раз: " +
          w.hanzi +
          " · " +
          w.pinyin +
          " — " +
          w.ru +
          ". Слово встретится снова.";
        if (!run.trials.slice(run.trial + 1).some((t) => t.w.hanzi === w.hanzi))
          run.trials.push({ w, type: "meaning" });
      }
    }),
  );
  body.append(options, message);
}
function completeLesson(l) {
  run = null;
  currentLesson = null;
  world?.clearStudy();
  const body = openOverlay("Миссия завершена", l.title);
  body.append(
    node("div", "印", "complete-stamp"),
    node("h3", "Ещё немного ближе к городу"),
    node("p", quests[l.id].result, "intro-copy"),
  );
  const next = course[l.id + 1],
    row = node("div", undefined, "row");
  if (next)
    addButton(
      row,
      next.district !== l.district
        ? "Открыть " + districts[next.district][0]
        : "Следующая миссия",
      () => {
        if (next.district !== activeDistrict) {
          chooseDistrict(next.district);
        }
        startLesson(next.id);
      },
      "primary",
    );
  else
    body.append(
      node(
        "p",
        "Все 72 миссии пройдены. В итоговой задаче курса сохрани свою историю о вчерашнем дне и планах. Для оценки спонтанной речи понадобится разговор с преподавателем.",
      ),
    );
  addButton(row, "Вернуться в город", () => {
    closeOverlay();
    renderStory();
  });
  body.append(row);
  renderStory();
}
function notebook(tab = "words") {
  const body = openOverlay(
    "Путевой блокнот",
    tab === "words" ? "Слова, которые ты встретил" : "Черта за чертой",
  );
  const tabs = node("div", undefined, "tabs");
  addButton(
    tabs,
    "Слова",
    () => notebook("words"),
    tab === "words" ? "primary" : "",
  );
  addButton(
    tabs,
    "Прописи",
    () => notebook("writing"),
    tab === "writing" ? "primary" : "",
  );
  addButton(tabs, "Вспомнить", review);
  body.append(tabs);
  if (tab === "writing") {
    const chars = [
      ...new Set([
        "口",
        ...state.completed.flatMap((id) => course[id]?.characters || []),
      ]),
    ];
    const options = node("div", undefined, "writing-options");
    chars.forEach((c) =>
      addButton(options, c + (state.written.includes(c) ? " ✓" : ""), () =>
        writing(c, () => notebook("writing")),
      ),
    );
    body.append(options);
    return;
  }
  if (!state.words.length) {
    body.append(
      node(
        "p",
        "Начни разговор на вокзале. Здесь будут появляться встреченные слова.",
      ),
    );
    return;
  }
  const allWords = new Map(
    course.flatMap((l) => l.words).map((w) => [w.hanzi, w]),
  );
  [
    ["出口", "chūkǒu", "выход"],
    ["入口", "rùkǒu", "вход"],
  ].forEach(([hanzi, pinyin, ru]) =>
    allWords.set(hanzi, { hanzi, pinyin, ru }),
  );
  const grid = node("div", undefined, "word-grid");
  state.words.forEach((hanzi) => {
    const w = allWords.get(hanzi) || { hanzi, pinyin: "", ru: "" };
    const b = button("", () => hear(hanzi), "word-item");
    b.append(
      node("span", w.hanzi, "cn"),
      node("small", w.pinyin),
      node("span", w.ru),
    );
    if (!audioWords.has(hanzi)) {
      b.disabled = true;
      b.title = "Запись готовится";
    }
    grid.append(b);
  });
  body.append(grid);
}
function review() {
  const all = new Map(course.flatMap((l) => l.words).map((w) => [w.hanzi, w]));
  all.set("出口", { hanzi: "出口", pinyin: "chūkǒu", ru: "выход" });
  all.set("入口", { hanzi: "入口", pinyin: "rùkǒu", ru: "вход" });
  const known = state.words.map((w) => all.get(w)).filter(Boolean);
  const due = Object.entries(state.reviews)
    .filter(([, r]) => r.due <= Date.now())
    .map(([word]) => all.get(word))
    .filter(Boolean);
  const deck = shuffled(due.length ? due : known).slice(0, 10),
    failed = new Set();
  let index = 0;
  function step() {
    const body = openOverlay("Слова в новых ситуациях", "Помочь с запиской");
    if (index === deck.length) {
      body.append(
        node(
          "h3",
          deck.length ? "Записки разобраны" : "Пока нет знакомых слов",
        ),
        node(
          "p",
          deck.length
            ? "Ты вспомнил слова и помог восстановить сообщения."
            : "Начни разговор в городе, затем вернись сюда.",
        ),
      );
      addButton(body, "В город", closeOverlay, "primary");
      return;
    }
    const w = deck[index],
      previous = state.reviews[w.hanzi] || { interval: 1, context: 0 };
    const contexts = course.filter((l) => l.tokens.includes(w.hanzi));
    const context = contexts.length
      ? contexts[(previous.context || 0) % contexts.length]
      : null;
    const listening = !context && index % 2 === 0 && audioWords.has(w.hanzi);
    body.append(node("small", index + 1 + " / " + deck.length, "eyebrow"));
    if (context) {
      body.append(
        node("h3", "Восстанови пропуск в сообщении"),
        node("p", context.sentenceRu),
      );
      const sentence = node(
        "div",
        context.tokens.map((t) => (t === w.hanzi ? "〔…〕" : t)).join(" "),
        "context-sentence",
      );
      body.append(
        sentence,
        node(
          "p",
          "В пропуске слово со значением «" + w.ru + "».",
          "writing-caption",
        ),
      );
    } else if (listening) {
      body.append(
        node("h3", "Гость произносит знакомое слово. Что оно значит?"),
      );
      speakButton(body, w.hanzi, "Слушать гостя");
    } else {
      body.append(node("h3", "Как написать «" + w.ru + "»?"));
    }
    const value = (word) => (listening ? word.ru : word.hanzi);
    const pool = known.length >= 4 ? known : [...all.values()];
    const distractors = [
      ...new Map(
        pool
          .filter((word) => word.hanzi !== w.hanzi && word.ru !== w.ru)
          .map((word) => [value(word), word]),
      ).values(),
    ];
    const choices = shuffled([w, ...shuffled(distractors).slice(0, 3)]);
    const options = node("div", undefined, "options"),
      message = node("p", "", "lesson-message");
    for (const choice of choices)
      addButton(options, value(choice), () => {
        if (choice.hanzi !== w.hanzi) {
          message.textContent =
            choice.hanzi +
            " · " +
            choice.pinyin +
            " — " +
            choice.ru +
            ". Попробуй другое слово.";
          if (!failed.has(w.hanzi) && deck.length < 20) deck.push(w);
          failed.add(w.hanzi);
          state.reviews[w.hanzi] = {
            ...previous,
            interval: 1,
            due: Date.now() + 600000,
          };
          save();
          return;
        }
        options.querySelectorAll("button").forEach((b) => (b.disabled = true));
        message.textContent = w.hanzi + " · " + w.pinyin + " — " + w.ru;
        const interval = failed.has(w.hanzi)
          ? 1
          : Math.min(30, previous.interval * 2);
        state.reviews[w.hanzi] = {
          interval,
          due:
            Date.now() + (failed.has(w.hanzi) ? 600000 : interval * 86400000),
          context: (previous.context || 0) + 1,
        };
        save();
        const row = node("div", undefined, "row");
        speakButton(row, w.hanzi);
        addButton(
          row,
          "Следующая записка",
          () => {
            index++;
            step();
          },
          "primary",
        );
        body.append(row);
      });
    body.append(options, message);
  }
  step();
}

function writing(character, onDone, title = "Путевой блокнот") {
  let mode = "watch",
    instance = null;
  function draw() {
    const body = openOverlay(
      mode === "write" ? "Проверка письма" : title,
      mode === "write" ? "Напиши по памяти" : "Пишем «" + character + "»",
    );
    const generation = writingGeneration;
    const wrap = node("div", undefined, "lesson-stage");
    body.append(wrap);
    wrap.append(
      node(
        "small",
        mode === "watch"
          ? "Посмотри"
          : mode === "trace"
            ? "Обведи контур"
            : "Напиши по памяти",
        "eyebrow",
      ),
    );
    const message = node(
      "p",
      mode === "watch"
        ? "Посмотри, как черты складываются в знак."
        : mode === "trace"
          ? "Обводи черты в показанном порядке."
          : "Пиши без контура, сохраняя порядок черт.",
      "writing-caption",
    );
    if (mode === "write") {
      const words = course.flatMap((l) => l.words);
      const word =
        words.find((w) => w.hanzi === character) ||
        words.find((w) => w.hanzi.startsWith(character));
      if (word)
        wrap.append(
          node(
            "p",
            (word.hanzi === character ? "" : "Первый знак слова ") +
              "«" +
              word.ru +
              "» · " +
              word.pinyin,
            "writing-caption",
          ),
        );
    }
    const board = node("div", undefined, "writing-board");
    board.setAttribute("aria-label", "Поле для письма " + character);
    board.setAttribute("role", "application");
    wrap.append(board, message);
    const controls = node("div", undefined, "row");
    wrap.append(controls);
    if (!window.HanziWriter) {
      message.textContent =
        "Прописи не загрузились. Обнови страницу и попробуй снова.";
      return;
    }
    try {
      instance = window.HanziWriter.create(board, character, {
        width: Math.min(290, $("overlay").clientWidth - 42),
        height: Math.min(290, $("overlay").clientWidth - 42),
        padding: 22,
        showCharacter: mode === "watch",
        showOutline: mode !== "write",
        strokeColor: "#304b3d",
        outlineColor: "#dddccb",
        drawingColor: "#a6653b",
        highlightColor: "#b96d43",
        highlightCompleteColor: "#597d59",
        strokeAnimationSpeed: 0.7,
        delayBetweenStrokes: 350,
        charDataLoader: (char, onLoad, onError) => {
          fetch("./hanzi/" + encodeURIComponent(char) + ".json")
            .then((r) => {
              if (!r.ok) throw Error("data");
              return r.json();
            })
            .then((data) => {
              if (generation !== writingGeneration) return;
              onLoad(data);
              controls
                .querySelectorAll("button")
                .forEach((b) => (b.disabled = false));
            })
            .catch(() => {
              if (generation === writingGeneration) {
                message.textContent =
                  "Данные не загрузились. Можно повторить загрузку.";
                controls.replaceChildren();
                addButton(controls, "Повторить", draw);
              }
              onError();
            });
        },
      });
      writer = instance;
    } catch {
      message.textContent = "Не удалось открыть пропись.";
      addButton(controls, "Повторить", draw);
      return;
    }
    if (mode === "watch") {
      const animate = addButton(controls, "Показать написание", async () => {
        animate.disabled = true;
        await instance.animateCharacter();
        if (generation === writingGeneration) animate.disabled = false;
      });
      const trace = addButton(
        controls,
        "Обвести",
        () => {
          mode = "trace";
          draw();
        },
        "primary",
      );
      animate.disabled = trace.disabled = true;
    } else {
      instance.quiz({
        leniency: 1,
        acceptBackwardsStrokes: false,
        markStrokeCorrectAfterMisses: false,
        showHintAfterMisses: mode === "trace" ? 2 : false,
        onMistake: () => {
          if (generation === writingGeneration)
            message.textContent =
              "Проверь направление и порядок черт. Попробуй ещё раз.";
        },
        onCorrectStroke: (d) => {
          if (generation === writingGeneration)
            message.textContent = d.strokesRemaining
              ? "Осталось черт: " + d.strokesRemaining
              : "Все черты на месте.";
        },
        onComplete: () => {
          if (generation !== writingGeneration) return;
          controls.replaceChildren();
          if (mode === "trace") {
            message.textContent =
              "Контур освоен. Теперь напиши знак по памяти.";
            addButton(
              controls,
              "Написать самостоятельно",
              () => {
                mode = "write";
                draw();
              },
              "primary",
            );
          } else {
            if (!state.written.includes(character))
              state.written.push(character);
            save();
            message.textContent = "Ты написал знак самостоятельно.";
            addButton(controls, "Продолжить", onDone, "primary");
            addButton(controls, "Ещё раз", () => {
              mode = "write";
              draw();
            });
          }
        },
      });
      addButton(controls, "Посмотреть образец", () => {
        mode = "watch";
        draw();
      });
    }
  }
  draw();
}
function exportProgress() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob);
  const a = node("a");
  a.href = url;
  a.download = "shanjiang-progress.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function about() {
  const body = openOverlay("Шаньцзян", "Маленькие шаги в большой мир");
  body.append(
    node(
      "p",
      "72 последовательные миссии: основы произношения, знакомство, покупки, семья, время, еда, город, работа, прошлое, выбор, здоровье и планы. Маршрут охватывает темы до A2. Результаты заданий помогают отслеживать практику, а оценка уровня разговорной речи требует общения.",
      "intro-copy",
    ),
  );
  body.append(
    node(
      "p",
      "Касайся земли, чтобы идти. Веди пальцем, чтобы вращать камеру. Два пальца меняют масштаб. На компьютере работает колесо мыши. Персонажи и вывески открывают миссии. Прогресс сохраняется в этом браузере.",
      "intro-copy",
    ),
  );
  const links = [
    [
      "Записи носителей — Yue Tan и audio-cmn, CC BY-SA 3.0 US",
      "https://github.com/hugolpz/audio-cmn",
    ],
    [
      "Данные письма — Make Me a Hanzi, Arphic Public License",
      "./hanzi/ARPHICPL.TXT",
    ],
    ["Three.js — MIT", "./vendor/LICENSE-three"],
    ["Hanzi Writer — MIT", "./vendor/LICENSE-hanzi-writer"],
  ];
  links.forEach(([label, url]) => {
    const p = node("p"),
      a = node("a", label);
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    p.append(a);
    body.append(p);
  });
  const row = node("div", undefined, "row");
  addButton(row, "Сохранить прогресс", exportProgress);
  const input = node("input");
  input.type = "file";
  input.accept = "application/json";
  input.hidden = true;
  input.onchange = async () => {
    try {
      const data = JSON.parse(await input.files[0].text());
      if (
        data.version !== 2 ||
        !Array.isArray(data.completed) ||
        !Array.isArray(data.words) ||
        !Array.isArray(data.written) ||
        !Number.isInteger(data.intro) ||
        data.intro < 0 ||
        data.intro > 12 ||
        data.completed.some(
          (id) => !Number.isInteger(id) || id < 0 || id >= 72,
        ) ||
        data.words.some((w) => typeof w !== "string") ||
        data.written.some((w) => typeof w !== "string")
      )
        throw Error("format");
      state = {
        ...fresh(),
        intro: data.intro,
        completed: [...new Set(data.completed)],
        words: [...new Set(data.words)],
        written: [...new Set(data.written)],
        notes: typeof data.notes === "object" && data.notes ? data.notes : {},
      };
      currentLesson = null;
      run = null;
      world?.clearStudy();
      save();
      chooseDistrict(0);
      toast("Прогресс восстановлен.");
    } catch {
      toast("Файл прогресса не распознан.");
    }
  };
  addButton(row, "Загрузить прогресс", () => input.click());
  row.append(input);
  body.append(row);
}
$("map-button").onclick = map;
$("home").onclick = map;
$("book-button").onclick = () => notebook();
$("help-button").onclick = about;
$("rotate-left").onclick = () => world?.rotate(-Math.PI / 4);
$("rotate-right").onclick = () => world?.rotate(Math.PI / 4);
$("zoom-in").onclick = () => world?.zoom(-0.15);
$("zoom-out").onclick = () => world?.zoom(0.15);
try {
  const results = await Promise.all([
    fetch("./curriculum.json"),
    fetch("./audio/manifest.json?v=3"),
    fetch("./quests.json"),
  ]);
  if (results.some((r) => !r.ok)) throw Error("course");
  [course, audioWords, quests] = await Promise.all(
    results.map((r) => r.json()),
  );
  if (quests.length !== course.length) throw Error("quest data");
  audioWords = new Set(audioWords);
  try {
    world = createWorld($("world"), interact);
  } catch (error) {
    console.warn("3D scene unavailable", error);
    $("fallback").hidden = false;
  }
  $("loading").hidden = true;
  if (
    Number.isInteger(state.district) &&
    state.district > 0 &&
    state.district < 12 &&
    unlocked(state.district)
  ) {
    activeDistrict = state.district;
    world?.district(activeDistrict);
    $("place").textContent = districts[activeDistrict][0];
    $("district-hanzi").textContent = districts[activeDistrict][1];
    $("district-subtitle").textContent = districts[activeDistrict][2];
  }
  if (
    state.session &&
    Number.isInteger(state.session.lessonId) &&
    course[state.session.lessonId] &&
    state.session.run
  ) {
    currentLesson = course[state.session.lessonId];
    run = state.session.run;
    if (run.stage === "words") run.stage = "explore";
  }
  save();
  renderStory();
} catch (error) {
  $("loading").replaceChildren(
    node("p", "Не удалось загрузить путешествие. Проверь соединение."),
    button("Повторить", () => location.reload()),
  );
}
