// Пилот: куда уходят заявки. Заменить на реальные перед запуском.
const CONTACT_EMAIL = "zamowienia@example.pl";
const WHATSAPP_PHONE = "48000000000";   // номер в международном формате без «+»
const TELEGRAM_USER = "czesci_z_korei"; // имя пользователя без «@»


// Системная настройка «уменьшить движение» — анимации и автосмену не запускаем.
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const zl = (n) => Math.round(n).toLocaleString("pl-PL") + " zł";
const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const state = { model: "all", cat: null, q: null, tab: "vin", brand: null };
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
  $("formMsg").textContent = "";
  $("searchMsg").textContent = "";
  setTab(state.tab);
  vinRes();
  pickForm();
  messengerLinks();
  pauseLabel();
  delivery();
  brands();
  models();
  compare();
  kits();
  render();
  how();
}

// Ссылки на мессенджеры — и в кнопках, и внутри переведённых текстов.
function messengerLinks() {
  const href = {
    wa: `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(t("wa.text"))}`,
    tg: `https://t.me/${TELEGRAM_USER}`,
  };
  document.querySelectorAll("[data-msg]").forEach((a) => (a.href = href[a.dataset.msg]));
}

/* ---------- Первый экран: меняющаяся модель и поиск с вкладками ---------- */

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

function setTab(tab) {
  const changed = tab !== state.tab;
  state.tab = tab;
  document.querySelectorAll(".search__tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === tab));
  $("searchForm").hidden = tab === "arena";
  $("searchArena").hidden = tab !== "arena";
  $("searchInput").placeholder = t(tab === "oe" ? "search.oe.ph" : "search.vin.ph");
  $("searchInput").classList.toggle("is-vin", tab === "vin");
  $("searchNoVin").hidden = tab !== "vin";
  searchErr("");
  if (changed) vinClose();
}
document.querySelector(".search__tabs").addEventListener("click", (e) => {
  if (e.target.dataset.tab) setTab(e.target.dataset.tab);
});

// Поиск: VIN — карточка результата под полем в поднятом окне поиска (vinRes), без формы; OE — витрина или запрос в мессенджер.
$("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const raw = $("searchInput").value.trim();
  if (state.tab === "vin") {
    const { vin, err } = vinCheck(raw);
    if (err || vin.length !== 17) return searchErr(t(err || "search.vin.bad"));
    return vinOpen({ kind: "vin", code: vin }, true);
  }
  const q = norm(raw);
  if (!q) return;
  if (ITEMS.some((it) => norm(it.oe).includes(q))) {
    dropSearch(false);
    Object.assign(state, { model: "all", cat: null, q });
    $("vitOe").value = raw;
    render();
    return $("vitrine").scrollIntoView({ behavior: "smooth" });
  }
  // Номера нет в примерах — та же карточка: «wyślij numer» в выбранный мессенджер, без формы.
  vinOpen({ kind: "oe", code: raw.toUpperCase() }, true);
});

// VIN проверяем сразу при вводе: 17 знаков, без I/O/Q; панель с результатом — по Enter / кнопке поиска.
function vinCheck(raw) {
  const vin = norm(raw);
  return { vin, err: /[IOQ]/.test(vin) ? "search.vin.ioq" : vin.length > 17 ? "search.vin.long" : null };
}
function searchErr(text, isErr = true) {
  const msg = $("searchMsg"), input = $("searchInput");
  msg.textContent = text;
  msg.classList.toggle("is-ok", !isErr);
  if (text && isErr) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  liftSize(); // подсказка в открытом окне меняет его высоту
}
// Окно уже поднято — панель следует за полем; в hero при вводе только подсказки об ошибке, без подъёма.
$("searchInput").addEventListener("input", (e) => {
  if (state.tab !== "vin") return lifted && vinClose();
  const { vin, err } = vinCheck(e.target.value);
  searchErr(err ? t(err) : "");
  if (!lifted) return;
  if (!err && vin.length === 17) { if (!vr.open || vr.code !== vin) vinOpen({ kind: "vin", code: vin }, false); }
  else if (vr.kind !== "model") vinClose(); // панель «без VIN» не зависит от поля
});
// Второй вход — без VIN: та же панель и то же раскрытие, сразу выбор модели (как у нераспознанного VIN).
$("searchNoVin").addEventListener("click", () => vinOpen({ kind: "model", code: "" }, true));

