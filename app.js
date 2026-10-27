// Пилот: куда уходят заявки. Заменить на реальные перед запуском.
const CONTACT_EMAIL = "zamowienia@example.pl";
const WHATSAPP_PHONE = "48000000000";   // номер в международном формате без «+»
const TELEGRAM_USER = "czesci_z_korei"; // имя пользователя без «@»


// Системная настройка «уменьшить движение» — анимации и автосмену не запускаем.
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const zl = (n) => Math.round(n).toLocaleString("pl-PL") + " zł";
const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const state = { model: "all", cat: null, q: null, brand: null };
let lang = pickLang();

function pickLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q in I18N) return q;
  try {
    const saved = localStorage.getItem("lang");
    if (saved in I18N) return saved;
  } catch (e) { /* хранилище недоступно — не страшно */ }
  return "pl";
}

const t = (key) => I18N[lang][key] ?? I18N.pl[key] ?? key;
const tr = (obj) => obj[lang] ?? obj.pl;
const save = (ours, pl) => Math.round((1 - ours / pl) * 100);
const $ = (id) => document.getElementById(id);
// Подпись «Ceny sprawdzone 26.10.2026 · kurs NBP» — дата сверки цен (PRICES_CHECKED в data.js), формат под язык.
function stamp() {
  const d = new Date(PRICES_CHECKED + "T12:00:00");
  const date = lang === "pl"
    ? d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return t("prices.checked").replace("{d}", date);
}

function applyLang() {
  document.documentElement.lang = lang;
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.innerHTML = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  document.querySelectorAll("[data-stamp]").forEach((el) => (el.textContent = stamp()));
  $("langCur").textContent = lang.toUpperCase();
  langOptions();
  searchErr("");
  if (dlg.open) rqRender();
  messengerLinks();
  footContacts();
  footLang();
  pauseLabel();
  delivery();
  brands();
  models();
  compare();
  kits();
  render();
  how();
}

// Прямые ссылки на мессенджеры (кнопки FAQ) — с общим текстом; заявка с деталями — в окне «Zapytanie».
function messengerLinks() {
  const href = {
    wa: `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(t("wa.text"))}`,
    tg: `https://t.me/${TELEGRAM_USER}`,
  };
  document.querySelectorAll("[data-msg]").forEach((a) => (a.href = href[a.dataset.msg]));
}

// Контакты в подвале — из тех же констант, что и заявка.
function footContacts() {
  $("footWa").textContent = PHONE;
  $("footTg").textContent = "@" + TELEGRAM_USER;
  $("footMailTxt").textContent = CONTACT_EMAIL;
  $("footMail").href = `mailto:${CONTACT_EMAIL}`;
}

/* ---------- Первый экран: меняющаяся модель и поле поиска ---------- */

// Модель в заголовке уезжает вправо, следующая въезжает слева. Машины по краям статичные.
let rotI = 0;
function rotate() {
  const el = $("rot");
  el.classList.remove("is-in");
  el.classList.add("is-out");
  rotI = (rotI + 1) % POPULAR.length;
  setTimeout(() => {
    el.textContent = POPULAR[rotI].name;
    el.classList.remove("is-out");
    void el.offsetWidth;
    el.classList.add("is-in");
  }, 450);
}
$("rot").textContent = POPULAR[0].name;
// Смена модели (WCAG 2.2.2): два круга и стоп; пауза, пока пользователь в поиске или наводит на первый экран;
// при «уменьшить движение» в системе — не крутим вовсе.
let rotLeft = REDUCED ? 0 : POPULAR.length * 2;
let heroHold = false;
const hero = document.querySelector(".hero");
hero.addEventListener("mouseenter", () => (heroHold = true));
hero.addEventListener("mouseleave", () => (heroHold = false));
hero.addEventListener("focusin", () => (heroHold = true));
hero.addEventListener("focusout", () => (heroHold = false));
const rotTimer = setInterval(() => {
  if (rotLeft <= 0) return clearInterval(rotTimer);
  if (document.hidden || heroHold) return;
  rotate();
  rotLeft--;
}, 3200);

// Параллакс первого экрана: машины отстают от прокрутки и чуть расходятся, наклейки уходят быстрее (ближе к зрителю),
// текст почти на месте и гаснет к низу экрана; «Popularne modele» наезжает сверху (styles.css).
// Только transform/opacity, один кадр rAF на прокрутку и только пока hero виден; на телефоне слабее; «уменьшить движение» — нет.
const heroMore = $("heroMore");
if (!REDUCED) {
  const sides = hero.querySelectorAll(".hero__side"), heroIn = hero.querySelector(".hero__in"), facts = hero.querySelector(".facts");
  let heroSeen = true, queued = false;
  const parallax = () => {
    queued = false;
    const h = hero.offsetHeight, y = Math.min(Math.max(scrollY, 0), h), p = y / h;
    // телефон: первый экран выше окна, текст не гасим — только машина под поиском чуть отстаёт
    if (innerWidth <= 960) {
      sides.forEach((el) => (el.style.transform = `translate3d(0, ${y * 0.1}px, 0)`));
      facts.style.transform = heroIn.style.transform = heroIn.style.opacity = "";
      return;
    }
    sides.forEach((el, i) => (el.style.transform = `translate3d(${(i ? 1 : -1) * y * 0.08}px, ${y * 0.2}px, 0)`));
    facts.style.transform = innerWidth >= 1200 ? `translate3d(0, ${-y * 0.12}px, 0)` : "";
    heroIn.style.transform = `translate3d(0, ${y * 0.08}px, 0)`;
    heroIn.style.opacity = Math.max(0, 1 - Math.max(0, p - 0.25) / 0.55).toFixed(3);
  };
  const onScroll = () => {
    if (scrollY > 8) heroMore.classList.add("is-gone");
    if (heroSeen && !queued) { queued = true; requestAnimationFrame(parallax); }
  };
  new IntersectionObserver((en) => { heroSeen = en[0].isIntersecting; if (heroSeen) onScroll(); }).observe(hero);
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  onScroll();
} else heroMore.remove();

// Одно поле: VIN (17 знаков, без I/O/Q) или номер OE Mobis (5 цифр и 3–7 знаков: 51712-R0150). Пробелы и дефисы не важны.
// Enter / «→»: VIN — окно заявки на шаге «To Twoje auto?», OE — деталь в заявку (из витрины — с названием).
// Ошибка формата — под полем, окно не открывается.
const isOe = (q) => /^\d{5}[A-Z0-9]{3,7}$/.test(q);
const oeFmt = (q) => q.slice(0, 5) + "-" + q.slice(5);
function vinCheck(raw) {
  const vin = norm(raw);
  return { vin, err: /[IOQ]/.test(vin) ? "search.vin.ioq" : vin.length > 17 ? "search.vin.long" : null };
}
// Номер короче 17 знаков, но длиннее OE, — недописанный VIN.
const vinShort = (vin) => t("search.vin.short").replace("{n}", vin.length);
function searchErr(text) {
  $("searchMsg").textContent = text;
  if (text) $("searchInput").setAttribute("aria-invalid", "true");
  else $("searchInput").removeAttribute("aria-invalid");
}
// При вводе — только ошибки, которые уже точны: I/O/Q или лишние знаки в длинном номере.
$("searchInput").addEventListener("input", (e) => {
  const { vin, err } = vinCheck(e.target.value);
  searchErr(vin.length > 12 && err ? t(err) : "");
});
$("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const { vin: q, err } = vinCheck($("searchInput").value);
  if (q.length === 17 && !err) { searchErr(""); return reqVin(q); }
  if (isOe(q)) { searchErr(""); return reqOe(q); }
  searchErr(!q ? t("search.empty") : q.length > 12 ? (err ? t(err) : vinShort(q)) : t("search.bad"));
  $("searchInput").focus();
});

/* ---------- Заявка: одно окно «Zapytanie» — 3 шага + «готово» ---------- */

