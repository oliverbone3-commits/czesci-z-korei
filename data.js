// Витрина пилота: позиции, которые по «Проверка цен.xlsx» выгодно везти
// (вердикт «Выгодно» или «Нового в PL нет»). Цены — ориентир, доставка контейнером.
// ours — наша цена брутто, zł; pl — цена нового в Польше, zł (null — нового в продаже нет).
// Тексты — на всех языках сайта: { pl, en }.

// Дата сверки цен в «Проверка цен.xlsx» (курс NBP на этот день). Показывается подписью у витрины, наборов и сравнения.
// Фиксированная, не «сегодня»: цены ориентировочные. TODO: позже обновлять автоматически при реальной проверке цен.
const PRICES_CHECKED = "2026-10-26";

// Корейские марки — логотипы в img/brands (Simple Icons; Genesis — Wikimedia Commons, только крылья).
// viewBox файлов обрезан по контуру; h — высота в px, подобрана так, чтобы все три занимали одинаковую площадь
// (подобрано на глаз по «весу»: у Kia жирное начертание — меньше, у Genesis тонкие крылья — больше).
const BRANDS = [
  { key: "hyundai", name: "Hyundai", logo: "img/brands/hyundai.svg", h: 22 },
  { key: "kia", name: "Kia", logo: "img/brands/kia.svg", h: 13 },
  { key: "genesis", name: "Genesis", logo: "img/brands/genesis.svg", h: 17 },
];

// Популярные модели — карточки с половиной машины спереди. Фото сгенерированы Gemini в студии (img/models/*.jpg).
// box — замер машины на фото в долях кадра: [крыша, низ колёс, центр по горизонтали].
// По нему каждая машина ставится на одни линии: крыша на 10% высоты карточки, колёса на 78%, центр — по правому краю.
// side — боковой профиль (img/models/side, широкий кадр 21:9, машина в правой части, слева пустая студия):
// [крыша, колёса, перед, зад] в долях кадра. Фото закрывает всю карточку; у кого нет side — вид спереди.
// vitrine — ключ модели в витрине (null — только запрос по VIN).
const POPULAR = [
  { key: "carnival", brand: "kia", name: "Kia Carnival", full: "Kia Carnival KA4", box: [0.22, 0.83, 0.51], side: [0.34, 0.76, 0.458, 0.95], vitrine: "carnival" },
  { key: "k8", brand: "kia", name: "Kia K8", box: [0.20, 0.86, 0.51], side: [0.33, 0.83, 0.295, 0.955], vitrine: "k8" },
  { key: "gv80", brand: "genesis", name: "Genesis GV80", box: [0.24, 0.82, 0.50], vitrine: "genesis" },
  { key: "g80", brand: "genesis", name: "Genesis G80", box: [0.26, 0.82, 0.50], vitrine: "genesis" },
  { key: "sorento", brand: "kia", name: "Kia Sorento", box: [0.22, 0.83, 0.505], vitrine: null },
  { key: "palisade", brand: "hyundai", name: "Hyundai Palisade", box: [0.22, 0.82, 0.51], vitrine: null },
  { key: "grandeur", brand: "hyundai", name: "Hyundai Grandeur", box: [0.245, 0.82, 0.505], vitrine: null },
];

// Распознавание модели по VIN — первый экран, вкладка «Po VIN» (vinDecode() в app.js).
// Марка — по WMI (знаки 1–3), надёжно: коды производителя Hyundai Motor Group по ISO 3780
//   KNA, KNC, KND — Kia; KMH, KM8, KMF, KMJ — Hyundai; KMT, KMU — Genesis
//   (у Genesis G80 2017–2019 модельных лет WMI ещё был KMH — поэтому марку не используем как запрет, только как подсказку).
// Модель — по знакам 1–4 (WMI + первый знак VDS). Подтверждено только по экспортным VIN (рынок США, 2022–2024:
//   clearvin.com, forcar.org, epicvin.com): KNDN… — Carnival KA4, KM8R… — Palisade.
// У машин для внутреннего рынка Кореи (KDM) коды VDS могут отличаться, поэтому модель всегда показываем вопросом
//   «zgadza się?», а без совпадения сразу предлагаем выбрать модель. K8, Sorento, G80, GV80, Grandeur не угадываем:
//   надёжных примеров VIN не нашли. Контрольную цифру (9-й знак) не проверяем — у KDM-машин на неё нельзя полагаться.
const VIN_BRANDS = { KNA: "kia", KNC: "kia", KND: "kia", KMH: "hyundai", KM8: "hyundai", KMF: "hyundai", KMJ: "hyundai", KMT: "genesis", KMU: "genesis" };
const VIN_MODELS = [
  { prefix: "KNDN", model: "carnival" },
  { prefix: "KM8R", model: "palisade" },
];

const MODELS = {
  carnival: "Kia Carnival KA4",
  k8: "Kia K8",
  genesis: "Genesis GV80 / G80",
};

const CATEGORIES = {
  brakes: { pl: "Hamulce", en: "Brakes" },
  suspension: { pl: "Zawieszenie", en: "Suspension" },
  lights: { pl: "Oświetlenie", en: "Lighting" },
  body: { pl: "Nadwozie", en: "Body" },
  service: { pl: "Serwis", en: "Service" },
};

