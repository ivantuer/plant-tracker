// Typical houseplant pests and diseases in Ukrainian homes, and a seasonal plan. General advice only: always follow the label
// of any product, ventilate, and keep treated plants away from pets and children.
import type { Lang } from './types';

type L = Record<Lang, string>;

export interface Pest {
  key: string;
  emoji: string;
  name: L;
  signs: L;
  /** Months when it is most common. */
  season: number[];
  steps: L;
  /** Repeat the treatment this many times, this many days apart (eggs hatch between treatments). */
  times: number;
  gap: number;
  product: L;
}

const P = (key: string, emoji: string, nameUk: string, nameEn: string, season: number[], times: number, gap: number, signsUk: string, signsEn: string, stepsUk: string, stepsEn: string, productUk: string, productEn: string): Pest => ({
  key, emoji, name: { uk: nameUk, en: nameEn }, season, times, gap, signs: { uk: signsUk, en: signsEn }, steps: { uk: stepsUk, en: stepsEn }, product: { uk: productUk, en: productEn },
});

export const PESTS: Pest[] = [
  P('mite', '🕸️', 'Павутинний кліщ', 'Spider mite', [10, 11, 12, 1, 2, 3, 4, 7, 8], 3, 7,
    'Тонка павутинка на стеблах і між листками, дрібні світлі цяточки, листя тьмяніє й жовкне. Любить сухе тепле повітря — головна біда опалювального сезону.',
    'Fine webbing on stems and between leaves, tiny pale dots, dull yellowing leaves. Loves dry warm air — the big heating-season problem.',
    'Відокремте рослину. Тепле душове миття листя (особливо знизу), підвищте вологість. Далі — акарицид; звичайні інсектициди кліща не беруть. Повторіть 3 рази з інтервалом 5–7 днів.',
    'Isolate the plant. Rinse the leaves under a warm shower (undersides too) and raise humidity. Then an acaricide — ordinary insecticides do not kill mites. Repeat 3 times, 5–7 days apart.',
    'Акарицид або біопрепарат (наприклад, на основі аверсектину, як Фітоверм).', 'An acaricide or a bio product (e.g. avermectin-based, like Fitoverm).'),
  P('thrips', '🪰', 'Трипси', 'Thrips', [3, 4, 5, 6, 7, 8, 9], 3, 7,
    'Сріблясті штрихи й чорні крапки на листі, деформовані молоді листки, квіти з плямами. Швидко розмножуються в теплі.',
    'Silvery streaks and black dots on leaves, deformed young growth, spotted flowers. Multiply fast in warmth.',
    'Відокремте, змийте душем, повісьте сині клейкі пастки. Обробіть інсектицидом 3 рази кожні 7 днів, змініть верхній шар ґрунту.',
    'Isolate, rinse in the shower, hang blue sticky traps. Treat with an insecticide 3 times, 7 days apart, and replace the top layer of soil.',
    'Системний або біологічний інсектицид (Актара, Фітоверм тощо — за інструкцією).', 'A systemic or biological insecticide (e.g. Aktara, Fitoverm — per the label).'),
  P('aphid', '🐛', 'Попелиця', 'Aphids', [3, 4, 5, 6, 9, 10], 3, 7,
    'Зелені, чорні чи сірі комашки на молодих пагонах і бруньках, липкий наліт, скручені листки.',
    'Green, black or grey insects on young shoots and buds, sticky residue, curled leaves.',
    'Змийте струменем води, протріть розчином калійного мила. За сильного ураження — інсектицид; повторіть через 7 днів.',
    'Rinse with a water jet, wipe with a potassium-soap solution. If heavy, use an insecticide; repeat after 7 days.',
    'Калійне мило, а за потреби — контактний інсектицид.', 'Potassium soap, or a contact insecticide if needed.'),
  P('mealybug', '🧶', 'Борошнистий червець', 'Mealybug', [3, 4, 5, 6, 7, 8, 9, 10], 3, 10,
    'Білі пухнасті грудочки «вати» у пазухах листків і на стеблах, липка роса, слабкий ріст.',
    'White cottony tufts in leaf axils and on stems, sticky honeydew, weak growth.',
    'Зніміть вручну ватною паличкою зі спиртом, обробіть інсектицидом 3 рази кожні 10 днів (кладки захищені «ватою»). Перевірте коріння.',
    'Remove by hand with a cotton swab dipped in alcohol, then treat with an insecticide 3 times, 10 days apart (eggs hide in the fluff). Check the roots too.',
    'Системний інсектицид (в ґрунт) + спиртова протирка.', 'A systemic insecticide (soil drench) plus an alcohol wipe.'),
  P('scale', '🟤', 'Щитівка', 'Scale insects', [1, 2, 3, 4, 5, 10, 11, 12], 4, 10,
    'Коричневі горбки-«бляшки» на стеблах і нижньому боці листків, липкий наліт. Часто на фікусах, пальмах, цитрусових.',
    'Brown bumps on stems and leaf undersides, sticky residue. Common on ficus, palms and citrus.',
    'Зніміть щитки вручну (ватка зі спиртом чи м’яка щітка), обробіть 3–4 рази кожні 10 днів — личинки під щитком захищені.',
    'Scrape the shells off by hand (alcohol swab or soft brush), then treat 3–4 times, 10 days apart — the shell protects what is underneath.',
    'Системний інсектицид (Актара тощо).', 'A systemic insecticide (e.g. Aktara).'),
  P('gnat', '🦟', 'Грибні комарики (сциариди)', 'Fungus gnats', [10, 11, 12, 1, 2, 3, 4], 4, 7,
    'Дрібні чорні мушки з ґрунту, коли чіпаєш рослину. Личинки живуть у вологому ґрунті — наслідок перезволоження.',
    'Tiny black flies rising from the soil. The larvae live in wet soil — a result of overwatering.',
    'Давайте верхньому шару підсихати 2–3 см, повісьте жовті клейкі пастки, полийте біопрепаратом проти личинок. Повторіть 3–4 рази раз на тиждень.',
    'Let the top 2–3 cm dry out, hang yellow sticky traps, drench with a larvicide. Repeat 3–4 times, weekly.',
    'Біопрепарат на основі Bti або інсектицид у ґрунт.', 'A Bti-based biological larvicide or a soil insecticide.'),
  P('whitefly', '🦋', 'Білокрилка', 'Whitefly', [4, 5, 6, 7, 8, 9, 10], 3, 5,
    'Крихітні білі «метелики» злітають, якщо струснути рослину; липкий наліт, жовкнуть листки. Любить гібіскус, пеларгонію, лимон.',
    'Tiny white “moths” flutter up when you shake the plant; sticky residue, yellowing leaves. Loves hibiscus, geranium, lemon.',
    'Жовті клейкі пастки, душ, інсектицид 3 рази кожні 5 днів (цикл розвитку короткий).',
    'Yellow sticky traps, a shower, and an insecticide 3 times, 5 days apart (the life cycle is short).',
    'Інсектицид широкого спектра.', 'A broad-spectrum insecticide.'),
  P('mildew', '🌫️', 'Борошниста роса', 'Powdery mildew', [4, 5, 6, 9, 10], 2, 10,
    'Білий борошнистий наліт на листі й бутонах. Виникає при застої повітря й різких перепадах вологості.',
    'White powdery coating on leaves and buds. Appears with stale air and swings in humidity.',
    'Приберіть уражені листки, провітрюйте, не заливайте. Обробіть фунгіцидом 2 рази кожні 10 днів.',
    'Remove the affected leaves, ventilate, do not overwater. Treat with a fungicide 2 times, 10 days apart.',
    'Фунгіцид (сірка, мідьвмісні чи системні) — за інструкцією.', 'A fungicide (sulphur, copper or systemic) — per the label.'),
];