/* ---------- Результат VIN: модель → детали → канал → отправка ---------- */

// Модель угадываем по таблице VIN_BRANDS / VIN_MODELS (data.js) и всегда переспрашиваем; не нашли — выбор из POPULAR.
// kind: "vin" — по VIN из поля, "oe" — номер не из витрины, "model" — без VIN (человек выбирает модель сам;
// VIN можно дописать внизу панели — vinOpt(), иначе в сообщении «Model: … (bez VIN)»).
const vr = { open: false, kind: "vin", code: "", brand: null, model: null, asked: true, picked: new Set(), ch: "wa", note: false, vinErr: null };
const popular = (k) => POPULAR.find((m) => m.key === k);
const carName = (k) => (k === "other" ? t("vr.other") : popular(k).full || popular(k).name);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function vinDecode(vin) {
  const hit = VIN_MODELS.find((x) => vin.startsWith(x.prefix));
  return { brand: VIN_BRANDS[vin.slice(0, 3)] || null, model: hit ? hit.model : null };
}
// Детали модели из витрины: 3 самых выгодных (без цены в PL — в конце).
function vinItems() {
  const m = vr.model && vr.model !== "other" && popular(vr.model);
  if (!m || !m.vitrine) return [];
  const pct = (it) => (it.pl ? save(it.ours, it.pl) : -1);
  return ITEMS.filter((it) => it.model === m.vitrine).sort((a, b) => pct(b) - pct(a)).slice(0, 3);
}

function vinOpen({ kind, code }, focus) {
  liftSearch(); // панель живёт только в окне поиска
  // Тот же VIN/OE снова (панель закрыли и открыли) — выбор модели, галочки и «что ещё» сохраняем.
  if (kind !== vr.kind || code !== vr.code) {
    const d = kind === "vin" ? vinDecode(code) : { brand: null, model: null };
    Object.assign(vr, { kind, code, brand: d.brand, model: d.model, asked: !d.model, picked: new Set(), note: kind === "oe", vinErr: null });
    $("vrNote").value = $("vrVin").value = "";
  }
  vr.open = true;
  $("vrMsg").textContent = "";
  vinRes();
  if (!focus) return;
  searchErr("");
  const first = $("vinRes").querySelector("#vrHead button, #pickVin:not([hidden]) .pick__btn, #vrNote");
  first.focus({ preventScroll: true });
  $("vrHead").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "nearest" });
}
function vinClose(focusInput = false) {
  if (!vr.open) return;
  vr.open = false;
  vinRes();
  if (focusInput) $("searchInput").focus({ preventScroll: true });
}
/* ---------- Окно поиска: адаптивное раскрытие ---------- */

// Окно открывается, только когда есть что показать: по Enter / кнопке поиска с готовым результатом VIN или OE
// (ошибка ввода — подсказка под полем на месте). Карточка вырастает ровно на высоту панели результата: опора — её место
// в hero; сначала растём вверх (вкладки и поле стоят где стояли), не хватает места до шапки — недостающее вниз,
// не хватает и вниз — высота экрана и прокрутка внутри панели. Маленький результат — карточка почти не двигается.
// Смена содержимого в открытом окне (выбрали модель → появились детали) — плавный пересчёт тем же способом.
// Движение — переходы CSS по --lift-* (.56 с); затемнение нарастает вместе с раскрытием, всё вокруг inert,
// страница не прокручивается. Esc, крестик или клик по затемнению — обратно к исходному месту и размеру;
// значение и выбор сохраняются. Телефон (≤640): с экранной клавиатурой места над полем нет — окно во весь экран сверху.
const search = $("search"), searchPh = $("searchPh");
const LIFT_MS = 560;
const phone = matchMedia("(max-width: 640px)");
let lifted = false, liftInert = [], dropDone = null;
// Положение и размер окна — переменные --lift-*: top, left, w, h, r (радиус).
function liftSet(g) {
  Object.entries(g).forEach(([k, v]) => search.style.setProperty(`--lift-${k}`, v + "px"));
}
const liftRect = (r) => ({ top: r.top, left: r.left, w: r.width, h: r.height, r: 24 });
// Высота содержимого без ограничений: поля карточки + все видимые блоки в потоке, у панели — вся её прокручиваемая высота.
function liftNatural() {
  const cs = getComputedStyle(search);
  let h = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  for (const el of search.children) {
    const st = getComputedStyle(el);
    if (st.display === "none" || st.position === "absolute") continue;
    const box = el.id === "vinRes" ? el.scrollHeight + el.offsetHeight - el.clientHeight : el.offsetHeight;
    h += box + parseFloat(st.marginTop) + parseFloat(st.marginBottom);
  }
  return Math.ceil(h);
}
// Пересчёт размеров открытого окна (после подъёма, при смене содержимого, при изменении экрана).
function liftSize() {
  if (!lifted) return;
  if (phone.matches) {
    const vh = window.visualViewport ? visualViewport.height : innerHeight;
    return liftSet({ top: 0, left: 0, w: innerWidth, h: vh, r: 0 });
  }
  const ph = searchPh.getBoundingClientRect();
  const topLim = document.querySelector(".top").offsetHeight + 16, botLim = innerHeight - 16;
  const h = Math.min(liftNatural(), botLim - topLim);
  const bottom = Math.min(Math.max(ph.bottom, topLim + h), botLim); // вверх от опоры; не хватает — вниз
  liftSet({ top: bottom - h, left: ph.left, w: ph.width, h, r: 24 });
}
addEventListener("resize", liftSize);
if (window.visualViewport) visualViewport.addEventListener("resize", liftSize);