// Прототип одобрен 2026-10-27 (аудит и вайрфреймы — docs/research/request_flow_ux.md). Нативный <dialog> #vinDlg:
// сверху «‹ Wstecz» · «Krok N z 3» · крестик, заголовок шага — сам вопрос, внизу одна главная кнопка.
// Одна заявка req на всю страницу (до перезагрузки): любой вход её дополняет и открывает окно на первом шаге,
// где чего-то не хватает. Шаг 1 «авто» — виды rq.view: how (VIN неизвестен: «Mam VIN / Nie mam / Arena»), vin (поле VIN),
// ok (модель известна — подтвердить), model (список моделей марки), brand (Kia / Hyundai / Genesis), other (свой model).
// Шаг 2 — детали, шаг 3 — сводка и канал (WhatsApp / Telegram / e-mail), "done" — честный статус и запасной путь.
// Год не спрашиваем и не показываем: 10-й знак VIN у KDM не проверен (VIN_YEARS в data.js).
// parts: { id, name (строка или { pl, en }), oe, model (ключ витрины), kit (подпись авто набора) }.
const req = { vin: "", brand: null, model: null, gen: null, other: "", carOk: false, arena: false, parts: [], urgent: false, draft: "", vinDraft: "" };
const rq = { step: 1, view: "how", hist: [], done: null, copied: false };
const dlg = $("vinDlg");
let opener = null;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const brandName = (k) => (BRANDS.find((b) => b.key === k) || {}).name || "";
const carModel = () => (CARS[req.brand] || []).find((m) => m.key === req.model);
const modelName = () => (req.model === "other" ? req.other.trim() : (carModel() || {}).name || "");
const carName = () => [brandName(req.brand), modelName()].filter(Boolean).join(" ");
// Поколение (gen — индекс в CARS[марка][модель].gens, "?" — «Nie wiem», null — не спрашивали): только без VIN —
// с VIN подберём сами (10-й знак у KDM не проверен, на него не опираемся).
const genYears = (g) => `${g.from}–${g.to || new Date().getFullYear()}`;
function genText() {
  const g = req.gen === "?" ? null : ((carModel() || {}).gens || [])[req.gen];
  return req.gen === "?" ? t("rq.year.unknown") : g ? `${genYears(g)} (${g.code})` : "";
}
const carFull = () => [carName(), genText()].filter(Boolean).join(" · ");
// Без VIN и поколений несколько — спросить «Który rocznik?»; одно — записать сразу.
function carDone() {
  const gens = (carModel() || {}).gens || [];
  if (req.vin || req.model === "other" || req.gen !== null || gens.length < 2) {
    if (!req.vin && req.gen === null && gens.length === 1) req.gen = 0;
    req.carOk = true;
    return go(2);
  }
  go(1, "year");
}
// Марка по WMI (знаки 1–3), модель по префиксу — только где известна точно (VIN_MODELS: KNDN → Carnival, KM8R → Palisade).
function vinDecode(vin) {
  const hit = VIN_MODELS.find((x) => vin.startsWith(x.prefix));
  return { brand: VIN_BRANDS[vin.slice(0, 3)] || null, model: hit ? hit.model : null };
}
function setVin(vin) {
  req.vinDraft = vin;
  if (vin === req.vin) return;
  Object.assign(req, { vin, ...vinDecode(vin), gen: null, other: "", carOk: false });
}
// Вид шага 1 по тому, что известно: модель — подтвердить; есть VIN или «klient Arena» — марка/модель; иначе — как узнать авто.
function carView() {
  if (req.model) return "ok";
  if (req.vin || req.arena) return req.brand ? "model" : "brand";
  return "how";
}

// Детали
const itemPart = (it) => ({ id: "i" + ITEMS.indexOf(it), name: it.name, oe: it.oe, model: it.model });
const kitPart = (b) => ({ id: "k" + BUNDLES.indexOf(b), name: b.name, kit: b.car || MODELS[b.model], model: b.model });
const textPart = (s) => ({ id: "t" + s.toLowerCase(), name: s[0].toUpperCase() + s.slice(1) });
const partName = (p) => (p.kit ? `${t("vit.kit")}: ` : "") + (p.name ? tr(typeof p.name === "string" ? { pl: p.name } : p.name) : `OE ${p.oe}`);
const partText = (p) => partName(p) + (p.kit ? ` (${p.kit})` : p.name && p.oe ? ` (OE ${p.oe})` : "");
function addPart(p) {
  if (!req.parts.some((x) => x.id === p.id)) req.parts.push(p);
}
// Номер из поля: из витрины — с названием, иначе просто «OE …».
function oePart(q) {
  const it = ITEMS.find((x) => norm(x.oe) === q);
  return it ? itemPart(it) : { id: "o" + q, oe: oeFmt(q) };
}
// Подсказки: у модели из витрины — её 3 самые выгодные детали, иначе «Często szukane» (COMMON_PARTS).
function sugList() {
  const v = (carModel() || {}).vitrine;
  if (!v) return { k: "rq.sug.common", list: COMMON_PARTS.map((n, i) => ({ id: "c" + i, name: n })) };
  const pct = (it) => (it.pl ? save(it.ours, it.pl) : -1);
  return { k: "rq.sug.pop", list: ITEMS.filter((it) => it.model === v).sort((a, b) => pct(b) - pct(a)).slice(0, 3).map(itemPart) };
}

/* Входы */

// Открыть окно: шаг — первый, где чего-то не хватает (или заданный), вид шага 1 — по тому, что известно.
// Детали с карточек и номер OE открывают шаг 2, если авто уже подтверждено.
// После отправки — новая заявка на то же авто: детали и срочность сбрасываются (до того, как вход добавит свою деталь).
function reqFresh() {
  if (rq.step !== "done") return;
  Object.assign(req, { parts: [], urgent: false, draft: "" });
  rq.step = 1;
}
function reqOpen(step, view) {
  reqFresh();
  rq.hist = [];
  rq.step = step || (!req.carOk ? 1 : !req.parts.length ? 2 : 3);
  rq.view = view || carView();
  if (!dlg.open) {
    opener = document.activeElement;
    dlg.showModal();
    fitDialog();
  }
  rqRender();
  rqFocus();
}
function reqVin(vin) { setVin(vin); reqOpen(1); }
function reqOe(q) { reqFresh(); addPart(oePart(q)); reqOpen(req.carOk ? 2 : 1); }
// «Wyślij VIN» на карточке модели: модель уже выбрана, VIN можно добавить в карточке подтверждения.
function reqCar(m) {
  if (req.vin && vinDecode(req.vin).brand !== m.brand) req.vin = "";
  Object.assign(req, { brand: m.brand, model: m.key, gen: null, other: "", carOk: false });
  reqOpen(1, "ok");
}
// Все кнопки заявки на странице: ссылки #vin, «Zapytaj», «Zamów zestaw», ссылки под поиском, баннеры.
document.addEventListener("click", (e) => {
  const el = e.target.closest('a[href="#vin"], [data-ask-item], [data-ask-kit], [data-ask-key], [data-req], [data-arena]');
  if (!el || el.closest("#vinDlg")) return;
  e.preventDefault();
  reqFresh();
  const d = el.dataset;
  if (d.askItem) addPart(itemPart(ITEMS[+d.askItem]));
  else if (d.askKit) addPart(kitPart(BUNDLES[+d.askKit]));
  else if (d.askKey) addPart({ id: "t" + d.askKey, name: { pl: I18N.pl[d.askKey], en: I18N.en[d.askKey] } });
  if (d.req === "car") return reqOpen(1, "brand");
  if (d.req === "arena" || "arena" in d) { req.arena = true; return reqOpen(1, req.model ? "ok" : "brand"); }
  // С детали — на шаг деталей (видно, что добавилось), если авто уже есть; иначе сначала авто.
  reqOpen(d.askItem || d.askKit || d.askKey ? (req.carOk ? 2 : 1) : null);
});

/* Навигация */

function go(step, view) {
  rq.hist.push([rq.step, rq.view]);
  rq.step = step;
  if (view) rq.view = view;
  rqRender();
  rqFocus();
}
// «‹ Wstecz»: по истории, а если окно открыли сразу на шаге 2 или 3 — на шаг раньше.
$("rqBack").addEventListener("click", () => {
  const prev = rq.hist.pop() || (rq.step === 3 ? [2, rq.view] : [1, carView()]);
  [rq.step, rq.view] = prev;
  rqRender();
  rqFocus();
});
// Фокус: поле шага, где надо писать, иначе заголовок-вопрос.
function rqFocus() {
  const f = rq.step === 1 ? { vin: "rqVin", other: "rqOther" }[rq.view] : rq.step === 2 && !req.parts.length ? "rqAdd" : null;
  ($(f) || $("rqH")).focus({ preventScroll: true });
  $("rqBody").scrollTop = 0;
}
function rqErr(text, field) {
  $("rqErr").textContent = text;
  const f = $(field);
  if (text) { f.setAttribute("aria-invalid", "true"); f.focus(); }
  else f.removeAttribute("aria-invalid");
}

/* Шаги */

const head = (title, sub) => `<h2 class="rq__h" id="rqH" tabindex="-1">${title}</h2>${sub ? `<p class="rq__sub">${sub}</p>` : ""}`;
const next = (act, key = "rq.next") => `<button type="button" class="btn rq__go" data-go="${act}">${t(key)} <span aria-hidden="true">›</span></button>`;
// Строка-кнопка списка: заголовок, подпись muted, «›»; клик сразу ведёт дальше.
// aside — тихая подпись справа (код поколения).
const opt = (act, title, sub, pre = "", aside = "") => `<button type="button" class="rq__opt" data-go="${act}">${pre}<span class="rq__opt-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span>${aside ? `<span class="rq__aside">${aside}</span>` : ""}<span class="rq__chev" aria-hidden="true">›</span></button>`;
const field = (id, cls, val, ph, extra = "") => `<div class="rq__f"><input class="rq__field ${cls}" id="${id}" value="${esc(val)}" autocomplete="off" spellcheck="false" placeholder="${ph}" aria-label="${ph}" aria-describedby="rqErr"${extra}>
  <p class="rq__err" id="rqErr" role="alert"></p></div>`;

