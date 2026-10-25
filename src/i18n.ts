// Two languages, plain dictionaries.
import { signal } from '@preact/signals';
import type { Lang } from './types';

type Dict = Record<string, string>;

const en: Dict = {
  invitePartner: 'Invite partner', haveInvite: 'I have an invite link', joinHousehold: 'Join household', invited: 'You were invited', invitedText: 'Join the shared household to see and log care together. Your data will be merged with the shared data.',
  inviteOnce: 'This link works once and expires in 7 days. Send it only to the person you want to join. To invite someone else, make a new one.', copyLink: 'Copy link', shareLink: 'Share…', copied: 'Invite link copied', inviteMessage: 'Join me in caring for our plants',
  'err.invite': 'That invite link is not valid.', 'err.used': 'This invite was already used or has expired. Ask for a new one.',
  signedInAs: 'Signed in as {email}', signOut: 'Sign out',
  'err.google': 'Could not load Google sign-in. Check your connection.', 'err.owner': 'This server belongs to another Google account.',
  googlePrivacy: 'Your plants are encrypted on this device. The server keeps the key sealed so your Google account can open them on any device.',
  app: 'Plant Care',
  'sync.live': 'Live', 'sync.idle': 'Connected', 'sync.off': 'Offline', 'sync.bad': 'Signed out',
  'digest.title': '🌿 {n} for your plants today', 'digest.more': '+{n} more', 'digest.generic': '🌿 Plant care reminder',
  you: 'You', yourName: 'Your name', yourNameHint: 'Shown next to what you log', yourNamePlaceholder: 'e.g. Ivan',
  household: 'Sync and sharing', householdOn: 'The same Google account opens the same plants on any device. To share with someone else, send them an invite link. Changes appear within a second.',
  householdOff: 'Sign in with Google to sync your plants between devices and get reminders even when the app is closed.', syncNow: 'Sync now', leave: 'Leave', leaveConfirm: 'Stop syncing on this phone? Your data stays here.', syncedAt: 'synced {time}', 'err.sync': 'Could not reach the sync server.',
  'err.auth': 'The server no longer accepts this device. Leave the household and join again with a new invite.', 'err.denied': 'Notifications are blocked. Allow them in your browser or phone settings.', 'err.vapid': 'The server has no push keys set up yet.', 'err.backup': 'That file is not a Plant Care backup.',
  noNotifications: 'This browser does not support notifications. Use the calendar export below.', notifyMe: 'Remind me', remindAt: 'Remind at', remindAtHint: 'Local time of day', testReminder: 'Send a test reminder',
  iosInstall: 'On iPhone, add the app to your Home Screen (Share → Add to Home Screen) to get reminders.', localOnly: 'Reminders arrive while the app is open. Join a household to also get them when it is closed.',
  'tab.today': 'Today', 'tab.plants': 'Plants', 'tab.calendar': 'Calendar', 'tab.guide': 'Guide', 'tab.settings': 'Settings',
  undo: 'Undo', close: 'Close', all: 'All', add: 'Add', save: 'Save', delete: 'Delete', edit: 'Edit', name: 'Name', emoji: 'Emoji', note: 'Note', date: 'Date', plant: 'Plant', search: 'Search…',
  today: 'today', yesterday: 'yesterday', ago: '{d} ago', allYear: 'All year', allPlants: 'All plants', notSet: 'Not set', auto: 'Automatic', inFuture: 'in the future',
  last: 'Last: {when}', lastSkipped: 'Skipped {when}', never: 'Not done yet', done: 'Mark done',
  'sec.overdue': 'Overdue', 'sec.today': 'Today', 'sec.soon': 'Coming up', 'sec.later': 'Later this month',
  attention: '{n} need attention', allGood: 'All caught up 🌿',
  noPlants: 'No plants yet', noPlantsText: 'Add your first plant — pick a species to get typical care right away.', addPlant: 'Add a plant', editPlant: 'Edit plant',
  noTasks: 'No routines yet', noTasksText: 'Watering, feeding, pest checks — anything that repeats.', openRoutines: 'Set up routines',
  doneOn: 'Done on', nextDue: 'Next due', nextDueHint: 'Optional, e.g. a repeat in 5 days', notePlaceholder: 'What you used, how it looks…', markDone: 'Done', skip: 'Skip', recent: 'Recent',
  pickDate: 'Pick a date', tomorrow: 'Tomorrow', weekAgo: 'A week ago', inWeek: 'In a week', inMonth: 'In a month', in3Months: 'In 3 months', clear: 'Clear',
  'due.overdue': 'Overdue by {d}', 'due.today': 'Today', 'due.tomorrow': 'Tomorrow', 'due.in': 'In {d}',
  every1: 'every {u}', every: 'every {x}',
  'u.day': 'day', 'u.week': 'week', 'u.month': 'month', 'u.year': 'year',
  'units.day': 'days', 'units.week': 'weeks', 'units.month': 'months', 'units.year': 'years',
  'n.day.one': '{n} day', 'n.day.other': '{n} days', 'n.week.one': '{n} week', 'n.week.other': '{n} weeks',
  'n.month.one': '{n} month', 'n.month.other': '{n} months', 'n.year.one': '{n} year', 'n.year.other': '{n} years',
  times: '{n} times',
  // plants
  'plants.sub': 'Your collection', 'routines.sub': 'What repeats, and how often', 'plants.seg': 'Plants', 'routines.seg': 'Routines',
  species: 'Species', otherPlant: 'Other / not in the guide', plantNamePlaceholder: 'e.g. Monty', place: 'Place', placePlaceholder: 'Kitchen windowsill', plantedOn: 'Planted on', origin: 'Origin', color: 'Colour',
  'origin.seed': 'From seed', 'origin.cutting': 'Cutting', 'origin.bought': 'Bought', 'origin.gift': 'Gift',
  addCareToo: 'Also add watering and feeding for this species', deletePlantConfirm: 'Delete {name} with its whole history?',
  timeline: 'Growth timeline', afterPlanting: '{d} days after planting', plantRoutines: 'Routines', noRoutinesForPlant: 'No routines for this plant yet.', addCare: 'Add watering and feeding for this species',
  // events
  addEvent: 'Add event', editEvent: 'Edit event', whatHappened: 'What happened', eventNotePlaceholder: 'e.g. second flower stalk',
  'kind.plant': 'Planted', 'kind.sprout': 'Sprouted', 'kind.bud': 'Buds', 'kind.bloom': 'Bloom', 'kind.bloomEnd': 'Bloom ended', 'kind.harvest': 'Harvest',
  // routines
  addRoutine: 'Add a routine', editRoutine: 'Edit routine', kind: 'Type', 'group.care': 'Care', 'group.pest': 'Pest protection', repeat: 'Repeat every', remindBeforeLabel: 'Remind (days before)',
  limit: 'Course length', limitHint: '0 = repeats forever', forPlants: 'Plants', forPlantsHint: 'None selected = all plants', months: 'Active months', monthsHint: 'None selected = all year', startDate: 'First due date', startDateHint: 'Leave empty to start today',
  paused: 'Paused', deleteRoutineConfirm: 'Delete this routine and its history?',
  'preset.water': 'Watering', 'preset.water-summer': 'Watering (summer)', 'preset.water-winter': 'Watering (winter)', 'preset.feed': 'Feeding', 'preset.mist': 'Misting', 'preset.rotate': 'Rotate the pot',
  'preset.wipe': 'Wipe the leaves', 'preset.repot': 'Repotting', 'preset.check': 'Pest inspection', 'preset.shower': 'Leaf shower', 'preset.mite': 'Humidity / mite prevention', 'preset.bio': 'Preventive bio treatment', 'preset.traps': 'Fresh sticky traps',
  'presetHint.check': 'look under the leaves, every 2 weeks', 'presetHint.shower': 'rinse dust and early pests, monthly', 'presetHint.mite': 'heating season, Oct–Apr', 'presetHint.bio': 'spring and autumn, Mar–Oct', 'presetHint.traps': 'yellow and blue, monthly',
  // care info
  careInfo: 'Typical care', 'info.light': 'Light', 'info.water': 'Watering', 'info.feed': 'Feeding', 'info.humidity': 'Humidity', 'info.temp': 'Temperature', 'info.repot': 'Repotting', 'info.bloom': 'Blooms', 'info.pets': 'Cats & dogs',
  'info.waterVal': 'every {s} d (summer) · {w} d (winter)', 'info.feedVal': 'every {d} d in Apr–Sep', 'info.noFeed': 'not needed', 'info.repotVal': 'every {n} y', 'pets.toxic': '⚠️ Toxic if chewed', 'pets.safe': 'Considered safe',
  'light.shade': 'Shade tolerant', 'light.part': 'Bright indirect / part shade', 'light.bright': 'Bright, no harsh midday sun', 'light.sun': 'Full sun',
  'humidity.low': 'Low', 'humidity.medium': 'Medium', 'humidity.high': 'High',
  'info.disclaimer': 'Typical starting values: adjust to your pot size, light and room.',
  // guide
  'guide.sub': 'Care, pests and the seasonal plan', 'guide.pests': 'Pests', 'guide.season': 'By month', 'guide.plants': 'Plants', addThisPlant: 'Add to my plants',
  pestPlan: 'Pest protection plan', pestPlanText: 'The routine most growers in Ukraine follow: inspect often, wash the leaves, humidify in the heating season, one bio treatment in spring and one in autumn.', addPestPlan: 'Add the plan for all plants', planAdded: 'Pest protection plan added', addPlantFirst: 'Add a plant first.',
  nowInSeason: 'Watch for in {m}', commonPests: 'Common pests and diseases', mostCommon: 'Most common', pestDisclaimer: 'Follow the product label, treat in a ventilated place and keep treated plants away from pets and children. Quarantine new plants for 2 weeks.',
  'pest.signs': 'What it looks like', 'pest.what': 'What to do', 'pest.product': 'Products', 'pest.course': 'Treat {n} times, {d} days apart — the eggs hatch between treatments.',
  scheduleTreatment: 'Schedule a treatment course', whichPlants: 'Which plants', firstTreatment: 'First treatment', createCourse: 'Create course ({n} × every {d} d)', treatment: 'Treatment', treatmentAdded: 'Treatment course scheduled',
  seasonTitle: 'Houseplant year', seasonText: 'What to do each month in a typical Ukrainian flat, and which pests to expect.', thisMonth: 'now',
  // calendar
  'calendar.sub': 'Planting, growth and care in one place', 'cal.done': 'care done', 'cal.due': 'planned', 'cal.empty': 'Nothing on this day.', 'cal.planned': 'planned',
  // settings
  appearance: 'Appearance', language: 'Language', theme: 'Theme', 'theme.auto': 'Auto', 'theme.light': 'Light', 'theme.dark': 'Dark', accent: 'Accent colour',
  reminders: 'Reminders', icsHint: 'Repeating calendar events with alerts at that hour. Works even if notifications do not. Export again after a late completion.', exportIcs: 'Add to calendar (.ics)',
  data: 'Your data', exportJson: 'Export backup', importJson: 'Import backup', imported: 'Backup imported', privacy: 'Data is kept on this device. Sync is encrypted.',
};