// Открыть окно на месте карточки; настоящий размер ставит liftSize() после того, как панель отрисована.
function liftSearch() {
  if (lifted) return;
  if (dropDone) dropDone();
  const from = search.getBoundingClientRect();
  searchPh.style.height = from.height + "px";
  searchPh.hidden = false;
  lifted = true;
  liftSet(liftRect(from));
  document.documentElement.classList.add("is-lifted", "is-dim");
  search.classList.add("is-lifted");
  void search.offsetHeight; // зафиксировать стартовое положение — дальше переходы CSS
  Object.entries({ role: "dialog", "aria-modal": "true", "aria-label": t("search.dlg") }).forEach(([k, v]) => search.setAttribute(k, v));
  liftInert = [];
  for (let el = search; el.parentElement && el !== document.body; el = el.parentElement) {
    for (const sib of el.parentElement.children) {
      if (sib === el || sib.id === "searchDim" || sib.inert || sib.tagName === "SCRIPT") continue;
      sib.inert = true;
      liftInert.push(sib);
    }
  }
}
function dropSearch(focusInput = true) {
  if (!lifted) return;
  lifted = false;
  liftInert.forEach((el) => (el.inert = false));
  document.documentElement.classList.remove("is-dim"); // затемнение гаснет вместе со схлопыванием
  $("vinRes").scrollTop = 0;
  liftSet(liftRect(searchPh.getBoundingClientRect())); // обратно к исходному месту и размеру
  dropDone = () => {
    dropDone = null;
    document.documentElement.classList.remove("is-lifted");
    search.classList.remove("is-lifted");
    ["role", "aria-modal", "aria-label"].forEach((k) => search.removeAttribute(k));
    searchPh.hidden = true;
    vinClose();
  };
  // по таймеру, а не transitionend: в фоновой вкладке кадры не рисуются; без движения — сразу
  if (REDUCED) dropDone();
  else setTimeout(() => dropDone && dropDone(), LIFT_MS);
  if (focusInput) $("searchInput").focus({ preventScroll: true });
}
$("searchX").addEventListener("click", () => dropSearch());
$("searchDim").addEventListener("click", () => dropSearch());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && lifted && !e.defaultPrevented && $("pickVinList").hidden && !dlg.open) dropSearch();
});