// Повторяющиеся названия деталей.
const N = {
  grille: { pl: "Atrapa chłodnicy", en: "Radiator grille" },
  strut: { pl: "Amortyzator przedni lewy", en: "Front strut, left" },
  disc: { pl: "Tarcza hamulcowa przednia", en: "Front brake disc" },
  pads: { pl: "Klocki hamulcowe przednie", en: "Front brake pads" },
  tail: { pl: "Lampa tylna lewa", en: "Tail light, left" },
  head: { pl: "Reflektor LED lewy", en: "LED headlight, left" },
  mirror: { pl: "Lusterko lewe", en: "Side mirror, left" },
  cabin: { pl: "Filtr kabinowy węglowy", en: "Cabin filter, carbon" },
  air: { pl: "Filtr powietrza (G80 2.5T)", en: "Air filter (G80 2.5T)" },
};
const gv80 = (n) => Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v + " (GV80)"]));

const ITEMS = [
  { model: "carnival", cat: "body", name: N.grille, img: "grille", oe: "86350-R0000", ours: 1014, pl: 2063 },
  { model: "carnival", cat: "suspension", name: N.strut, img: "strut", oe: "54650-R0000", ours: 701, pl: 1363 },
  { model: "carnival", cat: "brakes", name: N.disc, img: "disc", oe: "51712-R0150", ours: 664, pl: 1212 },
  { model: "carnival", cat: "brakes", name: N.pads, img: "pads", oe: "58101-R0A00", ours: 520, pl: 722 },
  { model: "carnival", cat: "lights", name: N.tail, img: "tail", oe: "92401-R0000", ours: 496, pl: 785 },
  { model: "carnival", cat: "lights", name: N.head, img: "head", oe: "92101-R0000", ours: 2773, pl: null },
  { model: "k8", cat: "brakes", name: N.disc, img: "disc", oe: "51712-L1100", ours: 553, pl: 1360 },
  { model: "k8", cat: "brakes", name: N.pads, img: "pads", oe: "58101-L0A11", ours: 485, pl: 704 },
  { model: "k8", cat: "lights", name: N.head, img: "head", oe: "92101-L8000", ours: 4316, pl: null },
  { model: "k8", cat: "lights", name: N.tail, img: "tail", oe: "92401-L8000", ours: 1556, pl: null },
  { model: "k8", cat: "body", name: N.mirror, img: "mirror", oe: "87610-L8011", ours: 845, pl: null },
  { model: "genesis", cat: "service", name: N.cabin, img: "filter", oe: "97133-T6500", ours: 274, pl: 650 },
  { model: "genesis", cat: "service", name: N.air, img: "filter", oe: "28113-T1210", ours: 164, pl: 320 },
  { model: "genesis", cat: "lights", name: gv80(N.head), img: "head", oe: "92101-T6000", ours: 6237, pl: null },
  { model: "genesis", cat: "body", name: gv80(N.grille), img: "grille", oe: "86350-T6610", ours: 2128, pl: null },
];

// Комплекты — лист «Корзины». Отдельная секция #kits, фильтры витрины на неё не влияют. Наборов будет больше:
// каждый описывается целиком здесь, секция подстроится сама (больше трёх — ряд листается стрелками; один — во всю ширину).
// car — подпись машины точнее модели (с двигателем);
// items — состав [название, количество]; photos — мозаика из фото img/parts: [файл, метка на фото], первое — крупное.
const KIT = {
  oil: { pl: "Filtr oleju", en: "Oil filter" },
  air: { pl: "Filtr powietrza", en: "Air filter" },
  cabin: { pl: "Filtr kabinowy", en: "Cabin filter" },
  pads: { pl: "Klocki hamulcowe przednie", en: "Front brake pads" },
  discs: { pl: "Tarcze hamulcowe przednie", en: "Front brake discs" },
};
const QTY = {
  one: { pl: "1 szt.", en: "1 pc" },
  two: { pl: "2 szt.", en: "2 pcs" },
  set: { pl: "komplet", en: "set" },
};
const KIT_FILTERS = [[KIT.oil, QTY.one], [KIT.air, QTY.one], [KIT.cabin, QTY.one]];
const KIT_FULL = [...KIT_FILTERS, [KIT.pads, QTY.set], [KIT.discs, QTY.two]];
const PH_FULL = [["filter", "×3"], ["pads", ""], ["disc", "×2"]];

const BUNDLES = [
  { model: "carnival", items: KIT_FULL, photos: PH_FULL, ours: 1901, pl: 3487,
    name: { pl: "Serwis + hamulce", en: "Service + brakes" } },
  { model: "k8", car: "Kia K8 2.5", items: KIT_FULL, photos: PH_FULL, ours: 1617, pl: 3711,
    name: { pl: "Serwis + hamulce", en: "Service + brakes" } },
  { model: "genesis", car: "Genesis G80 2.5T", items: KIT_FILTERS, photos: [["filter", "×3"]], ours: 460, pl: 1140,
    name: { pl: "Serwis", en: "Service" } },
];