const uk: Dict = {
  invitePartner: 'Запросити партнера', haveInvite: 'У мене є посилання-запрошення', joinHousehold: 'Приєднатися', invited: 'Вас запросили', invitedText: 'Приєднайтесь до спільного доступу, щоб бачити й вести догляд разом. Ваші дані об’єднаються зі спільними.',
  inviteOnce: 'Посилання діє один раз і спливає за 7 днів. Надсилайте його лише тому, кого хочете запросити. Щоб запросити іншого, створіть нове.', copyLink: 'Копіювати', shareLink: 'Поділитися…', copied: 'Посилання скопійовано', inviteMessage: 'Доглядаймо за рослинами разом',
  'err.invite': 'Це посилання-запрошення недійсне.', 'err.used': 'Запрошення вже використане або прострочене. Попросіть нове.',
  signedInAs: 'Ви увійшли як {email}', signOut: 'Вийти',
  'err.google': 'Не вдалося завантажити вхід Google. Перевірте з’єднання.', 'err.owner': 'Цей сервер належить іншому акаунту Google.',
  googlePrivacy: 'Ваші рослини шифруються на пристрої. Сервер зберігає ключ запечатаним, щоб ваш акаунт Google міг відкрити їх на будь-якому пристрої.',
  app: 'Plant Care',
  'sync.live': 'Наживо', 'sync.idle': 'Підключено', 'sync.off': 'Офлайн', 'sync.bad': 'Від’єднано',
  'digest.title': '🌿 Для рослин сьогодні: {n}', 'digest.more': '+ ще {n}', 'digest.generic': '🌿 Нагадування про догляд за рослинами',
  you: 'Ви', yourName: 'Ваше ім’я', yourNameHint: 'Показується біля того, що ви відмічаєте', yourNamePlaceholder: 'напр. Іван',
  household: 'Синхронізація і спільний доступ', householdOn: 'Той самий акаунт Google відкриває ті самі рослини на будь-якому пристрої. Щоб поділитися з кимось, надішліть йому посилання-запрошення. Зміни з’являються за секунду.',
  householdOff: 'Увійдіть через Google, щоб синхронізувати рослини між пристроями й отримувати нагадування, навіть коли застосунок закритий.', syncNow: 'Синхронізувати', leave: 'Вийти', leaveConfirm: 'Припинити синхронізацію на цьому телефоні? Дані залишаться тут.', syncedAt: 'синхронізовано {time}', 'err.sync': 'Не вдалося зʼєднатися із сервером синхронізації.',
  'err.auth': 'Сервер більше не приймає цей пристрій. Вийдіть і приєднайтесь знову за новим запрошенням.', 'err.denied': 'Сповіщення заблоковані. Дозвольте їх у налаштуваннях браузера чи телефону.', 'err.vapid': 'На сервері ще не налаштовані ключі пуш-сповіщень.', 'err.backup': 'Цей файл — не копія Plant Care.',
  noNotifications: 'Цей браузер не підтримує сповіщення. Скористайтесь експортом у календар нижче.', notifyMe: 'Нагадувати', remindAt: 'Нагадувати о', remindAtHint: 'Місцевий час доби', testReminder: 'Надіслати тестове нагадування',
  iosInstall: 'На iPhone додайте застосунок на Початковий екран (Поділитися → На початковий екран), щоб отримувати нагадування.', localOnly: 'Нагадування приходять, поки застосунок відкритий. Приєднайтесь до спільного доступу, щоб отримувати їх і коли він закритий.',
  'tab.today': 'Сьогодні', 'tab.plants': 'Рослини', 'tab.calendar': 'Календар', 'tab.guide': 'Довідник', 'tab.settings': 'Налаштування',
  undo: 'Скасувати', close: 'Закрити', all: 'Усі', add: 'Додати', save: 'Зберегти', delete: 'Видалити', edit: 'Змінити', name: 'Назва', emoji: 'Емодзі', note: 'Нотатка', date: 'Дата', plant: 'Рослина', search: 'Пошук…',
  today: 'сьогодні', yesterday: 'вчора', ago: '{d} тому', allYear: 'Увесь рік', allPlants: 'Усі рослини', notSet: 'Не вказано', auto: 'Автоматично', inFuture: 'у майбутньому',
  last: 'Востаннє: {when}', lastSkipped: 'Пропущено {when}', never: 'Ще не робили', done: 'Позначити виконаним',
  'sec.overdue': 'Прострочено', 'sec.today': 'Сьогодні', 'sec.soon': 'Незабаром', 'sec.later': 'Пізніше цього місяця',
  attention: 'Потребують уваги: {n}', allGood: 'Усе зроблено 🌿',
  noPlants: 'Ще немає рослин', noPlantsText: 'Додайте першу рослину — оберіть вид, і типовий догляд з’явиться одразу.', addPlant: 'Додати рослину', editPlant: 'Редагувати рослину',
  noTasks: 'Ще немає розкладу', noTasksText: 'Полив, підживлення, огляд на шкідників — усе, що повторюється.', openRoutines: 'Налаштувати розклад',
  doneOn: 'Зроблено', nextDue: 'Наступного разу', nextDueHint: 'Необов’язково, напр. повторити через 5 днів', notePlaceholder: 'Чим обробляли, як виглядає…', markDone: 'Зроблено', skip: 'Пропустити', recent: 'Нещодавно',
  pickDate: 'Оберіть дату', tomorrow: 'Завтра', weekAgo: 'Тиждень тому', inWeek: 'Через тиждень', inMonth: 'Через місяць', in3Months: 'Через 3 місяці', clear: 'Очистити',
  'due.overdue': 'Прострочено на {d}', 'due.today': 'Сьогодні', 'due.tomorrow': 'Завтра', 'due.in': 'Через {d}',
  every1: 'кожен {u}', every: 'кожні {x}',
  'u.day': 'день', 'u.week': 'тиждень', 'u.month': 'місяць', 'u.year': 'рік',
  'units.day': 'днів', 'units.week': 'тижнів', 'units.month': 'місяців', 'units.year': 'років',
  'n.day.one': '{n} день', 'n.day.few': '{n} дні', 'n.day.many': '{n} днів', 'n.day.other': '{n} дня',
  'n.week.one': '{n} тиждень', 'n.week.few': '{n} тижні', 'n.week.many': '{n} тижнів', 'n.week.other': '{n} тижня',
  'n.month.one': '{n} місяць', 'n.month.few': '{n} місяці', 'n.month.many': '{n} місяців', 'n.month.other': '{n} місяця',
  'n.year.one': '{n} рік', 'n.year.few': '{n} роки', 'n.year.many': '{n} років', 'n.year.other': '{n} року',
  times: '{n} р.',
  'plants.sub': 'Ваша колекція', 'routines.sub': 'Що повторюється і як часто', 'plants.seg': 'Рослини', 'routines.seg': 'Розклад',
  species: 'Вид', otherPlant: 'Інша / немає в довіднику', plantNamePlaceholder: 'напр. Монті', place: 'Місце', placePlaceholder: 'Підвіконня на кухні', plantedOn: 'Дата посадки', origin: 'Походження', color: 'Колір',
  'origin.seed': 'З насіння', 'origin.cutting': 'Живець', 'origin.bought': 'Куплена', 'origin.gift': 'Подарунок',
  addCareToo: 'Додати полив і підживлення для цього виду', deletePlantConfirm: 'Видалити {name} разом з усією історією?',
  timeline: 'Історія росту', afterPlanting: 'через {d} дн. після посадки', plantRoutines: 'Розклад', noRoutinesForPlant: 'Для цієї рослини ще немає розкладу.', addCare: 'Додати полив і підживлення для цього виду',
  addEvent: 'Додати подію', editEvent: 'Змінити подію', whatHappened: 'Що сталося', eventNotePlaceholder: 'напр. друга квітконіжка',
  'kind.plant': 'Посадка', 'kind.sprout': 'Сходи', 'kind.bud': 'Бутони', 'kind.bloom': 'Цвітіння', 'kind.bloomEnd': 'Кінець цвітіння', 'kind.harvest': 'Збір врожаю',
  addRoutine: 'Додати до розкладу', editRoutine: 'Редагувати розклад', kind: 'Тип', 'group.care': 'Догляд', 'group.pest': 'Захист від шкідників', repeat: 'Повторювати кожні', remindBeforeLabel: 'Нагадати (за скільки днів)',
  limit: 'Кількість разів', limitHint: '0 = без кінця', forPlants: 'Рослини', forPlantsHint: 'Нічого не обрано = усі рослини', months: 'Активні місяці', monthsHint: 'Нічого не обрано = увесь рік', startDate: 'Перша дата', startDateHint: 'Порожньо — почати сьогодні',
  paused: 'Призупинено', deleteRoutineConfirm: 'Видалити цей пункт розкладу разом з історією?',
  'preset.water': 'Полив', 'preset.water-summer': 'Полив (літній)', 'preset.water-winter': 'Полив (зимовий)', 'preset.feed': 'Підживлення', 'preset.mist': 'Обприскування', 'preset.rotate': 'Повернути горщик',
  'preset.wipe': 'Протерти листя', 'preset.repot': 'Пересадка', 'preset.check': 'Огляд на шкідників', 'preset.shower': 'Душ для листя', 'preset.mite': 'Вологість / профілактика кліща', 'preset.bio': 'Профілактична біообробка', 'preset.traps': 'Нові клейкі пастки',
  'presetHint.check': 'дивіться під листям, раз на 2 тижні', 'presetHint.shower': 'змити пил і перших шкідників, раз на місяць', 'presetHint.mite': 'опалювальний сезон, жовт–квіт', 'presetHint.bio': 'навесні й восени, бер–жовт', 'presetHint.traps': 'жовті й сині, раз на місяць',
  careInfo: 'Типовий догляд', 'info.light': 'Світло', 'info.water': 'Полив', 'info.feed': 'Підживлення', 'info.humidity': 'Вологість повітря', 'info.temp': 'Температура', 'info.repot': 'Пересадка', 'info.bloom': 'Цвіте', 'info.pets': 'Коти та собаки',
  'info.waterVal': 'кожні {s} дн. (літо) · {w} дн. (зима)', 'info.feedVal': 'кожні {d} дн. з квітня по вересень', 'info.noFeed': 'не потрібне', 'info.repotVal': 'раз на {n} р.', 'pets.toxic': '⚠️ Токсична, якщо погризти', 'pets.safe': 'Вважається безпечною',
  'light.shade': 'Витримує тінь', 'light.part': 'Розсіяне світло / напівтінь', 'light.bright': 'Яскраве, без прямого полуденного сонця', 'light.sun': 'Повне сонце',
  'humidity.low': 'Низька', 'humidity.medium': 'Середня', 'humidity.high': 'Висока',
  'info.disclaimer': 'Типові стартові значення: підлаштуйте під розмір горщика, світло та кімнату.',
  'guide.sub': 'Догляд, шкідники та сезонний план', 'guide.pests': 'Шкідники', 'guide.season': 'По місяцях', 'guide.plants': 'Рослини', addThisPlant: 'Додати до моїх рослин',
  pestPlan: 'План захисту від шкідників', pestPlanText: 'Схема, якої дотримується більшість: часто оглядати, мити листя, зволожувати в опалювальний сезон, раз навесні та раз восени — біологічна обробка.', addPestPlan: 'Додати план для всіх рослин', planAdded: 'План захисту додано', addPlantFirst: 'Спершу додайте рослину.',
  nowInSeason: 'Чого остерігатись у {m}', commonPests: 'Поширені шкідники та хвороби', mostCommon: 'Найчастіше', pestDisclaimer: 'Дотримуйтесь інструкції на упаковці, обробляйте в провітрюваному місці й тримайте оброблені рослини подалі від тварин і дітей. Нові рослини тримайте окремо 2 тижні.',
  'pest.signs': 'Як виглядає', 'pest.what': 'Що робити', 'pest.product': 'Засоби', 'pest.course': 'Обробіть {n} р. з інтервалом {d} дн. — між обробками виходять нові личинки.',
  scheduleTreatment: 'Запланувати курс обробки', whichPlants: 'Які рослини', firstTreatment: 'Перша обробка', createCourse: 'Створити курс ({n} × кожні {d} дн.)', treatment: 'Обробка', treatmentAdded: 'Курс обробки заплановано',
  seasonTitle: 'Рік кімнатних рослин', seasonText: 'Що робити щомісяця в типовій українській квартирі та яких шкідників чекати.', thisMonth: 'зараз',
  'calendar.sub': 'Посадка, ріст і догляд в одному місці', 'cal.done': 'виконано', 'cal.due': 'заплановано', 'cal.empty': 'У цей день нічого немає.', 'cal.planned': 'заплановано',
  appearance: 'Вигляд', language: 'Мова', theme: 'Тема', 'theme.auto': 'Авто', 'theme.light': 'Світла', 'theme.dark': 'Темна', accent: 'Акцентний колір',
  reminders: 'Нагадування', icsHint: 'Календарні події, що повторюються, зі сповіщеннями. Працюють і без сповіщень застосунку. Після запізнілого виконання експортуйте знову.', exportIcs: 'Додати в календар (.ics)',
  data: 'Ваші дані', exportJson: 'Експорт копії', importJson: 'Імпорт копії', imported: 'Копію імпортовано', privacy: 'Дані зберігаються на цьому пристрої. Синхронізація зашифрована.',
};

const DICTS: Record<Lang, Dict> = { en, uk };

/** The language the interface is showing; screens that call `t` re-render when it changes. */
export const lang = signal<Lang>('en');

export function translate(l: Lang, key: string, params?: Record<string, string>): string {
  const s = DICTS[l][key] ?? en[key] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? `{${k}}`) : s;
}

export const t = (key: string, params?: Record<string, string>) => translate(lang.value, key, params);

/** A routine still carrying a preset's stock name is shown in the current language; renamed ones are left alone. */
export function taskName(l: Lang, name: string): string {
  for (const k of Object.keys(en)) {
    if (k.startsWith('preset.') && (name === en[k] || name === uk[k])) return DICTS[l][k];
  }
  return name;
}

/** "3 days" / "3 дні": picks the plural form of `key` for this language and number. */
export function pluralize(l: Lang, key: string, n: number): string {
  const form = new Intl.PluralRules(l === 'uk' ? 'uk' : 'en').select(n);
  const s = DICTS[l][`${key}.${form}`] ?? DICTS[l][`${key}.other`] ?? en[`${key}.other`];
  return s.replace('{n}', String(n));
}

export const DICTIONARIES = { en, uk };
