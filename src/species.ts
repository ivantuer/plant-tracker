// A small guide to common Ukrainian houseplants. Intervals are typical starting points; adjust to your pot, light and room.
import type { Lang } from './types';

export type Light = 'shade' | 'part' | 'bright' | 'sun';
export type Humidity = 'low' | 'medium' | 'high';
type L = Record<Lang, string>;

export interface Species {
  key: string;
  emoji: string;
  name: L;
  light: Light;
  /** Days between waterings in the growing season (April-September) and in the dormant one (October-March). */
  waterSummer: number;
  waterWinter: number;
  /** Days between feeding in the growing season; 0 = not needed. */
  feed: number;
  humidity: Humidity;
  tempMin: number;
  tempMax: number;
  /** Hazardous to cats and dogs if chewed. */
  toxic: boolean;
  repotYears: number;
  /** Months (1-12) when it usually blooms. */
  bloom?: number[];
  /** Grown for a harvest (fruit, herbs). */
  harvest?: boolean;
  tip: L;
}

const S = (key: string, emoji: string, uk: string, en: string, light: Light, ws: number, ww: number, feed: number, humidity: Humidity, tmin: number, tmax: number, toxic: boolean, repot: number, tipUk: string, tipEn: string, extra: Partial<Species> = {}): Species => ({
  key, emoji, name: { uk, en }, light, waterSummer: ws, waterWinter: ww, feed, humidity, tempMin: tmin, tempMax: tmax, toxic, repotYears: repot, tip: { uk: tipUk, en: tipEn }, ...extra,
});