function vinRes() {
  $("vinRes").hidden = !vr.open;
  if (!vr.open) return liftSize();
  const mask = vr.kind === "vin" ? `<span class="vinres__vin">VIN …${vr.code.slice(-6)}</span>` : "";
  const brand = BRANDS.find((b) => b.key === vr.brand);
  let head;
  if (vr.kind === "oe") head = `<p class="vinres__q">${t("vr.oe").replace("{oe}", `<b>${esc(vr.code)}</b>`)}</p>`;
  else if (vr.model && !vr.asked) head = `<p class="vinres__q">${t("vr.guess").replace("{m}", `<b>${carName(vr.model)}</b>`)}${mask}</p>
      <div class="vinres__yn"><button type="button" class="btn btn--sm" data-vr="yes">${t("vr.yes")}</button>
      <button type="button" class="vinres__link" data-vr="no">${t("vr.no")}</button></div>`;
  else if (vr.model) head = `<p class="vinres__q"><b>${carName(vr.model)}</b>${mask}</p>
      <button type="button" class="vinres__link" data-vr="no">${t("vr.change")}</button>`;
  else if (vr.kind === "model") head = `<p class="vinres__q">${t("vr.which.n")}</p>`;
  else head = `<p class="vinres__q">${brand ? t("vr.which.b").replace("{b}", brand.name) : t("vr.which")}${mask}</p>`;
  $("vrHead").innerHTML = head;
  // Выбор модели — общий селектор .pick; марку из VIN ставим первой.
  $("pickVin").hidden = vr.kind === "oe" || !!vr.model;
  pickVin();

  const items = vinItems();
  const m = vr.model && vr.model !== "other" && popular(vr.model);
  // Под деталями — строка ссылок: вся витрина модели и «Inna część» (раскрывает поле «что ещё»).
  const more = [m && m.vitrine ? `<button type="button" class="vinres__link" data-vr="all">${t("vr.all")}</button>` : "",
    vr.note ? "" : `<button type="button" class="vinres__link" data-vr="note" aria-controls="vrNoteBox" aria-expanded="false">${t("vr.more")}</button>`].join("");
  $("vrParts").innerHTML = vr.kind === "oe" ? "" : (items.length
    ? `<p class="vinres__k" id="vrPartsK">${t("vr.parts")}</p>
      <ul class="vinres__parts" aria-labelledby="vrPartsK">${items.map((it) => `<li><label>
        <input type="checkbox" value="${it.oe}"${vr.picked.has(it.oe) ? " checked" : ""}>
        <span class="vinres__name">${tr(it.name)}<small>OE ${it.oe}</small></span>
        <span class="vinres__price"><b>${t("price.from")}${zl(it.ours)}</b>${it.pl
          ? `<span class="badge">−${save(it.ours, it.pl)}%</span>` : `<span class="badge badge--rare">${t("badge.rare")}</span>`}</span>
      </label></li>`).join("")}</ul>`
    : m ? `<p class="vinres__k">${t("vr.noparts")}</p>` : "") + (more ? `<div class="vinres__more">${more}</div>` : "");
  $("vrNoteBox").hidden = !vr.note;
  $("vrNoteK").textContent = t(vr.kind === "oe" ? "vr.oe.note" : "vr.note");
  $("vrNote").placeholder = t(vr.kind === "oe" ? "vr.oe.ph" : "vr.note.ph");
  // Без VIN — после выбора модели внизу необязательное поле VIN
  $("vrVinBox").hidden = vr.kind !== "model" || !vr.model;
  $("vrVinMsg").textContent = vr.vinErr ? t(vr.vinErr) : "";
  vinChannel();
  liftSize(); // содержимое панели сменилось — окно плавно подстраивается
}

// Марка из VIN известна — в списке только её модели; не известна — все. Последним — «Inny model / nie wiem».
const pickVin = picker("pickVin", () => t("vit.model"),
  () => [...POPULAR.filter((m) => !vr.brand || m.brand === vr.brand)
    .sort((a, b) => a.brand.localeCompare(b.brand)) // без марки — сгруппированы: Genesis, Hyundai, Kia
    .map((m) => [m.key, m.full || m.name]), ["other", t("vr.other")]],
  () => vr.model,
  (k) => {
    Object.assign(vr, { model: k, asked: true, picked: new Set() });
    vinRes();
    ($("vrParts").querySelector("input") || $("vrNote")).focus();
  },
  () => t("vr.pick.none"));