function rqCar() {
  // Пришли с детали — над вопросом тихо, о чём спрашивают.
  const n = req.parts.length;
  const ctx = n && rq.view !== "vin" && rq.view !== "other" ? `<p class="rq__ctx">${t("rq.asking")} ${esc(partName(req.parts[0]))}${n > 1 ? ` +${n - 1}` : ""}</p>` : "";
  switch (rq.view) {
    case "vin":
      return head(t("rq.vin.h")) + field("rqVin", "is-vin", req.vinDraft, t("rq.vin.ph"), ' maxlength="24" autocapitalize="characters" inputmode="text"')
        + `<p class="rq__sub">${t("rq.vin.where")}</p>` + next("vin:next");
    case "ok": {
      const vin = req.vin ? `<span class="rq__vin">${req.vin}</span>`
        : `<button type="button" class="rq__link" data-go="ok:vin">${t("rq.ok.addvin")}</button>`;
      return ctx + head(t("rq.ok.h")) + `<div class="rq__car"><small>${esc(brandName(req.brand))}</small><b>${esc(carName())}</b>${vin}</div>
        <div class="rq__btns"><button type="button" class="btn rq__go" data-go="ok:yes">${t("rq.ok.yes")} <span aria-hidden="true">›</span></button>
        <button type="button" class="btn btn--ghost rq__go" data-go="ok:no">${t("rq.ok.no")}</button></div>`;
    }
    case "model": {
      const fromVin = req.vin && vinDecode(req.vin).brand === req.brand;
      return ctx + head(t("rq.model.h").replace("{b}", brandName(req.brand)), fromVin ? t("rq.model.vin") : "")
        + `<div class="rq__opts">${(CARS[req.brand] || []).map((m) => opt("model:" + m.key, esc(m.name))).join("")}${opt("model:other", t("rq.other"))}</div>`;
    }
    case "brand":
      return ctx + head(t("rq.brand.h"), req.vin ? t("rq.brand.vin") : "")
        + `<div class="rq__opts">${["kia", "hyundai", "genesis"].map((k) => BRANDS.find((b) => b.key === k)).map((b) =>
          opt("brand:" + b.key, b.name, "", `<span class="rq__logo"><img src="${b.logo}" alt="" style="height:${b.h}px"></span>`)).join("")}</div>`;
    case "year": {
      // Последнее поколение сверху: слева годы крупно, справа muted код поколения; последней строкой «Nie wiem».
      const gens = (carModel() || {}).gens || [];
      return ctx + head(t("rq.year.h"), esc(carName())) + `<div class="rq__opts">${gens.map((g, i) => [g, i]).reverse().map(([g, i]) =>
        opt("year:" + i, genYears(g), "", "", g.code)).join("")}${opt("year:?", t("rq.year.any"))}</div>`;
    }
    case "other":
      return head(t("rq.other.h").replace("{b}", brandName(req.brand))) + field("rqOther", "", req.other, t("rq.other.ph")) + next("other:next");
    default:
      return ctx + head(t("rq.how.h")) + `<div class="rq__opts">${opt("how:vin", t("rq.how.vin"), t("rq.how.vin.s"))}
        ${opt("how:novin", t("rq.how.novin"), t("rq.how.novin.s"))}${opt("how:arena", t("rq.how.arena"), t("rq.how.arena.s"))}</div>`;
  }
}

function rqParts() {
  return head(t("rq.parts.h")) + `<ul class="rq__chips" id="rqList"></ul><p class="rq__sub" id="rqWarn" hidden></p>
    <div class="rq__f"><div class="rq__add"><input id="rqAdd" value="${esc(req.draft)}" autocomplete="off" placeholder="${t("rq.parts.ph")}" aria-label="${t("rq.parts.ph")}" aria-describedby="rqErr">
      <button type="button" class="round" data-go="parts:add" aria-label="${t("rq.add")}">+</button></div>
    <p class="rq__err" id="rqErr" role="alert"></p></div>
    <p class="rq__sug" id="rqSug"></p>
    <div class="rq__dlv" role="group" aria-labelledby="rqDlvK"><p class="rq__k" id="rqDlvK">${t("rq.sum.dlv")}</p>
      <div class="seg">${[["c", false], ["e", true]].map(([m, on]) => `<button type="button" data-dlv="${m}" aria-pressed="${req.urgent === on}">
        ${t(`del.${m}.tab`)}<small>${t(`rq.dlv.${m}.s`)}</small></button>`).join("")}</div>
      <p class="rq__sub">${t("rq.dlv.note")}</p><p class="rq__sub" id="rqEms" hidden></p></div>
    <p class="rq__sub">${t("rq.photo")}</p>` + next("parts:next");
}
// Список выбранных деталей и подсказки — без перерисовки поля (на телефоне клавиатура не прячется).
// Деталь витрины или набор, которые экспрессом выйдут дороже, чем новые в Польше (ems > pl, data.js), — тихая строка
// под выбором доставки, пока выбран экспресс.
const partSrc = (p) => (p.id[0] === "i" ? ITEMS : p.id[0] === "k" ? BUNDLES : [])[+p.id.slice(1)];
function rqEms() {
  const el = $("rqEms");
  if (!el) return;
  const dear = req.urgent ? req.parts.filter((p) => { const x = partSrc(p); return x && x.pl && x.ems > x.pl; }) : [];
  el.hidden = !dear.length;
  el.textContent = t("rq.dlv.ems").replace("{p}", dear.map(partName).join(", "));
}
function rqList() {
  rqEms();
  $("rqList").innerHTML = req.parts.map((p, i) => `<li class="rq__chip"><span>${esc(partName(p))}${p.name && p.oe ? ` <small>OE ${p.oe}</small>` : ""}${p.kit ? ` <small>${esc(p.kit)}</small>` : ""}</span>
    <button type="button" class="rq__rm" data-rm="${i}" aria-label="${t("rq.rm")}: ${esc(partName(p))}">×</button></li>`).join("");
  // Деталь с карточки для другой модели — тихая подпись под списком.
  const v = (carModel() || {}).vitrine;
  const other = req.carOk ? [...new Set(req.parts.filter((p) => p.model && p.model !== v).map((p) => MODELS[p.model]))] : [];
  $("rqWarn").hidden = !other.length;
  $("rqWarn").textContent = t("rq.warn").replace("{m}", other.join(", "));
  const sug = sugList(), left = sug.list.filter((p) => !req.parts.some((x) => x.id === p.id));
  $("rqSug").innerHTML = left.length ? `<span>${t(sug.k)}</span> ${left.map((p) =>
    `<button type="button" class="rq__link" data-sug="${p.id}">+ ${esc(partName(p))}</button>`).join(" ")}` : "";
}
// Из поля: через запятую — несколько деталей; номер OE узнаём по формату.
function addDraft() {
  const f = $("rqAdd");
  f.value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).forEach((s) => addPart(isOe(norm(s)) ? oePart(norm(s)) : textPart(s)));
  f.value = req.draft = "";
  rqErr("", "rqAdd");
  rqList();
  f.focus();
}

function rqSend() {
  const auto = `${esc(carName())}${genText() ? `<small>${esc(genText())}</small>` : ""}<small>${req.vin ? `<span class="rq__vin">${req.vin}</span>` : t("rq.novin")}${req.arena ? " · " + t("rq.arena") : ""}</small>`;
  const row = (k, v, act) => `<div class="rq__row"><dt>${t(k)}</dt><dd>${v}</dd>
    <button type="button" class="rq__link" data-go="${act}" aria-label="${t("rq.change")}: ${t(k)}">${t("rq.change")}</button></div>`;
  return head(t("rq.send.h")) + `<dl class="rq__sum">${row("rq.sum.car", auto, "sum:car")}
    ${row("rq.sum.parts", req.parts.map((p) => esc(partName(p)) + (p.name && p.oe ? ` <span class="rq__oe">OE ${p.oe}</span>` : "")
      + (p.kit ? ` <span class="rq__oe">${esc(p.kit)}</span>` : "")).join("<br>"), "sum:parts")}
    ${row("rq.sum.dlv", t(req.urgent ? "rq.dlv.e" : "rq.dlv.c"), "sum:dlv")}</dl>
    <a class="btn rq__go rq__ch" data-ch="wa" target="_blank" rel="noopener">${ix("whatsapp")}<span>${t("rq.wa")}</span> <span aria-hidden="true">›</span></a>
    <div class="rq__alts"><a class="btn btn--ghost rq__ch" data-ch="tg" target="_blank" rel="noopener">${ix("telegram")}Telegram</a>
      <a class="btn btn--ghost rq__ch" data-ch="mail">${ix("mail")}E-mail</a></div>
    <p class="rq__sub">${t("rq.send.note")}</p>`;
}

// Готово: честный статус — что открылось и что делать, если не открылось.
const PHONE = "+" + WHATSAPP_PHONE.slice(0, 2) + " " + WHATSAPP_PHONE.slice(2).replace(/(\d{3})(?=\d)/g, "$1 ");
function rqDone() {
  const { ch, ok } = rq.done;
  const chat = `<a class="rq__link" href="https://t.me/${TELEGRAM_USER}" target="_blank" rel="noopener">${t("rq.done.tg.open")} ›</a>`;
  const title = ch === "tg" ? t(ok ? "rq.done.tg" : "rq.done.tg.fail") : t("rq.done." + ch);
  const p = ch !== "tg" ? t("rq.done.p") : ok ? chat : `${t("rq.done.tg.fail.p")}<br>${chat}`;
  return `<span class="rq__ok">${ix({ wa: "whatsapp", tg: "telegram", mail: "mail" }[ch])}</span>` + head(title) + `<p class="rq__sub">${p}</p>
    <div class="rq__fb"><b>${t("rq.fb.h")}</b>
      <button type="button" class="btn btn--ghost btn--sm" data-go="done:copy">${t(rq.copied ? "rq.copied" : "rq.copy")}</button>
      <p class="rq__sub">WhatsApp ${PHONE} · Telegram @${TELEGRAM_USER} · ${CONTACT_EMAIL}</p></div>
    <button type="button" class="btn btn--ghost rq__go" data-dlg-close>${t("rq.home")}</button>`;
}