export const SPECIES: Species[] = [
  S('monstera', '🌿', 'Монстера', 'Monstera', 'bright', 7, 14, 14, 'medium', 18, 27, true, 2, 'Поливайте, коли підсохли верхні 3–4 см ґрунту. Дайте опору для стовбура; протирайте великі листки.', 'Water when the top 3–4 cm of soil is dry. Give it a pole to climb and wipe the big leaves.'),
  S('ficus-benjamina', '🌳', 'Фікус Бенджаміна', 'Weeping fig', 'bright', 7, 14, 14, 'medium', 16, 25, true, 2, 'Не любить переставляння та протяги — скидає листя. Тримайте на стабільному яскравому місці.', 'Hates being moved and drafts — it drops leaves. Keep it in one bright spot.'),
  S('ficus-elastica', '🪴', 'Фікус каучуконосний', 'Rubber plant', 'bright', 7, 14, 14, 'low', 16, 27, true, 2, 'Чистіть листя від пилу вологою ганчіркою. Надлишок води — головна причина опадання листя.', 'Wipe the leaves free of dust. Overwatering is the main reason for leaf drop.'),
  S('spathiphyllum', '🤍', 'Спатифілум', 'Peace lily', 'part', 5, 10, 14, 'high', 18, 25, true, 1, 'Вмить обвисає без води і так само швидко відновлюється. Любить обприскування й розсіяне світло.', 'Droops fast when thirsty and perks up soon after watering. Likes misting and soft light.', { bloom: [3, 4, 5, 6, 7, 8, 9] }),
  S('sansevieria', '🗡️', 'Сансев’єрія (тещин язик)', 'Snake plant', 'shade', 14, 30, 30, 'low', 15, 30, true, 3, 'Майже невмируща. Краще недоллити, ніж переллити; взимку майже не поливайте.', 'Nearly unkillable. Better too dry than too wet; water very little in winter.'),
  S('zamioculcas', '🌴', 'Замиокулькас (доларове дерево)', 'ZZ plant', 'part', 14, 30, 30, 'low', 16, 28, true, 3, 'Бульби запасають воду — поливайте рідко, тільки коли ґрунт повністю висох.', 'Tubers store water — water rarely, only when the soil is fully dry.'),
  S('pothos', '🍃', 'Сциндапсус (епіпремнум)', 'Pothos', 'part', 7, 14, 14, 'medium', 16, 28, true, 2, 'Дуже невибагливий. Щипайте кінчики для густоти; легко розмножується живцями у воді.', 'Very easy. Pinch tips for bushiness; roots easily from cuttings in water.'),
  S('chlorophytum', '🕷️', 'Хлорофітум', 'Spider plant', 'bright', 5, 10, 14, 'medium', 12, 25, false, 1, 'Безпечний для тварин. «Діти» на вусах вкорінюються в ґрунті. Коричневі кінчики — від сухого повітря чи жорсткої води.', 'Pet-safe. The “babies” on runners root in soil. Brown tips mean dry air or hard water.'),
  S('orchid', '🌸', 'Орхідея фаленопсис', 'Phalaenopsis orchid', 'bright', 7, 12, 14, 'high', 18, 26, false, 2, 'Поливайте зануренням коріння на 10–15 хв, коли коріння стало сріблястим. Перепад нічної температури на 5–8 °C запускає цвітіння.', 'Soak the roots 10–15 min when they turn silvery. A 5–8 °C night drop triggers blooming.', { bloom: [11, 12, 1, 2, 3, 4] }),
  S('pelargonium', '🌺', 'Пеларгонія (герань)', 'Geranium', 'sun', 4, 10, 14, 'low', 10, 25, true, 1, 'Багато сонця й прохолодна зимівля (8–12 °C) — для рясного цвітіння. Видаляйте зів’ялі квіти.', 'Lots of sun and a cool winter (8–12 °C) for plenty of blooms. Deadhead faded flowers.', { bloom: [5, 6, 7, 8, 9, 10] }),
  S('aloe', '🪴', 'Алое', 'Aloe vera', 'sun', 14, 30, 30, 'low', 12, 28, true, 2, 'Сонячне вікно, легкий ґрунт для сукулентів, поливайте тільки коли повністю висох.', 'Sunny window, gritty succulent soil, water only when fully dry.'),
  S('cactus', '🌵', 'Кактус', 'Cactus', 'sun', 14, 45, 30, 'low', 8, 30, false, 3, 'Взимку — прохолода (8–12 °C), світло й майже без поливу: це запускає цвітіння навесні.', 'Winter: cool (8–12 °C), bright and nearly dry — this sets spring blooms.', { bloom: [4, 5, 6, 7] }),
  S('echeveria', '🪷', 'Ехеверія / молодило', 'Echeveria / succulents', 'sun', 10, 30, 30, 'low', 8, 28, false, 2, 'Багато світла, щоб не витягувалась. Не лийте воду в розетку.', 'Plenty of light to avoid stretching. Do not pour water into the rosette.'),
  S('dracaena', '🎋', 'Драцена', 'Dracaena', 'bright', 7, 14, 21, 'medium', 16, 26, true, 2, 'Чутлива до фтору та хлору у воді — відстоюйте воду. Бурі кінчики — сухе повітря.', 'Sensitive to fluoride/chlorine — let tap water stand. Brown tips mean dry air.'),
  S('begonia', '🌷', 'Бегонія', 'Begonia', 'bright', 5, 10, 14, 'high', 16, 25, true, 1, 'Не обприскуйте листя (плями й гниль) — підвищуйте вологість навколо. Підживлення для цвітіння.', 'Do not mist the leaves (spots, rot) — raise humidity around them. Feed for blooms.', { bloom: [5, 6, 7, 8, 9, 10] }),
  S('saintpaulia', '💜', 'Фіалка (сенполія)', 'African violet', 'bright', 5, 7, 14, 'high', 18, 24, false, 1, 'Поливайте через піддон, уникайте води на листі. Може цвісти майже цілий рік.', 'Water from below, keep leaves dry. Can bloom almost year-round.', { bloom: [3, 4, 5, 6, 7, 8, 9, 10, 11] }),
  S('hibiscus', '🌺', 'Гібіскус (китайська троянда)', 'Hibiscus', 'sun', 3, 7, 14, 'medium', 16, 28, false, 1, 'Багато сонця, води й підживлення з калієм. Квітка живе 1–2 дні, але нові з’являються постійно.', 'Lots of sun, water and potassium feed. Each flower lasts a day or two, new ones keep coming.', { bloom: [5, 6, 7, 8, 9, 10] }),
  S('hoya', '🍯', 'Хойя (воскова лоза)', 'Hoya', 'bright', 10, 21, 21, 'medium', 16, 27, false, 3, 'Не зрізайте квітконоси — вони цвітуть повторно. Любить тісний горщик.', 'Do not cut the flower stalks — they bloom again. Likes a snug pot.', { bloom: [5, 6, 7, 8, 9] }),
  S('calathea', '🍂', 'Калатея / маранта', 'Calathea / prayer plant', 'part', 5, 8, 14, 'high', 18, 25, false, 1, 'Поливайте м’якою відстояною водою. Прямого сонця й протягів не терпить.', 'Use soft, settled water. No direct sun, no drafts.'),
  S('ivy', '🌱', 'Плющ', 'Ivy', 'part', 5, 10, 14, 'medium', 8, 22, true, 1, 'Любить прохолоду. У теплій сухій кімнаті швидко вражається павутинним кліщем.', 'Likes it cool. In a warm dry room it gets spider mites quickly.'),
  S('anthurium', '🔴', 'Антуріум', 'Anthurium', 'bright', 5, 8, 14, 'high', 18, 26, true, 2, 'Потрібні висока вологість і розсіяне світло. Квітка тримається по 2–3 місяці.', 'Needs high humidity and soft light. A flower lasts 2–3 months.', { bloom: [3, 4, 5, 6, 7, 8, 9, 10] }),
  S('cyclamen', '🌸', 'Цикламен', 'Cyclamen', 'bright', 5, 7, 14, 'medium', 10, 16, true, 1, 'Цвіте восени–взимку в прохолоді. Поливайте у піддон. Влітку «спить» — зменшіть полив.', 'Blooms autumn to spring in the cool. Water into the saucer. Dormant in summer — water less.', { bloom: [10, 11, 12, 1, 2, 3] }),
  S('lemon', '🍋', 'Лимон', 'Lemon', 'sun', 5, 10, 14, 'medium', 12, 25, true, 2, 'Потребує яскравого світла (взимку — досвічування), стабільності й підживлення для цитрусових. Плоди дозрівають 6–9 місяців.', 'Needs bright light (supplement in winter), stability and citrus feed. Fruit takes 6–9 months to ripen.', { bloom: [3, 4, 5], harvest: true }),
  S('chili', '🌶️', 'Гострий перець чилі', 'Chili pepper', 'sun', 3, 5, 10, 'medium', 18, 28, false, 1, 'Сходи через 1–2 тижні, цвітіння через 2–3 місяці, плоди — ще через 1–2. Сильно любить світло.', 'Sprouts in 1–2 weeks, blooms in 2–3 months, fruit 1–2 months later. Loves light.', { bloom: [5, 6, 7, 8], harvest: true }),
  S('herbs', '🌱', 'Зелень (базилік, м’ята, петрушка)', 'Herbs (basil, mint, parsley)', 'sun', 2, 4, 14, 'medium', 15, 26, false, 1, 'Щипайте верхівки — кущ густішає. Восени-взимку додайте досвічування.', 'Pinch the tops for a bushier plant. Add grow-light in autumn and winter.', { harvest: true }),
  S('tomato', '🍅', 'Томат черрі', 'Cherry tomato', 'sun', 3, 4, 10, 'medium', 16, 28, true, 1, 'Потрібне багато сонця й підв’язка. Допомагайте запиленню — струшуйте квітки.', 'Needs lots of sun and a stake. Shake the flowers to help pollination.', { bloom: [5, 6, 7, 8], harvest: true }),
];

