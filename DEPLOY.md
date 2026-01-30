# Инструкция по деплою

## Автоматический деплой PartyKit через GitHub Actions

### Шаг 1: Получение токена PartyKit

Выполни на своем компьютере (локально):

```bash
npx partykit login
npx partykit token
```

Скопируй полученный токен (выглядит примерно так: `pk_xxxxxxxxxxxxx`)

### Шаг 2: Добавление токена в GitHub Secrets

1. Зайди на GitHub в репозиторий: https://github.com/IvanchikIvanov/DarkForest-DeathMatch
2. Нажми **Settings** (вверху репозитория)
3. В левом меню выбери **Secrets and variables** → **Actions**
4. Нажми **New repository secret**
5. **Name:** `PARTYKIT_AUTH_TOKEN`
6. **Secret:** вставь токен из шага 1
7. Нажми **Add secret**

### Шаг 3: Первый деплой

После добавления токена, GitHub Actions автоматически задеплоит PartyKit при изменении файлов в `party/` или `partykit.json`.

Или запусти вручную:
1. Зайди в **Actions** в репозитории
2. Выбери workflow **Deploy PartyKit Server**
3. Нажми **Run workflow** → **Run workflow**

### Шаг 4: Получение URL PartyKit сервера

**Вариант А: Автоматический деплой через GitHub Actions**
После успешного деплоя:
1. Зайди в **Actions** → последний запуск workflow
2. В логах найди строку вида: `✓ Deployed to https://duel-arena.username.partykit.dev`
3. Скопируй URL (только домен, без `https://`)

**Вариант Б: Ручной деплой (рекомендуется)**
```bash
npx partykit login
npx partykit deploy
```

После деплоя получишь URL вида: `duel-arena.karolinaviktorovna.partykit.dev`

**Текущий URL:** `duel-arena.karolinaviktorovna.partykit.dev`

### Шаг 5: Настройка Vercel

1. Зайди на [vercel.com](https://vercel.com)
2. Подключи репозиторий `IvanchikIvanov/DarkForest-DeathMatch`
3. В настройках проекта → **Environment Variables**:
   - **Name:** `VITE_PARTYKIT_HOST`
   - **Value:** `duel-arena.username.partykit.dev` (URL из шага 4, БЕЗ `https://`)
   - Выбери все окружения (Production, Preview, Development)
4. Нажми **Deploy**

---

## Ручной деплой PartyKit (альтернатива)

Если не хочешь использовать GitHub Actions, можешь деплоить вручную:

```bash
# На своем компьютере или на сервере
npx partykit login
npm run party:deploy
```

После деплоя получишь URL, который нужно добавить в Vercel как `VITE_PARTYKIT_HOST`.

---

## Проверка работы

После деплоя:
1. Открой задеплоенное приложение на Vercel
2. Открой консоль браузера (F12)
3. Должно быть: `[PartyClient] Using PartyKit host from env: duel-arena.username.partykit.dev`
4. Если видишь `localhost:1999` - переменная окружения не настроена

