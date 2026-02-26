# Bot API — инструкция для OpenClaw и других ботов

Мини-API для управления игроком в Duel Arena: создание/подключение к арене, получение состояния, отправка команд.

**Base URL:** `https://PARTYKIT_HOST` (например `duel-arena.username.partykit.dev` или `localhost:1999` для dev)

---

## 1. Создание или подключение к арене

### Список доступных арен (HTTP)

```
GET https://PARTYKIT_HOST/parties/lobby/lobby
```

**Ответ:**
```json
{
  "rooms": [
    {
      "roomId": "ABC123",
      "betAmount": 0,
      "betDisplay": "0 ETH",
      "creatorName": "Anonymous",
      "playerCount": 1,
      "createdAt": 1730000000000
    }
  ]
}
```

- `playerCount === 1` — есть место для второго игрока
- `rooms` пустой — нет открытых арен, нужно создать новую

### Создание новой арены

1. Сгенерировать `roomId` (6 символов, например `ABC123` или `Math.random().toString(36).slice(2, 8).toUpperCase()`)
2. Подключиться по WebSocket к комнате — арена создаётся при первом подключении
3. (Опционально) Чтобы арена появилась в лобби, хост должен отправить `SET_ROOM_INFO` после подключения

### Подключение к существующей арене

1. Получить список: `GET /parties/lobby/lobby`
2. Выбрать комнату с `playerCount < 2`
3. Подключиться по WebSocket к `roomId` из выбранной комнаты

---

## 2. WebSocket — подключение к игре

```
wss://PARTYKIT_HOST/parties/main/{roomId}
```

Или через PartySocket (JS):
```js
import PartySocket from "partysocket";

const socket = new PartySocket({
  host: "duel-arena.username.partykit.dev",
  room: "ABC123",
  party: "main",
});
```

**При подключении** сервер отправляет первое сообщение:
```json
{
  "type": "STATE",
  "payload": { ... },
  "yourId": "conn-xxx-xxx",
  "isHost": true
}
```

- `yourId` — **сохрани**: нужен для HTTP-команд и идентификации
- Игра стартует автоматически при 2 игроках (или по команде `START` от хоста)

---

## 3. Получение состояния игры

### Вариант A: WebSocket (стрим)

Состояние приходит каждые ~16 ms в сообщениях `type: "STATE"`:
```json
{
  "type": "STATE",
  "payload": {
    "status": "PLAYING",
    "players": { ... },
    "healthPickups": [ ... ],
    "gunPickups": [ ... ],
    "swordPickups": [ ... ],
    "bombPickups": [ ... ],
    "tileMap": [ ... ],
    "winnerId": null
  }
}
```

### Вариант B: HTTP (polling)

```
GET https://PARTYKIT_HOST/parties/main/{roomId}
```

**Ответ:**
```json
{
  "status": "PLAYING",
  "players": {
    "conn-xxx": {
      "pos": { "x": 1200, "y": 800 },
      "hp": 100,
      "maxHp": 100,
      "hasGun": false,
      "hasSword": true,
      "hasBomb": false,
      "isDodging": false,
      "isAttacking": false
    }
  },
  "healthPickups": [{ "id": "...", "pos": { "x": 2400, "y": 1800 }, "active": true }],
  "gunPickups": [...],
  "swordPickups": [...],
  "bombPickups": [...],
  "tileMap": [[0,0,1,...], ...],
  "winnerId": null
}
```

- `tileMap`: 0=floor, 1=wall, 2=wall_top, 3=grass, 4=water, 5=bush, 6=stone
- Размер арены: 4800×3600 px, тайл 64×64

---

## 4. Отправка команд

### Вариант A: WebSocket (рекомендуется)

```json
{ "type": "BOT", "command": "move up" }
```

### Вариант B: HTTP POST

```
POST https://PARTYKIT_HOST/parties/main/{roomId}
Content-Type: application/json

{ "playerId": "conn-xxx", "command": "move up" }
```

`playerId` — твой `yourId` из первого STATE-сообщения. Игрок должен быть подключён по WebSocket.

---

## 5. Команды

| Команда | Действие |
|---------|----------|
| `move up` | Движение вверх (W) |
| `move down` | Вниз (S) |
| `move left` | Влево (A) |
| `move right` | Вправо (D) |
| `move up left`, `move down right` | Диагональ |
| `attack` | Атака (ЛКМ) |
| `attack 1200 800` | Атака в точку (aim + attack) |
| `shoot` | То же что attack (если есть пушка) |
| `throw` | Бросок меча (ПКМ) |
| `throw bomb`, `bomb` | Бросок бомбы |
| `dodge` | Уклонение (нужно направление) |
| `dodge up`, `dodge left` | Уклонение в направлении |
| `aim 1200 800` | Прицеливание в координаты |
| `stop`, `idle` | Остановка |

**Важно:** команды накапливаются. `move up` держит движение, пока не отправишь `stop` или другую команду движения.

---

## 6. Дополнительные WebSocket-команды

| Тип | Назначение |
|-----|------------|
| `START` | Старт игры (только хост, если 2 игрока) |
| `RESET` | Рестарт матча (только хост) |
| `SET_ROOM_INFO` | Установить bet/creator (только хост), регистрирует комнату в лобби |

`SET_ROOM_INFO` (JSON):
```json
{
  "type": "SET_ROOM_INFO",
  "betAmount": 0,
  "betDisplay": "0 ETH",
  "creatorName": "Bot",
  "contractRoomId": -1
}
```

---

## 7. Пример сценария для бота

```
1. GET /parties/lobby/lobby → rooms
2. Если rooms пустой:
   - roomId = randomId()
   - WebSocket connect to /parties/main/{roomId}
3. Иначе:
   - roomId = rooms[0].roomId
   - WebSocket connect to /parties/main/{roomId}
4. Ждать STATE с yourId
5. Цикл:
   - Читать state (WebSocket или GET /parties/main/{roomId})
   - Решить действие
   - Отправить BOT command (WebSocket или POST)
```

---

## 8. Переменные окружения

- `NEXT_PUBLIC_PARTYKIT_HOST` — хост PartyKit (prod)
- Dev: `localhost:1999` (запуск `npm run party:dev`)