export interface Month {
  uk: string;
  en: string;
}

/** What to do with houseplants each month, for a typical Ukrainian flat and balcony. Index 0 = January. */
export const MONTH_PLAN: { title: Month; tips: Month }[] = [
  { title: { uk: 'Спокій і світло', en: 'Rest and light' }, tips: { uk: 'Мінімум поливу, підживлення не потрібне. Тримайте подалі від батарей, додайте досвічування. Перевіряйте на павутинного кліща.', en: 'Minimal watering, no feeding. Keep away from radiators, add grow-light. Check for spider mites.' } },
  { title: { uk: 'Світла дедалі більше', en: 'More light every day' }, tips: { uk: 'Протріть листя від пилу. Наприкінці місяця можна сіяти перець, томати й зелень на розсаду. Не поспішайте з підживленням.', en: 'Wipe the dust off leaves. Late in the month sow peppers, tomatoes and herbs. Do not rush feeding.' } },
  { title: { uk: 'Старт сезону', en: 'Season start' }, tips: { uk: 'Час пересаджувати й обрізати. З другої половини місяця — перші слабкі підживлення. Огляд на шкідників після зими, за потреби — профілактична обробка.', en: 'Time to repot and prune. From mid-month, first light feeding. Inspect for pests after winter; treat if needed.' } },
  { title: { uk: 'Активний ріст', en: 'Active growth' }, tips: { uk: 'Підживлення раз на 2 тижні, поливайте частіше. Найкращий час для черенкування і пересадки. Відкривайте вікна для провітрювання без протягів.', en: 'Feed every 2 weeks and water more often. Best time for cuttings and repotting. Air the room without drafts.' } },
  { title: { uk: 'На балкон', en: 'Out to the balcony' }, tips: { uk: 'Виносити на балкон можна, коли вночі стабільно вище +10 °C, і поступово привчати до сонця. Захищайте від прямого полуденного сонця.', en: 'Move plants out once nights stay above +10 °C, getting them used to sun gradually. Shade from midday sun.' } },
  { title: { uk: 'Пік росту', en: 'Peak growth' }, tips: { uk: 'Підживлення й рясний полив. Слідкуйте за трипсами й попелицею. Багато рослин цвіте — видаляйте зів’ялі квіти.', en: 'Feed and water generously. Watch for thrips and aphids. Many plants bloom — deadhead faded flowers.' } },
  { title: { uk: 'Спека', en: 'Heat' }, tips: { uk: 'Поливайте зранку або ввечері, обприскуйте тих, хто любить вологість. Не пересаджуйте у спеку. Слідкуйте за кліщем і білокрилкою.', en: 'Water in the morning or evening, mist the humidity-lovers. Do not repot in heat. Watch for mites and whitefly.' } },
  { title: { uk: 'Останнє підживлення', en: 'Last feeding' }, tips: { uk: 'Наприкінці місяця припиніть азотні підживлення, щоб пагони встигли визріти. Можна вкорінювати живці.', en: 'Stop nitrogen feeds near the end so shoots can harden. Good time to root cuttings.' } },
  { title: { uk: 'Готуємось до зими', en: 'Getting ready for winter' }, tips: { uk: 'Перед заносом з балкона огляньте рослини, обробіть від шкідників і потримайте окремо 2 тижні. Зменште підживлення. Заносьте до холодів.', en: 'Before bringing plants in, inspect, treat for pests and keep them apart for two weeks. Cut back on feeding. Bring in before the cold.' } },
  { title: { uk: 'Опалювальний сезон', en: 'Heating season' }, tips: { uk: 'Занесіть усе, коли вночі нижче +8–10 °C. Повітря сухішає — зволожуйте і слідкуйте за кліщем. Полив рідший, підживлення вже не потрібне.', en: 'Bring everything in when nights fall below +8–10 °C. The air gets drier — humidify and watch for mites. Water less, stop feeding.' } },
  { title: { uk: 'Мало світла', en: 'Low light' }, tips: { uk: 'Перенесіть ближче до вікна, додайте досвічування. Поливайте помірно — головна загроза зараз гниль від перезволоження. Цвітуть цикламени й орхідеї.', en: 'Move closer to the window, add grow-light. Water moderately — rot is the main threat now. Cyclamen and orchids bloom.' } },
  { title: { uk: 'Святковий спокій', en: 'Holiday rest' }, tips: { uk: 'Не підживлюйте. Подалі від батарей і протягів. Перевіряйте на кліща й сциарид. Цвітуть декабрист і пуансетія.', en: 'No feeding. Keep away from radiators and drafts. Check for mites and fungus gnats. Christmas cactus and poinsettia bloom.' } },
];