function rqRender() {
  const s = rq.step;
  $("rqBack").hidden = s === "done" || (!rq.hist.length && s === 1);
  $("rqStep").textContent = s === "done" ? "" : t("rq.step").replace("{n}", s);
  $("rqBody").innerHTML = `<div class="rq__pane">${s === 1 ? rqCar() : s === 2 ? rqParts() : s === 3 ? rqSend() : rqDone()}</div>`;
  ixFill($("rqBody"));
  if (s === 2) rqList();
  if (s === 3) rqLinks();
}

/* Действия в окне */

$("rqBody").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-rm]");
  if (rm) { req.parts.splice(+rm.dataset.rm, 1); rqList(); return $("rqAdd").focus(); }
  const sug = e.target.closest("[data-sug]");
  if (sug) { addPart(sugList().list.find((p) => p.id === sug.dataset.sug)); rqErr("", "rqAdd"); rqList(); return $("rqAdd").focus(); }
  const ch = e.target.closest("[data-ch]");
  if (ch) return rqSent(ch.dataset.ch);
  // Доставка: ekspres (самолёт, дороже) или morzem (контейнер, дешевле) — переключатель .seg, по умолчанию morzem (2026-10-27: экспресс выгоден только лёгким деталям, docs/research/ems_vs_container.md)
  const dl = e.target.closest("[data-dlv]");
  if (dl) {
    req.urgent = dl.dataset.dlv === "e";
    rqEms();
    return $("rqBody").querySelectorAll("[data-dlv]").forEach((b) => b.setAttribute("aria-pressed", String(b === dl)));
  }
  const g = e.target.closest("[data-go]");
  if (!g) return;
  const [v, a] = g.dataset.go.split(":");
  if (v === "how") {
    req.arena = a === "arena";
    return go(1, a === "vin" ? "vin" : "brand");
  }
  if (v === "vin") return vinNext();
  if (v === "ok") {
    if (a === "yes") return carDone();
    if (a === "vin") return go(1, "vin");
    Object.assign(req, { model: null, gen: null, other: "", carOk: false });
    return go(1, req.brand ? "model" : "brand");
  }
  if (v === "brand") {
    if (a !== req.brand) Object.assign(req, { brand: a, model: null, gen: null, other: "", carOk: false });
    return go(1, "model");
  }
  if (v === "model") {
    if (a === "other") return go(1, "other");
    if (a !== req.model) req.gen = null;
    Object.assign(req, { model: a, other: "", carOk: false });
    return carDone();
  }
  if (v === "year") {
    req.gen = a === "?" ? "?" : +a;
    req.carOk = true;
    return go(2);
  }
  if (v === "other") return otherNext();
  if (v === "parts") return a === "add" ? addDraft() : partsNext();
  if (v === "sum") {
    // «Zmień» у авто — к выбору модели (марка уже известна)
    go(a === "car" ? 1 : 2, a === "car" ? (req.brand ? "model" : carView()) : null);
    if (a === "dlv") $("rqBody").querySelector('[data-dlv][aria-pressed="true"]').focus();
    return;
  }
  // Буфер недоступен (запрет браузера) — показываем текст сообщения выделенным, чтобы скопировать вручную.
  if (v === "done") copyText(reqText()).then(() => { rq.copied = true; g.textContent = t("rq.copied"); }, () => {
    const ta = $("rqMsg") || Object.assign(document.createElement("textarea"), { id: "rqMsg", className: "rq__msg", readOnly: true, rows: 6 });
    ta.value = reqText();
    ta.setAttribute("aria-label", t("rq.copy.fail"));
    g.after(ta);
    ta.focus();
    ta.select();
  });
});
function vinNext() {
  const { vin, err } = vinCheck($("rqVin").value);
  if (err || vin.length !== 17) return rqErr(err ? t(err) : vin ? vinShort(vin) : t("rq.vin.empty"), "rqVin");
  setVin(vin);
  go(1, carView());
}
function otherNext() {
  const val = $("rqOther").value.trim();
  if (!val) return rqErr(t("rq.other.err"), "rqOther");
  Object.assign(req, { model: "other", other: val, gen: null, carOk: true });
  go(2);
}
function partsNext() {
  if ($("rqAdd").value.trim()) addDraft();
  if (!req.parts.length) return rqErr(t("rq.parts.err"), "rqAdd");
  go(3);
}
$("rqBody").addEventListener("input", (e) => {
  const id = e.target.id;
  if (id === "rqVin") {
    req.vinDraft = e.target.value;
    const { vin, err } = vinCheck(e.target.value);
    $("rqErr").textContent = vin.length > 12 && err ? t(err) : "";
    if (!$("rqErr").textContent) e.target.removeAttribute("aria-invalid");
  } else if (id === "rqAdd" || id === "rqOther") {
    if (id === "rqAdd") req.draft = e.target.value;
    $("rqErr").textContent = "";
    e.target.removeAttribute("aria-invalid");
  }
});
$("rqBody").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.target.tagName !== "INPUT" || e.target.type === "checkbox") return;
  e.preventDefault();
  if (e.target.id === "rqVin") vinNext();
  else if (e.target.id === "rqOther") otherNext();
  else if (e.target.id === "rqAdd") e.target.value.trim() ? addDraft() : partsNext();
});

/* Отправка */