$("vinRes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-vr]");
  if (!b) return;
  const act = b.dataset.vr;
  if (act === "yes") { vr.asked = true; vinRes(); ($("vrParts").querySelector("input") || $("vrNote")).focus(); }
  else if (act === "no") { Object.assign(vr, { model: null, asked: true, picked: new Set() }); vinRes(); $("pickVin").querySelector(".pick__btn").focus(); }
  else if (act === "note") { vr.note = true; vinRes(); $("vrNote").focus(); }
  else if (act === "all") {
    Object.assign(state, { model: popular(vr.model).vitrine, cat: null, q: null });
    dropSearch(false);
    render();
    $("vitrine").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
  }
});
$("vrParts").addEventListener("change", (e) => {
  if (e.target.type !== "checkbox") return;
  vr.picked[e.target.checked ? "add" : "delete"](e.target.value);
  vinChannel();
});
$("vrNote").addEventListener("input", vinChannel);
const vinOpt = () => { const { vin, err } = vinCheck($("vrVin").value); return !err && vin.length === 17 ? vin : ""; };
function vrVinErr(blur) {
  const { vin, err } = vinCheck($("vrVin").value);
  vr.vinErr = err || (blur && vin && vin.length < 17 ? "vr.vin.short" : null);
  $("vrVinMsg").textContent = vr.vinErr ? t(vr.vinErr) : "";
  if (vr.vinErr) $("vrVin").setAttribute("aria-invalid", "true"); else $("vrVin").removeAttribute("aria-invalid");
  vinChannel();
  liftSize();
}
$("vrVin").addEventListener("input", () => vrVinErr(false));
$("vrVin").addEventListener("blur", () => vrVinErr(true));
$("vrCh").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ch]");
  if (!b) return;
  vr.ch = b.dataset.ch;
  $("vrMsg").textContent = "";
  vinChannel();
});

// Сообщение для мессенджера / письма: VIN или OE, модель, отмеченные детали, «что ещё», язык.
function vinLines() {
  const parts = vinItems().filter((it) => vr.picked.has(it.oe)).map((it) => `– ${tr(it.name)} (OE ${it.oe})`);
  const note = $("vrNote").value.trim();
  if (vr.kind === "oe") return [t("msg.hello"), `OE: ${vr.code}`, note ? `${t("vr.msg.car")}: ${note}` : null, `Lang: ${lang}`];
  // Без VIN — «Model: Kia K8 (bez VIN)», чтобы было видно, что VIN надо спросить.
  const vin = vr.kind === "vin" ? vr.code : vinOpt();
  const car = vr.model ? carName(vr.model) : t("vr.other");
  return [t("msg.hello"), vin ? `VIN: ${vin}` : `${t("vr.msg.model")}: ${car} (${t("vr.msg.novin")})`,
    vin && vr.model ? `${t("vr.msg.car")}: ${car}` : null,
    `${t("mail.parts")}:\n${parts.length ? parts.join("\n") : "– " + t(vin ? "vr.msg.byvin" : "vr.msg.bymodel")}`,
    note ? `${t("vr.msg.more")}: ${note}` : null, `Lang: ${lang}`];
}
const vinText = () => vinLines().filter(Boolean).join("\n");