export const speciesByKey = (key?: string) => SPECIES.find((s) => s.key === key);
export const speciesName = (s: Species, l: Lang) => s.name[l];

/** The months of the growing season in Ukraine's heating-free half of the year. */
export const GROWING = [4, 5, 6, 7, 8, 9];
export const DORMANT = [10, 11, 12, 1, 2, 3];

export const PLANT_COLORS = ['#3fae6a', '#7bc043', '#2bb3a0', '#e0a526', '#e0605c', '#d66aa8', '#8b6fd6', '#4a90d9'];

/** Scientific-name prefixes of the guide's plants, to link an online search result to its typical care. Specific names come first. */
const LATIN: Record<string, string[]> = {
  monstera: ['monstera'], 'ficus-benjamina': ['ficus benjamina'], 'ficus-elastica': ['ficus elastica'], spathiphyllum: ['spathiphyllum'],
  sansevieria: ['dracaena trifasciata', 'sansevieria', 'dracaena angolensis'], zamioculcas: ['zamioculcas'], pothos: ['epipremnum'], chlorophytum: ['chlorophytum'],
  orchid: ['phalaenopsis'], pelargonium: ['pelargonium'], aloe: ['aloe'], cactus: ['cactaceae', 'mammillaria', 'opuntia', 'echinopsis', 'gymnocalycium'], echeveria: ['echeveria', 'sempervivum', 'crassula', 'sedum'],
  dracaena: ['dracaena'], begonia: ['begonia'], saintpaulia: ['saintpaulia', 'streptocarpus ionanthus'], hibiscus: ['hibiscus rosa-sinensis', 'hibiscus'], hoya: ['hoya'], calathea: ['calathea', 'goeppertia', 'maranta'],
  ivy: ['hedera'], anthurium: ['anthurium'], cyclamen: ['cyclamen'], lemon: ['citrus'], chili: ['capsicum'], herbs: ['ocimum', 'mentha', 'petroselinum', 'rosmarinus', 'thymus'], tomato: ['solanum lycopersicum'],
};

export const speciesForLatin = (latin?: string) => {
  const l = (latin ?? '').toLowerCase();
  const key = l && Object.keys(LATIN).find((k) => LATIN[k].some((p) => l.startsWith(p)));
  return key ? speciesByKey(key) : undefined;
};