// Сообщение — одно для всех входов и каналов (§4.8 документа).
function reqText() {
  const car = carFull();
  return [t("msg.hello"), `VIN: ${req.vin || t("rq.msg.novin")}`, car ? `${t("rq.msg.car")}: ${car}` : null,
    req.arena ? t("rq.msg.arena") : null, `${t("rq.msg.parts")}:`, ...req.parts.map((p) => "- " + partText(p)),
    `${t("rq.msg.dlv")}: ${t(req.urgent ? "rq.msg.express" : "rq.msg.sea")}`, `Lang: ${lang}`].filter(Boolean).join("\n");
}
// Каналы — настоящие ссылки (клавиатура, средняя кнопка, без всплывающих окон).
function rqLinks() {
  const text = reqText(), subject = `${t("rq.mail.subject")} — ${carName()}`;
  const href = { wa: `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`, tg: `https://t.me/${TELEGRAM_USER}`,
    mail: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` };
  $("rqBody").querySelectorAll("[data-ch]").forEach((a) => (a.href = href[a.dataset.ch]));
}
// Telegram не умеет подставлять текст в личный чат по ссылке — копируем сообщение в буфер и подсказываем вставить.
function copyText(text) {
  const legacy = () => {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0";
    dlg.append(ta); // внутри открытого <dialog>: остальная страница inert
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("copy");
  };
  if (!navigator.clipboard || !window.isSecureContext) return new Promise((ok) => { legacy(); ok(); });
  return navigator.clipboard.writeText(text).catch(legacy);
}
// Канал нажат — ссылка открывается сама; в окне экран «готово» (после перехода по ссылке).
function rqSent(ch) {
  const show = (ok) => setTimeout(() => {
    Object.assign(rq, { done: { ch, ok }, copied: ch === "tg" && ok, hist: [], step: "done" });
    rqRender();
    rqFocus();
  });
  if (ch !== "tg") return show(true);
  copyText(reqText()).then(() => show(true), () => show(false));
}

/* Окно */

// Телефон: высота окна = видимая часть экрана (без экранной клавиатуры), поле в фокусе — в зону видимости.
const vv = window.visualViewport;
function fitDialog() {
  if (vv && dlg.open) dlg.style.setProperty("--vvh", vv.height + "px");
}
if (vv) vv.addEventListener("resize", fitDialog);
dlg.addEventListener("focusin", (e) => {
  // сначала главная кнопка шага, потом само поле — при нехватке места поле важнее
  if (e.target.matches("input")) setTimeout(() => {
    const go = $("rqBody").querySelector(".rq__go");
    if (go) go.scrollIntoView({ block: "nearest" });
    e.target.closest(".rq__f").scrollIntoView({ block: "nearest" });
  }, 300);
});
// Закрыли — страница на месте, заявка сохраняется (после отправки детали сбросит следующее открытие, авто остаётся).
dlg.addEventListener("close", () => {
  if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  if (location.hash === "#vin") history.replaceState(null, "", location.pathname + location.search);
});
// Крестик, «Wróć na stronę» и клик по затемнению (нажали и отпустили на фоне — выделение текста окно не закрывает).
let downOnBackdrop = false;
dlg.addEventListener("pointerdown", (e) => (downOnBackdrop = e.target === dlg));
dlg.addEventListener("click", (e) => {
  if ((e.target === dlg && downOnBackdrop) || e.target.closest("[data-dlg-close]")) dlg.close();
});
// Без JS вместо окна — секция «Napisz do nas»; с JS она не нужна.
$("vin").hidden = true;

/* ---------- Карусель ---------- */


const track = $("promoTrack");
const slides = [...track.children];
$("promoDots").innerHTML = slides.map((_, i) => `<button type="button" aria-label="${i + 1}"></button>`).join("");
const dots = [...$("promoDots").children];
const slideNow = () => Math.round(track.scrollLeft / track.clientWidth);
const markDot = () => dots.forEach((d, i) => d.classList.toggle("is-on", i === slideNow()));
const goSlide = (i) => track.scrollTo({ left: i * track.clientWidth });
dots.forEach((d, i) => d.addEventListener("click", () => goSlide(i)));
track.addEventListener("scroll", () => requestAnimationFrame(markDot));
// Автопрокрутка (WCAG 2.2.2): есть кнопка паузы; стоит при наведении/фокусе и при «уменьшить движение».
let stopped = REDUCED, hover = false;
const pauseBtn = document.createElement("button");
pauseBtn.type = "button";
pauseBtn.className = "promo__pause";
$("promoDots").append(pauseBtn);
const pauseLabel = () => (pauseBtn.textContent = stopped ? "▶ " + t("promo.play") : "❚❚ " + t("promo.pause"));
pauseBtn.addEventListener("click", () => { stopped = !stopped; pauseLabel(); });
$("promo").addEventListener("mouseenter", () => (hover = true));
$("promo").addEventListener("mouseleave", () => (hover = false));
$("promo").addEventListener("focusin", () => (hover = true));
$("promo").addEventListener("focusout", () => (hover = false));
setInterval(() => { if (!stopped && !hover && !document.hidden && !$("promoSection").hidden) goSlide((slideNow() + 1) % slides.length); }, 6000);
markDot();

/* ---------- Бегущая строка маршрута ---------- */

// Остановки выбранного способа доставки: фото (Unsplash) + город + что там происходит.
// Копии ленты — aria-hidden, чтобы скринридер читал маршрут один раз.
const STOPS = { e: ["seoul", "airport", "poland", "courier"], c: ["seoul", "busan", "bremerhaven", "poland"] };
let tickerStopped = REDUCED;
function ticker() {
  const list = (hidden) => `<ul class="ticker__list"${hidden ? ' aria-hidden="true"' : ""}>` +
    STOPS[dlvMode].map((img, i) => `<li><img class="ticker__ph" src="img/route/${img}.jpg" alt="" width="132" height="88"><b>${t(`ticker.${dlvMode}.${i + 1}.c`)}</b><span>${t(`ticker.${dlvMode}.${i + 1}.p`)}</span></li>`).join("") +
    "</ul>";
  const track = $("tickerTrack");
  // Без движения — одна лента; с движением — четыре копии (хватает на широкий экран), анимация сдвигает на половину — бесшовно.
  track.innerHTML = REDUCED ? list(false) : list(false) + list(true).repeat(3);
  tickerLabel();
}
const tickerLabel = () => {
  const b = $("tickerPause");
  b.hidden = REDUCED;
  b.textContent = tickerStopped ? "▶" : "❚❚";
  b.setAttribute("aria-label", t(tickerStopped ? "promo.play" : "promo.pause"));
  b.setAttribute("aria-pressed", String(tickerStopped));
  $("tickerTrack").classList.toggle("is-paused", tickerStopped);
};
$("tickerPause").addEventListener("click", () => { tickerStopped = !tickerStopped; tickerLabel(); });

/* ---------- Модели и сравнение цен ---------- */

function brands() {
  $("brands").innerHTML = BRANDS.map((b) =>
    `<button type="button" class="brand${state.brand === b.key ? " is-on" : ""}" data-brand="${b.key}" aria-label="${b.name}" aria-pressed="${state.brand === b.key}"><img src="${b.logo}" alt="" style="height:${b.h}px"></button>`).join("");
}
$("brands").addEventListener("click", (e) => {
  const b = e.target.closest("[data-brand]");
  if (!b) return;
  const key = b.dataset.brand;
  state.brand = state.brand === key ? null : key;
  brands();
  models();
  $("models").scrollIntoView({ behavior: "smooth" });
});

// Популярные модели — раскрывающиеся карточки (по мотивам perk.com, но без тормозов):
// свёрнутая — половина машины 240×440; раскрытая — шире, машина выезжает целиком (transform),
// слева панель с выгодными деталями. Ширина меняется через flex-basis, текст панели фиксированной ширины.
let openKey = POPULAR[0].key, userTouched = false;
const modelList = () => POPULAR.filter((m) => !state.brand || m.brand === state.brand);

function modelPanel(m) {
  if (!m.vitrine) {
    return `<p class="model__lead">${t("models.ondemand.p")}</p>
      <button type="button" class="btn btn--sm" data-act="vin">${t("nav.vin")} ›</button>`;
  }
  // Три самые выгодные детали модели из витрины.
  const top = ITEMS.filter((it) => it.model === m.vitrine && it.pl)
    .sort((x, y) => save(y.ours, y.pl) - save(x.ours, x.pl)).slice(0, 3);
  return `<ul class="model__parts">${top.map((it) => `<li>
      <span>${tr(it.name)}</span>
      <b>${zl(it.ours)}</b><s>${t("cmp.pl")} ${zl(it.pl)}</s>
    </li>`).join("")}</ul>
    <button type="button" class="btn btn--sm" data-act="parts">${t("models.cta.parts")} ›</button>`;
}

function models() {
  const list = modelList();
  if (!list.some((m) => m.key === openKey)) openKey = list[0].key;
  $("models-grid").innerHTML = list.map((m) => {
    let chip = `<span class="chip chip--soft">${t("models.vin")}</span>`, meta = t("models.vin.meta");
    if (m.vitrine) {
      const priced = ITEMS.filter((it) => it.model === m.vitrine && it.pl);
      const avg = Math.round(priced.reduce((s, it) => s + save(it.ours, it.pl), 0) / priced.length);
      const count = ITEMS.filter((it) => it.model === m.vitrine).length + BUNDLES.filter((b) => b.model === m.vitrine).length;
      chip = `<span class="chip">${t("models.avg")} <b>−${avg}%</b></span>`;
      meta = `${count} ${t("models.count")}`;
    }
    // Масштаб и сдвиг фото из замера box: крыша → 10%, колёса → 78% высоты карточки, центр машины → правый край.
    // Только у модели без side: у профилей место считает placeSides().
    let pos = "";
    if (!m.side) {
      const [roof, wheels, cx] = m.box, h = 68 / (wheels - roof);
      pos = `--h:${h.toFixed(1)};--t:${(10 - roof * h).toFixed(1)};--cx:${cx}`;
    }
    const open = m.key === openKey;
    const side = m.side ? `<img class="model__side" src="img/models/side/${m.key}.jpg" alt="" loading="lazy">` : "";
    return `<article class="model reveal${open ? " is-open" : ""}${m.side ? " has-side" : ""}" data-pop="${m.key}" style="${pos}">
      ${m.side ? side : `<img class="model__front" src="img/models/${m.key}.jpg" alt="" loading="lazy">`}
      ${chip}
      <button type="button" class="model__hit" aria-expanded="${open}" aria-controls="mp-${m.key}">
        <span class="model__name">${m.name}</span><span class="model__meta">${meta}</span>
      </button>
      <div class="model__panel" id="mp-${m.key}">
        <h3>${m.name}</h3><p class="model__sub">${meta}</p>
        ${modelPanel(m)}
      </div>
    </article>`;
  }).join("");
  $("modelDots").innerHTML = list.map((m) =>
    `<button type="button" data-dot="${m.key}" aria-label="${m.name}"></button>`).join("");
  // Фон карточки = цвет студии внизу фото, чтобы растушёвка не давала шва.
  placeSides();
  $("models-grid").querySelectorAll(".model__side").forEach((img) => img.decode().then(placeSides).catch(() => {}));
  $("models-grid").querySelectorAll(".model__side, .model:not(.has-side) .model__front").forEach((img) => img.decode().then(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const x = c.getContext("2d");
    x.drawImage(img, 0, img.naturalHeight * 0.96, img.naturalWidth * 0.06, img.naturalHeight * 0.04, 0, 0, 1, 1);
    const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
    img.parentElement.style.background = `rgb(${r},${g},${b})`;
  }).catch(() => {}));
  observe($("models-grid"));
  markModels();
}

// Модели с боковым профилем (side): фото студии всегда закрывает всю карточку (без подложки и растушёвки).
// Свёрнутая: перед машины у левого края, корма за правым. Раскрытая: кадр сдвигается (--slide), машина уходит
// вправо за панель, под панелью — та же пустая студия из этого снимка. Колёса у всех на 83% высоты, машина ≈ 48–60% (сколько позволяет кадр).
function placeSides() {
  const wide = matchMedia("(min-width: 641px)").matches;
  const ow = getComputedStyle(grid).getPropertyValue("--ow").trim();
  const openW = ow.endsWith("vw") ? innerWidth * parseFloat(ow) / 100 : parseFloat(ow);
  const shutW = parseFloat(getComputedStyle(grid).getPropertyValue("--cw")) || 240;
  grid.querySelectorAll(".model.has-side").forEach((card) => {
    const m = POPULAR.find((x) => x.key === card.dataset.pop), [roof, wheels, front] = m.side;
    const img = card.querySelector(".model__side"), cardH = card.offsetHeight;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 21 / 9;
    // Колёса всегда на 83%: если кадр не закрывает карточку сверху или снизу, он крупнее (машина выше 48%).
    const imgH = Math.max(1, 0.48 / (wheels - roof), 0.83 / wheels, 0.17 / (1 - wheels)) * cardH, imgW = imgH * ratio;
    const top = cardH * 0.83 - wheels * imgH;
    const clampX = (x, boxW) => Math.min(0, Math.max(boxW - imgW, x));
    const left = clampX(18 - front * imgW, shutW);
    const openLeft = wide ? clampX(266 - front * imgW, openW) : left;
    Object.assign(img.style, { height: `${imgH}px`, width: `${imgW}px`, top: `${top}px`, left: `${left}px` });
    img.style.setProperty("--slide", `${openLeft - left}px`);
  });
}
addEventListener("resize", placeSides);

// Раскрыть модель: только классы и атрибуты, без перерисовки — чтобы шла плавная анимация.
function openModel(key, scroll = true) {
  openKey = key;
  const cards = [...grid.querySelectorAll(".model")];
  cards.forEach((c) => {
    const on = c.dataset.pop === key;
    c.classList.toggle("is-open", on);
    c.querySelector(".model__hit").setAttribute("aria-expanded", on);
  });
  markModels();
  if (scroll) {
    // Итоговая позиция: перед раскрытой карточкой только свёрнутые шириной --cw.
    const i = cards.findIndex((c) => c.dataset.pop === key);
    const cw = parseFloat(getComputedStyle(grid).getPropertyValue("--cw")) || 240;
    grid.scrollTo({ left: Math.max(0, i * (cw + 16) - cw * 0.35), behavior: REDUCED ? "auto" : "smooth" });
  }
}
const grid = $("models-grid");
const arrows = [...document.querySelectorAll(".models__nav .arrow")];
function markModels() {
  const list = modelList(), i = list.findIndex((m) => m.key === openKey);
  arrows[0].disabled = i <= 0;
  arrows[1].disabled = i >= list.length - 1;
  $("modelDots").querySelectorAll("button").forEach((d) => d.classList.toggle("is-on", d.dataset.dot === openKey));
}
function stepModel(dir) {
  const list = modelList(), i = list.findIndex((m) => m.key === openKey);
  const next = list[(i + dir + list.length) % list.length];
  openModel(next.key);
}
arrows.forEach((a) => a.addEventListener("click", () => { userTouched = true; stepModel(+a.dataset.dir); }));
$("modelDots").addEventListener("click", (e) => {
  const d = e.target.closest("[data-dot]");
  if (d) { userTouched = true; openModel(d.dataset.dot); }
});
grid.addEventListener("click", (e) => {
  const hit = e.target.closest(".model__hit");
  if (hit) { userTouched = true; return openModel(hit.closest(".model").dataset.pop); }
  const act = e.target.closest("[data-act]");
  if (!act) return;
  const m = POPULAR.find((x) => x.key === act.closest(".model").dataset.pop);
  if (act.dataset.act === "vin") {
    return reqCar(m);
  }
  Object.assign(state, { model: m.vitrine, cat: null, q: null });
  render();
  $("vitrine").scrollIntoView({ behavior: "smooth" });
});
// Автопереключение раз в 6 с, пока блок на экране; стоп при наведении/фокусе и навсегда после первого клика.
let modelsHover = false, modelsSeen = false;
$("models").addEventListener("mouseenter", () => (modelsHover = true));
$("models").addEventListener("mouseleave", () => (modelsHover = false));
$("models").addEventListener("focusin", () => (modelsHover = true));
$("models").addEventListener("focusout", () => (modelsHover = false));
new IntersectionObserver((en) => (modelsSeen = en[0].isIntersecting), { threshold: 0.4 }).observe(grid);
setInterval(() => {
  if (!REDUCED && !userTouched && !modelsHover && modelsSeen && !document.hidden) stepModel(1);
}, 6000);

// Сравнение цен: переключатель модели, до 3 самых выгодных деталей с ценой в PL и итог экономии.
// Крупная цифра слева — максимум по деталям витрины (комплекты не считаем: везде на сайте «do −59%»).
// В карточке всегда 3 строки: недостающие — невидимые копии, чтобы итог не прыгал при смене модели.
const CMP_ROWS = 3;
let cmpModel = "carnival";
function compare() {
  const box = $("cmp");
  const priced = ITEMS.filter((it) => it.pl);
  const best = Math.max(...priced.map((it) => save(it.ours, it.pl)));
  $("cmpMax").textContent = t("cmp.max").replace("{n}", best);
  $("cmpSwitch").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cmp === cmpModel)));
  const picks = priced.filter((it) => it.model === cmpModel)
    .sort((a, b) => save(b.ours, b.pl) - save(a.ours, a.pl)).slice(0, CMP_ROWS);
  const top = Math.max(...picks.map((it) => it.pl));
  const total = picks.reduce((s, it) => s + it.pl - it.ours, 0);
  const row = (it, ghost) => `<div class="cmp__row"${ghost ? ' aria-hidden="true" style="visibility:hidden"' : ""}>
      <div class="cmp__what">${tr(it.name)} <span class="badge">−${save(it.ours, it.pl)}%</span></div>
      <div class="bar"><span>${t("cmp.pl")}</span><div class="bar__track"><div class="bar__fill" data-w="${(it.pl / top) * 100}"></div></div><span class="bar__val" data-n="${it.pl}" aria-label="${zl(it.pl)}">0 zł</span></div>
      <div class="bar bar--ours"><span>${t("cmp.ours")}</span><div class="bar__track"><div class="bar__fill" data-w="${(it.ours / top) * 100}"></div></div><span class="bar__val" data-n="${it.ours}" aria-label="${zl(it.ours)}">0 zł</span></div>
    </div>`;
  const ghosts = Array.from({ length: CMP_ROWS - picks.length }, () => row(picks[0], true));
  box.innerHTML = `<div class="cmp__rows">${picks.map((it) => row(it)).join("")}${ghosts.join("")}</div>
    <div class="cmp__total"><span>${t("cmp.total")}</span><b data-n="${total}" aria-label="${zl(total)}">0 zł</b></div>
    <p class="stamp">${stamp()}</p>`;
  if (box.classList.contains("is-in")) { void box.offsetWidth; playBars(box); }
}
$("cmpSwitch").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-cmp]");
  if (!btn || btn.dataset.cmp === cmpModel) return;
  cmpModel = btn.dataset.cmp;
  compare();
});

function playBars(box) {
  box.querySelectorAll(".bar__fill").forEach((f) => (f.style.width = f.dataset.w + "%"));
  box.querySelectorAll("[data-n]").forEach((el) => (REDUCED ? (el.textContent = zl(+el.dataset.n)) : countUp(el, +el.dataset.n)));
}

function countUp(el, to) {
  const t0 = performance.now(), dur = 1200;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = zl(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- Витрина ---------- */

// Вариант A (2026-10-26): чистая сетка деталей. Наборы — отдельной секцией #kits выше (kits()),
// фильтры витрины на них не влияют. Над сеткой одна строка: селекторы «Model» и «Kategoria» + поиск по OE
// (номер из поиска в hero сбрасывает модель и категорию и попадает в это поле).
// В карточке детали главное — цена «od ~X zł»; экономия одна — чипом на фото; одно действие — «Zapytaj ›»
// (кнопка растянута на всю карточку, переносит деталь в заявку).
const SHORT = { carnival: "Carnival", k8: "K8", genesis: "Genesis" };
const byModel = (x) => state.model === "all" || x.model === state.model;

function highlight(oe) {
  if (!state.q) return oe;
  // Подсвечиваем совпадение, не учитывая дефисы в номере.
  let out = "", seen = 0;
  const hit = norm(oe).indexOf(state.q);
  for (const ch of oe) {
    const alnum = /[A-Z0-9]/i.test(ch);
    const inHit = alnum && seen >= hit && seen < hit + state.q.length;
    out += inHit ? `<mark>${ch}</mark>` : ch;
    if (alnum) seen++;
  }
  return out.replace(/<\/mark><mark>/g, "");
}

function card(it) {
  const chip = it.pl ? `<span class="chip"><b>−${save(it.ours, it.pl)}%</b></span>` : "";
  const sub = it.pl
    ? `<s class="price__pl">${t("price.pl")}${zl(it.pl)}</s>`
    : `<span class="badge badge--rare">${t("badge.rare")}</span>`;
  return `<article class="card">
    <div class="card__img"><img src="img/parts/${it.img}.jpg" alt="" loading="lazy">${chip}</div>
    <div class="card__body">
      <p class="card__model">${state.model === "all" ? SHORT[it.model] + " · " : ""}${tr(CATEGORIES[it.cat])}</p>
      <h4>${tr(it.name)}</h4>
      <div class="price"><span class="price__ours">${t("price.from")}${zl(it.ours)}</span>${sub}</div>
    </div>
    <div class="card__foot">
      <span class="card__oe">OE ${highlight(it.oe)}</span>
      <button type="button" class="card__ask" data-ask-item="${ITEMS.indexOf(it)}" aria-label="${t("btn.ask")}: ${tr(it.name)}">${t("btn.ask")} <span aria-hidden="true">›</span></button>
    </div>
  </article>`;
}

// Набор: мозаика фото (первое — крупное), состав с количеством, цена и кнопка заказа.
function bundle(b) {
  const car = b.car || MODELS[b.model];
  return `<article class="kit">
    <div class="kit__ph kit__ph--${Math.min(b.photos.length, 3)}">
      ${b.photos.slice(0, 3).map(([img, tag]) => `<div><img src="img/parts/${img}.jpg" alt="" loading="lazy">${tag ? `<i>${tag}</i>` : ""}</div>`).join("")}
      <span class="chip">${t("price.save")} <b>${zl(b.pl - b.ours)}</b></span>
    </div>
    <div class="kit__body">
      <p class="card__model">${t("vit.kit")} · ${car}</p>
      <h3>${tr(b.name)}</h3>
      <ul class="kit__list">${b.items.map(([n, q]) => `<li><span>${tr(n)}</span><span>${tr(q)}</span></li>`).join("")}</ul>
      <div class="kit__buy">
        <div class="price"><span class="price__ours">${t("price.from")}${zl(b.ours)}</span>
          <s class="price__pl">${t("price.pl")}${zl(b.pl)}</s><span class="badge">−${save(b.ours, b.pl)}%</span></div>
        <button type="button" class="btn" data-ask-kit="${BUNDLES.indexOf(b)}">${t("btn.bundle")}</button>
      </div>
    </div>
  </article>`;
}

function render() {
  const items = ITEMS.filter((it) => byModel(it) && (!state.cat || it.cat === state.cat) && (!state.q || norm(it.oe).includes(state.q)))
    .sort((a, b) => (b.pl ? save(b.ours, b.pl) : 0) - (a.pl ? save(a.ours, a.pl) : 0));
  $("items").innerHTML = items.map(card).join("");
  $("empty").hidden = items.length > 0;
  filters();
}

// Наборы — все из BUNDLES, всегда; один — карточка во всю ширину, больше трёх — ряд листается стрелками.
function kits() {
  const box = $("bundles");
  box.innerHTML = BUNDLES.map(bundle).join("");
  box.classList.toggle("is-one", BUNDLES.length === 1);
  box.scrollLeft = 0;
  kitsNav();
}

function filters() {
  pickModel();
  pickCat();
  const oe = $("vitOe");
  if (document.activeElement !== oe) oe.value = state.q ?? "";
}

// Выпадающий селектор на светлом — базовый элемент (как выбор языка в шапке, но белый):
// кнопка «Подпись: значение ⌄» + listbox; стрелки, Enter/Space, Esc, Tab, клик мимо закрывает.
// opts() → [[значение, текст]], val() → текущее значение, onPick(значение). Возвращает функцию обновления.
// ph() — необязательная подсказка на кнопке, пока значение не выбрано (её нет в списке пунктов).
// Пункт [null, текст] — заголовок группы (не выбирается, стрелки его пропускают); третий элемент — текст на кнопке,
// если он отличается от пункта списка («2023» в списке → «2023 · KA4» на кнопке). update.open() — открыть список.
const TICK = `<svg class="pick__tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function picker(id, label, opts, val, onPick, ph) {
  const root = $(id);
  root.innerHTML = `<button type="button" class="pick__btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}List">
      <span class="pick__k"></span><span class="pick__v"></span>
      <svg class="pick__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <ul class="pick__list" id="${id}List" role="listbox" tabindex="-1" hidden></ul>`;
  const btn = root.querySelector(".pick__btn"), list = root.querySelector(".pick__list");
  let items = [], active = 0;
  const update = () => {
    items = opts();
    const v = val(), cur = items.find(([k]) => k !== null && k === v) || (ph ? [null, ph()] : items.find(([k]) => k !== null));
    const shown = cur[2] || cur[1];
    btn.querySelector(".pick__k").textContent = label();
    btn.querySelector(".pick__v").textContent = shown;
    btn.setAttribute("aria-label", `${label()}: ${shown}`);
    list.setAttribute("aria-label", label());
    list.innerHTML = items.map(([k, txt], i) => k === null
      ? `<li role="presentation" class="pick__group">${txt}</li>`
      : `<li role="option" id="${id}-${i}" aria-selected="${k === cur[0]}">${txt}${TICK}</li>`).join("");
  };
  const mark = (i, dir = 1) => {
    const lis = [...list.children];
    active = (i + lis.length) % lis.length;
    while (items[active][0] === null) active = (active + dir + lis.length) % lis.length; // заголовок группы — дальше
    lis.forEach((li, k) => li.classList.toggle("is-active", k === active));
    list.setAttribute("aria-activedescendant", lis[active].id);
    lis[active].scrollIntoView({ block: "nearest" }); // длинный список прокручивается внутри
  };
  const open = () => {
    update();
    list.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    mark(Math.max(0, items.findIndex(([k]) => k !== null && k === val())));
    list.focus();
  };
  const close = (focusBtn = true) => {
    list.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (focusBtn) btn.focus();
  };
  const pick = (i) => { close(); onPick(items[i][0]); };
  btn.addEventListener("click", () => (list.hidden ? open() : close()));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); }
  });
  list.addEventListener("click", (e) => {
    const li = e.target.closest("li[role=option]");
    if (li) pick([...list.children].indexOf(li));
  });
  list.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); mark(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); mark(active - 1, -1); }
    else if (e.key === "Home") { e.preventDefault(); mark(0); }
    else if (e.key === "End") { e.preventDefault(); mark(-1, -1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
  });
  document.addEventListener("click", (e) => { if (!list.hidden && !root.contains(e.target)) close(false); });
  update.open = open;
  return update;
}