// Ссылка кнопки отправки — настоящая <a>: работает с клавиатуры, средней кнопкой, без всплывающих окон.
function vinChannel() {
  document.querySelectorAll("#vrCh [data-ch]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.ch === vr.ch));
  const go = $("vrGo"), text = vinText();
  const subject = `${t("mail.subject")} ${vr.code || vinOpt() || (vr.model ? carName(vr.model) : "")}`.trim();
  go.href = vr.ch === "wa" ? `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`
    : vr.ch === "tg" ? `https://t.me/${TELEGRAM_USER}`
    : `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  if (vr.ch === "mail") go.removeAttribute("target"); else { go.target = "_blank"; go.rel = "noopener"; }
  go.innerHTML = `${t("vr.go").replace("{c}", { wa: "WhatsApp", tg: "Telegram", mail: "e-mail" }[vr.ch])} <span aria-hidden="true">›</span>`;
}
// Telegram не умеет подставлять текст в личный чат по ссылке — копируем сообщение в буфер и подсказываем вставить.
function copyText(text) {
  const legacy = () => {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("copy");
  };
  if (!navigator.clipboard || !window.isSecureContext) return new Promise((ok) => { legacy(); ok(); });
  return navigator.clipboard.writeText(text).catch(legacy);
}
$("vrGo").addEventListener("click", () => {
  const msg = $("vrMsg");
  const say = (text) => { msg.textContent = text; liftSize(); };
  if (vr.ch !== "tg") return say(t(vr.ch === "wa" ? "vr.sent.wa" : "vr.sent.mail"));
  const v = vr.kind === "model" ? vinOpt() : vr.code;
  copyText(vinText()).then(() => say(t("vr.sent.tg")), () => say(v ? t("vr.sent.tg.fail").replace("{v}", v) : t("vr.sent.tg.fail.m")));
});
// Запасной путь — обычная форма заявки с уже подставленными VIN, моделью и деталями.
$("vrForm").addEventListener("click", () => {
  const vin = vr.kind === "vin" ? vr.code : vr.kind === "model" ? vinOpt() : "";
  if (vin) form.vin.value = vin;
  if (vr.model) { formModel = vr.model; pickForm(); }
  const note = $("vrNote").value.trim();
  if (vr.kind === "oe") addToParts(`OE ${vr.code}${note ? " — " + note : ""}`);
  else {
    const car = vr.model && vr.model !== "other" ? carName(vr.model) : "";
    const picked = vinItems().filter((it) => vr.picked.has(it.oe));
    picked.forEach((it) => addToParts(`${car ? car + ": " : ""}${tr(it.name)} (${it.oe})`));
    if (note) addToParts(`${car ? car + ": " : ""}${note}`);
    if (!picked.length && !note && car) addToParts(`${car}: `);
  }
  openForm();
});

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
    const [roof, wheels, cx] = m.box, h = 68 / (wheels - roof);
    const pos = `--h:${h.toFixed(1)};--t:${(10 - roof * h).toFixed(1)};--cx:${cx}`;
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
// вправо за панель, под панелью — та же пустая студия из этого снимка. Высота машины ≈ 48% карточки, колёса ≈ 81%.
function placeSides() {
  const wide = matchMedia("(min-width: 641px)").matches;
  const ow = getComputedStyle(grid).getPropertyValue("--ow").trim();
  const openW = ow.endsWith("vw") ? innerWidth * parseFloat(ow) / 100 : parseFloat(ow);
  const shutW = parseFloat(getComputedStyle(grid).getPropertyValue("--cw")) || 240;
  grid.querySelectorAll(".model.has-side").forEach((card) => {
    const m = POPULAR.find((x) => x.key === card.dataset.pop), [roof, wheels, front] = m.side;
    const img = card.querySelector(".model__side"), cardH = card.offsetHeight;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 21 / 9;
    const imgH = Math.max(1, 0.48 / (wheels - roof)) * cardH, imgW = imgH * ratio;
    const top = Math.min(0, Math.max(cardH - imgH, cardH * 0.81 - wheels * imgH));
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
    addToParts(`${m.name}: `);
    return openForm();
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
  const what = `${MODELS[it.model]}: ${tr(it.name)} (${it.oe})`;
  return `<article class="card">
    <div class="card__img"><img src="img/parts/${it.img}.jpg" alt="" loading="lazy">${chip}</div>
    <div class="card__body">
      <p class="card__model">${state.model === "all" ? SHORT[it.model] + " · " : ""}${tr(CATEGORIES[it.cat])}</p>
      <h4>${tr(it.name)}</h4>
      <div class="price"><span class="price__ours">${t("price.from")}${zl(it.ours)}</span>${sub}</div>
    </div>
    <div class="card__foot">
      <span class="card__oe">OE ${highlight(it.oe)}</span>
      <button type="button" class="card__ask" data-ask="${what}" aria-label="${t("btn.ask")}: ${tr(it.name)}">${t("btn.ask")} <span aria-hidden="true">›</span></button>
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
        <button type="button" class="btn" data-ask="${car}: ${tr(b.name)}">${t("btn.bundle")}</button>
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
    const v = val(), cur = items.find(([k]) => k === v) || (ph ? [null, ph()] : items[0]);
    btn.querySelector(".pick__k").textContent = label();
    btn.querySelector(".pick__v").textContent = cur[1];
    btn.setAttribute("aria-label", `${label()}: ${cur[1]}`);
    list.setAttribute("aria-label", label());
    list.innerHTML = items.map(([k, txt], i) =>
      `<li role="option" id="${id}-${i}" aria-selected="${k === cur[0]}">${txt}${TICK}</li>`).join("");
  };
  const mark = (i) => {
    const lis = [...list.children];
    active = (i + lis.length) % lis.length;
    lis.forEach((li, k) => li.classList.toggle("is-active", k === active));
    list.setAttribute("aria-activedescendant", lis[active].id);
    lis[active].scrollIntoView({ block: "nearest" }); // длинный список прокручивается внутри
  };
  const open = () => {
    update();
    list.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    mark(Math.max(0, items.findIndex(([k]) => k === val())));
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
    const li = e.target.closest("li");
    if (li) pick([...list.children].indexOf(li));
  });
  list.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); mark(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); mark(active - 1); }
    else if (e.key === "Home") { e.preventDefault(); mark(0); }
    else if (e.key === "End") { e.preventDefault(); mark(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
  });
  document.addEventListener("click", (e) => { if (!list.hidden && !root.contains(e.target)) close(false); });
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
const STICKERS = [["cost", "card-tick"], ["for", "box-tick"]];
const EXTRAS = { e: ["x2", "camera"], c: ["x2", "receipt"] };
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
const HOW = [["search-normal", "you"], ["receipt-text", "us"], ["card-tick", "you"], ["camera", "us"], ["box-tick", "you"]];
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
function langPick(code) {
  if (code !== lang) {
    lang = code;
    try { localStorage.setItem("lang", lang); } catch (err) { /* без запоминания */ }
    applyLang();
  }
  langClose();
}
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

/* ---------- Форма заявки в модальном окне ---------- */

// Панель с формой стоит в секции #vin (без JS — обычная форма внизу страницы); с JS переносим её в <dialog>,
// а секцию прячем: финальный призыв — CTA над ней.
const form = $("vinForm");
const dlg = $("vinDlg");
const panel = $("vinPanel");
panel.className = "dlg__body";
dlg.append(panel);
$("vin").hidden = true;
let opener = null;
// Телефон: высота окна = видимая часть экрана (без экранной клавиатуры), чтобы низ с кнопкой не уезжал под неё;
// поле в фокусе докручиваем в зону видимости.
const vv = window.visualViewport;
function fitDialog() {
  if (!vv || !dlg.open) return;
  dlg.style.setProperty("--vvh", vv.height + "px");
  // Клавиатура открыта (экран низкий) — прячем подзаголовок и строку с мессенджерами, полям нужнее место.
  dlg.classList.toggle("is-tight", vv.height < 560);
}
if (vv) vv.addEventListener("resize", fitDialog);
dlg.addEventListener("focusin", (e) => {
  if (e.target.matches("input, textarea")) setTimeout(() => e.target.scrollIntoView({ block: "nearest" }), 300);
});

// Модель вместо VIN (нет под рукой): тот же селектор .pick, что в панели первого экрана. Нужно хотя бы одно из двух.
let formModel = null;
const pickForm = picker("pickForm", () => t("form.model"),
  () => [...[...POPULAR].sort((a, b) => a.brand.localeCompare(b.brand)).map((m) => [m.key, m.full || m.name]), ["other", t("vr.other")]],
  () => formModel,
  (k) => {
    formModel = k;
    pickForm();
    // «Podaj VIN albo model» больше не актуально
    if (!norm(form.vin.value)) { form.vin.removeAttribute("aria-invalid"); $("formMsg").textContent = ""; }
  },
  () => t("form.model.ph"));
form.addEventListener("reset", () => { formModel = null; pickForm(); });