// Модель — все модели витрины; категория — только те, что есть у выбранной модели.
const pickModel = picker("pickModel", () => t("vit.model"),
  () => [["all", t("filter.all")], ...Object.keys(MODELS).map((k) => [k, SHORT[k]])],
  () => state.model,
  (m) => { Object.assign(state, { model: m, cat: null }); render(); });
const pickCat = picker("pickCat", () => t("vit.cat"),
  () => {
    const have = new Set(ITEMS.filter(byModel).map((it) => it.cat));
    return [["", t("filter.cats")], ...Object.keys(CATEGORIES).filter((c) => have.has(c)).map((c) => [c, tr(CATEGORIES[c])])];
  },
  () => state.cat ?? "",
  (c) => { state.cat = c || null; render(); });

// Поиск по номеру OE — сразу при вводе, внутри выбранных модели и категории.
$("vitOe").addEventListener("input", (e) => {
  state.q = norm(e.target.value) || null;
  render();
});

// Ряд наборов листается, когда не помещается; стрелки — только тогда.
function kitsNav() {
  const k = $("bundles"), nav = $("kitsNav");
  const over = k.scrollWidth > k.clientWidth + 2;
  nav.hidden = !over;
  if (!over) return;
  const [prev, next] = nav.querySelectorAll(".arrow");
  prev.disabled = k.scrollLeft <= 2;
  next.disabled = k.scrollLeft + k.clientWidth >= k.scrollWidth - 2;
}
$("kitsNav").addEventListener("click", (e) => {
  const a = e.target.closest("[data-kit]");
  if (!a) return;
  const k = $("bundles"), first = k.firstElementChild;
  const step = first ? first.offsetWidth + parseFloat(getComputedStyle(k).columnGap) : k.clientWidth;
  k.scrollBy({ left: step * a.dataset.kit, behavior: REDUCED ? "auto" : "smooth" });
});
$("bundles").addEventListener("scroll", kitsNav, { passive: true });
addEventListener("resize", kitsNav);