// Открыть заявку. Фокус — на первое поле, которое ещё надо заполнить (VIN или модель → детали → телефон).
function openForm() {
  dropSearch(false); // «Wolę formularz», «klient Arena» — окно поиска уступает место форме
  if (!dlg.open) {
    opener = document.activeElement;
    if (!$("vinOk").hidden) { form.reset(); $("formMsg").textContent = ""; }
    showForm();
    dlg.showModal();
    fitDialog();
  }
  const vinOk = form.arena.checked || norm(form.vin.value).length === 17 || !!formModel;
  const parts = form.parts.value.trim();
  const field = !vinOk ? form.vin : !parts || parts.endsWith(":") ? form.parts : form.contact;
  field.focus();
  if (field === form.parts) field.setSelectionRange(field.value.length, field.value.length);
}
// Форма или экран «готово» (после отправки письма).
function showForm(done = false) {
  form.hidden = done;
  $("vinOk").hidden = !done;
}
dlg.addEventListener("close", () => {
  if (!$("vinOk").hidden) { form.reset(); showForm(); $("formMsg").textContent = ""; }
  if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  if (location.hash === "#vin") history.replaceState(null, "", location.pathname + location.search);
});
// Крестик, «Wróć na stronę» и клик по затемнению вокруг карточки (нажали и отпустили на фоне —
// чтобы выделение текста, отпущенное за краем карточки, окно не закрывало).
let downOnBackdrop = false;
dlg.addEventListener("pointerdown", (e) => (downOnBackdrop = e.target === dlg));
dlg.addEventListener("click", (e) => {
  if ((e.target === dlg && downOnBackdrop) || e.target.closest("[data-dlg-close]")) dlg.close();
});

// Не дублируем строку, если ту же деталь добавили второй раз.
function addToParts(text) {
  const lines = form.parts.value.split("\n").map((l) => l.trim());
  if (lines.includes(text.trim())) return;
  form.parts.value = form.parts.value ? form.parts.value + "\n" + text : text;
}

// Все «Wyślij VIN» (ссылки #vin), кнопки на карточках, в наборах и баннерах — открывают заявку с контекстом.
document.addEventListener("click", (e) => {
  const el = e.target.closest('a[href="#vin"], [data-ask], [data-ask-key], [data-arena]');
  if (!el) return;
  e.preventDefault();
  if ("arena" in el.dataset) form.arena.checked = true;
  else if (el.dataset.ask || el.dataset.askKey) addToParts(el.dataset.ask ?? t(el.dataset.askKey));
  openForm();
});
// Прямая ссылка на сайт с #vin — сразу открыть заявку.
if (location.hash === "#vin") openForm();

// Ошибка формы: подсвечиваем поле, связываем с сообщением и ставим на него фокус (WCAG 3.3.1).
function fail(field, key) {
  const msg = $("formMsg");
  form.querySelectorAll("[aria-invalid]").forEach((f) => f.removeAttribute("aria-invalid"));
  field.setAttribute("aria-invalid", "true");
  const ids = (field.getAttribute("aria-describedby") || "").split(" ").filter((id) => id && id !== "formMsg");
  field.setAttribute("aria-describedby", [...ids, "formMsg"].join(" "));
  msg.textContent = t(key);
  msg.classList.add("is-error");
  field.focus();
}
form.addEventListener("input", (e) => {
  if (e.target.getAttribute("aria-invalid")) e.target.removeAttribute("aria-invalid");
});

// Пилот без бэкенда: собираем заявку в письмо.
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = $("formMsg");
  const vin = norm(form.vin.value);
  const arena = form.arena.checked;
  // VIN или модель: начатый VIN должен быть полным; пустой — достаточно модели
  if (!arena && vin && vin.length !== 17) return fail(form.vin, "msg.vin");
  if (!arena && !vin && !formModel) return fail(form.vin, "msg.vinmodel");
  if (!form.parts.value.trim()) return fail(form.parts, "msg.fill");
  if (!form.contact.value.trim()) return fail(form.contact, "msg.fill");
  const email = form.email.value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(form.email, "msg.email");
  if (!form.rodo.checked) return fail(form.rodo, "msg.rodo");
  msg.classList.remove("is-error");
  const car = formModel ? carName(formModel) : "";
  const body = [vin || !car ? `VIN: ${vin || "—"}` : `${t("vr.msg.model")}: ${car} (${t("vr.msg.novin")})`,
    vin && car ? `${t("vr.msg.model")}: ${car}` : null, arena ? t("mail.arena") : null, `${t("mail.parts")}:\n${form.parts.value}`,
    `${t("form.contact")}: ${form.contact.value}`, email ? `E-mail: ${email}` : null, `Lang: ${lang}`].filter(Boolean).join("\n\n");
  const subject = `${t("mail.subject")} ${vin || car || t("mail.arena")}`;
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  msg.textContent = "";
  form.querySelectorAll("[aria-invalid]").forEach((f) => f.removeAttribute("aria-invalid"));
  showForm(true);
  $("vinOkTitle").focus();
});

ixFill();
applyLang();
observe(document);