/* ---------- Доставка: переключатель Ekspres / Morzem ---------- */

// Акцент — «od 2 tygodni»: ekspres первый и по умолчанию. Срок — в переключателе и заголовке, поэтому
// наклейка «Czas» не нужна: коллаж из трёх светлых наклеек — Koszt, Dla jakich części и одна по режиму.
// Остальное (номер для отслеживания, 3+ контейнера) — в абзаце; вопросы-ответы — обычным текстом слева.
const STICKERS = [["cost", "credit-card"], ["for", "package-check"]];
const EXTRAS = { e: ["x2", "camera"], c: ["x2", "receipt-text"] };
let dlvMode = "e";
function delivery() {
  const m = dlvMode;
  $("delSwitch").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  $("dlvH").textContent = t(`dlv.${m}.h2`);
  $("dlvLead").textContent = t(`dlv.${m}.lead`);
  const main = STICKERS.map(([k, ic]) =>
    `<li class="sticker sticker--light"><span class="ix" data-ix="${ic}"></span><span><small>${t(`st.${k}`)}</small><b>${t(`st.${m}.${k}`)}</b><span>${t(`st.${m}.${k}.s`)}</span></span></li>`);
  const [k, ic] = EXTRAS[m];
  const extra = `<li class="sticker sticker--light"><span class="ix" data-ix="${ic}"></span><span><b>${t(`st.${m}.${k}`)}</b><span>${t(`st.${m}.${k}.s`)}</span></span></li>`;
  $("dlvFacts").innerHTML = [...main, extra].join("");
  ixFill($("dlvFacts"));
  $("dlvMore").innerHTML = `<div><h3>${t("dlv.q1")}</h3><p>${t(`dlv.${m}.q1`)}</p></div>
    <div><h3>${t(`dlv.${m}.q2h`)}</h3><p>${t(`dlv.${m}.q2`)}</p></div>`;
  ticker();
}
$("delSwitch").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-mode]");
  if (!btn || btn.dataset.mode === dlvMode) return;
  dlvMode = btn.dataset.mode;
  delivery();
});

/* ---------- Jak to działa: шаги слева, сцена шага справа ---------- */

// Вариант C «Przewodnik». У шага метка Ty / My — видно, что от клиента три коротких действия.
// Автопоказ: 6 с на шаг, пока блок на экране, один круг и стоп; пауза при наведении/фокусе и кнопкой,
// клик по шагу выключает автопоказ; при reduced motion автопоказа нет. ≤960 px сцена переезжает под активный шаг.
const HOW = [["search", "you"], ["file-text", "us"], ["credit-card", "you"], ["camera", "us"], ["package-check", "you"]];
const HOW_OE = ["58101-R0A00", "51712-R0150"];
const howMq = matchMedia("(max-width: 960px)");
const howStage = $("howStage");
let howI = 0, howAuto = !REDUCED, howHover = false, howSeen = false;

function howScene(i) {
  const parts = HOW_OE.map((oe) => ITEMS.find((x) => x.oe === oe));
  const row = (a, b) => `<div class="how__card how__row">${a}${b}</div>`;
  const oes = `<span class="how__mono">${HOW_OE.join(" · ")}</span>`;
  switch (i) {
    case 0: return `<div class="how__card how__vin"><span class="how__mono">KNA**********1234</span><span class="btn btn--sm" aria-hidden="true">${t("nav.vin")}</span></div>
      <div class="how__card"><small>${t("how.s1.need")}</small>${t("how.s1.list")}</div>
      <div class="how__chips"><span class="chip chip--soft">${t("how.s1.form")}</span><span class="chip chip--soft">WhatsApp</span><span class="chip chip--soft">Telegram</span></div>`;
    case 1: return parts.map((p) => row(`<span><span class="how__mono">${p.oe}</span><small>${tr(p.name)}</small></span>`, `<b>~${zl(p.ours)}</b>`)).join("")
      + row(`<span>${t("how.s2.total")}</span>`, `<span class="badge">${t("how.s2.badge")}</span>`);
    case 2: return `<div class="how__card"><small>${t("how.s3.ok")}</small>${oes}</div>`
      + row(`<span>${t("how.s3.pay")}</span>`, `<b class="how__sum">~${zl(parts.reduce((s, p) => s + p.ours, 0))}</b>`)
      + `<p class="how__note">${t("how.s3.note")}</p>`;
    case 3: return `<figure class="how__card how__ph"><img src="img/parts/disc.jpg" alt="${t("how.s4.alt")}" loading="lazy"><span class="chip">${t("how.s4.chip")}</span></figure>`
      + row(`<span>${t("how.s4.ok")}</span>`, "");
    default: return row(`<span><b>${t("del.e.tab")}</b> · ${t("del.e.when")}</span>`, `<small>${t("how.s5.track")}</small>`)
      + row(`<span><b>${t("del.c.tab")}</b> · ${t("how.s5.sea")}</span>`, `<small>${t("how.s5.box")}</small>`)
      + row(`<span><b>${t("how.s5.inv")}</b></span>`, `<small>${t("how.s5.pick")}</small>`);
  }
}

function how() {
  $("how-grid").append(howStage); // перед перерисовкой списка забираем сцену из шага (телефон)
  $("howSteps").innerHTML = HOW.map(([, who], i) =>
    `<li><button type="button" class="how__btn" aria-controls="howStage">
      <span class="how__n" aria-hidden="true">${i + 1}</span>${t(`how.${i + 1}.h`)}
      <span class="${who === "us" ? "badge" : "how__tag"}">${t(`how.${who}`)}</span></button>
      <div class="how__body"><p>${t(`how.${i + 1}.p`)}</p></div></li>`).join("");
  howShow(howI);
  howLabel();
}
function howShow(i) {
  howI = i;
  const lis = [...$("howSteps").querySelectorAll("li")];
  lis.forEach((li, k) => {
    li.classList.toggle("is-on", k === i);
    li.classList.toggle("is-done", k < i);
    li.querySelector("button").setAttribute("aria-expanded", String(k === i));
  });
  howStage.innerHTML = `<div class="how__meta"><span class="ix ix--step" data-ix="${HOW[i][0]}"></span>${t("how.of").replace("{n}", i + 1)}</div>
    <div class="how__scene">${howScene(i)}</div>`;
  ixFill(howStage);
  (howMq.matches ? lis[i] : $("how-grid")).append(howStage);
  howFill();
}
// Линия — от первого номера до последнего, зелёная — до активного (пересчёт и после раскрытия шага).
function howFill() {
  const ns = [...$("howSteps").querySelectorAll(".how__n")];
  if (!ns.length) return;
  const top = (n) => n.getBoundingClientRect().top - ns[0].getBoundingClientRect().top + "px";
  $("howSteps").style.setProperty("--how-fill", top(ns[howI]));
  $("howSteps").style.setProperty("--how-line", top(ns[ns.length - 1]));
}
function howLabel() {
  const b = $("howPause");
  b.hidden = REDUCED;
  b.textContent = howAuto ? "❚❚ " + t("promo.pause") : "▶ " + t("promo.play");
  b.setAttribute("aria-pressed", String(!howAuto));
}
$("howSteps").addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li || !e.target.closest(".how__btn")) return;
  howAuto = false;
  howLabel();
  howShow([...$("howSteps").querySelectorAll("li")].indexOf(li));
});
$("howSteps").addEventListener("transitionend", (e) => e.propertyName === "grid-template-rows" && howFill());
$("howPause").addEventListener("click", () => {
  howAuto = !howAuto;
  if (howAuto && howI === HOW.length - 1) howShow(0);
  howLabel();
});
const howGrid = $("how-grid");
howGrid.addEventListener("mouseenter", () => (howHover = true));
howGrid.addEventListener("mouseleave", () => (howHover = false));
howGrid.addEventListener("focusin", () => (howHover = true));
howGrid.addEventListener("focusout", () => (howHover = false));
new IntersectionObserver((en) => (howSeen = en[0].isIntersecting), { threshold: 0.4 }).observe(howGrid);
howMq.addEventListener("change", () => howShow(howI));
addEventListener("resize", howFill);
setInterval(() => {
  if (!howAuto || howHover || !howSeen || document.hidden) return;
  howShow(howI + 1);
  if (howI === HOW.length - 1) { howAuto = false; howLabel(); }
}, 6000);

/* ---------- Появление при прокрутке ---------- */

const io = new IntersectionObserver((entries) => entries.forEach((en) => {
  if (!en.isIntersecting) return;
  en.target.classList.add("is-in");
  if (en.target.id === "cmp") playBars(en.target);
  io.unobserve(en.target);
}), { threshold: 0.15 });
function observe(root) { root.querySelectorAll(".reveal:not(.is-in)").forEach((el) => io.observe(el)); }

/* ---------- Язык ---------- */

// Свой выпадающий список: кнопка «PL ▾» и меню. Клавиатура: стрелки, Enter/Space, Esc, Tab; клик мимо — закрыть.
const langBtn = $("langBtn"), langList = $("langList");
function langOptions() {
  langList.innerHTML = LANGS.map(([code, label]) =>
    `<li role="option" id="lang-${code}" data-lang="${code}" aria-selected="${code === lang}">
      <span class="lang__code">${code.toUpperCase()}</span>${label}
      <svg class="lang__tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </li>`).join("");
}
let langActive = 0;
function langMark(i) {
  const items = [...langList.children];
  langActive = (i + items.length) % items.length;
  items.forEach((li, k) => li.classList.toggle("is-active", k === langActive));
  langList.setAttribute("aria-activedescendant", items[langActive].id);
}
function langOpen() {
  langList.hidden = false;
  langBtn.setAttribute("aria-expanded", "true");
  langMark(LANGS.findIndex(([c]) => c === lang));
  langList.focus();
}
function langClose(focusBtn = true) {
  langList.hidden = true;
  langBtn.setAttribute("aria-expanded", "false");
  if (focusBtn) langBtn.focus();
}
function setLang(code) {
  if (code === lang) return;
  lang = code;
  try { localStorage.setItem("lang", lang); } catch (err) { /* без запоминания */ }
  applyLang();
}
function langPick(code) {
  setLang(code);
  langClose();
}
// В подвале — тот же выбор языка, но открытым рядом кнопок «PL · EN».
function footLang() {
  $("footLang").innerHTML = LANGS.map(([code, label]) =>
    `<button type="button" data-lang="${code}" lang="${code}" aria-label="${label}" aria-pressed="${code === lang}">${code.toUpperCase()}</button>`).join("");
}
$("footLang").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lang]");
  if (!b) return;
  setLang(b.dataset.lang);
  $("footLang").querySelector(`[data-lang="${lang}"]`).focus();
});
langBtn.addEventListener("click", () => (langList.hidden ? langOpen() : langClose()));
langBtn.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); langOpen(); }
});
langList.addEventListener("click", (e) => {
  const li = e.target.closest("[data-lang]");
  if (li) langPick(li.dataset.lang);
});
langList.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); langMark(langActive + 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); langMark(langActive - 1); }
  else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); langPick(LANGS[langActive][0]); }
  else if (e.key === "Escape") { e.preventDefault(); langClose(); }
  else if (e.key === "Tab") langClose(false);
});
document.addEventListener("click", (e) => {
  if (!langList.hidden && !$("lang").contains(e.target)) langClose(false);
});

ixFill();
applyLang();
observe(document);
// Прямая ссылка на сайт с #vin — сразу открыть заявку.
if (location.hash === "#vin") reqOpen();
