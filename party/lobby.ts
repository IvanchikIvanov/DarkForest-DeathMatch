import type * as Party from "partykit/server";

// Room info stored in lobby
interface RoomInfo {
  roomId: string;
  creatorName: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  gameMode?: 'deathmatch' | 'ctf';
}

export default class LobbyRoom implements Party.Server {
  rooms: Map<string, RoomInfo> = new Map();

  constructor(readonly room: Party.Room) {}

  async onStart() {
    const stored = await this.room.storage.get<[string, RoomInfo][]>("rooms");
    if (stored) this.rooms = new Map(stored);
  }

  private async persistRooms() {
    await this.room.storage.put("rooms", Array.from(this.rooms.entries()));
  }

  onConnect(conn: Party.Connection) {
    const rooms = Array.from(this.rooms.values()).map(r => ({ ...r, maxPlayers: r.maxPlayers ?? 2 }));
    conn.send(JSON.stringify({ type: 'ROOMS_LIST', rooms }));
  }


  // Handle messages from clients or game rooms
  async onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'REGISTER_ROOM': {
          // Game room creator registers a new open room
          const info: RoomInfo = {
            roomId: data.roomId,
            creatorName: data.creatorName || 'Anonymous',
            playerCount: data.playerCount ?? 1,
            maxPlayers: data.maxPlayers ?? 2,
            createdAt: Date.now(),
            gameMode: data.gameMode === 'ctf' ? 'ctf' : 'deathmatch',
          };
          this.rooms.set(data.roomId, info);
          await this.persistRooms();
          this.broadcastRooms();
          break;
        }

        case 'UPDATE_PLAYER_COUNT': {
          const r = this.rooms.get(data.roomId);
          if (r) {
            r.playerCount = data.playerCount ?? r.playerCount;
            await this.persistRooms();
            this.broadcastRooms();
          }
          break;
        }

        case 'ROOM_FULL': {
          this.rooms.delete(data.roomId);
          await this.persistRooms();
          this.broadcastRooms();
          break;
        }

        case 'ROOM_CLOSED': {
          this.rooms.delete(data.roomId);
          await this.persistRooms();
          this.broadcastRooms();
          break;
        }

        case 'REFRESH': {
          // Client requests fresh list
          sender.send(JSON.stringify({
            type: 'ROOMS_LIST',
            rooms: Array.from(this.rooms.values()),
          }));
          break;
        }
      }
    } catch (e) {
      console.error('[LOBBY] Error parsing message:', e);
    }
  }

  // Handle HTTP requests from game party servers
  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === 'POST') {
      try {
        const data = await req.json() as any;

        switch (data.type) {
          case 'REGISTER_ROOM': {
            console.log('[LOBBY] REGISTER_ROOM received via HTTP, roomId=', data.roomId);
            const info: RoomInfo = {
              roomId: data.roomId,
              creatorName: data.creatorName || 'Anonymous',
              playerCount: data.playerCount ?? 1,
              maxPlayers: data.maxPlayers ?? 2,
              createdAt: Date.now(),
              gameMode: data.gameMode === 'ctf' ? 'ctf' : 'deathmatch',
            };
            this.rooms.set(data.roomId, info);
            await this.persistRooms();
            this.broadcastRooms();
            return new Response('OK', { status: 200 });
          }

          case 'UPDATE_PLAYER_COUNT': {
            const r = this.rooms.get(data.roomId);
            if (r) {
              r.playerCount = data.playerCount ?? r.playerCount;
              await this.persistRooms();
              this.broadcastRooms();
            }
            return new Response('OK', { status: 200 });
          }

          case 'ROOM_FULL': {
            this.rooms.delete(data.roomId);
            await this.persistRooms();
            this.broadcastRooms();
            return new Response('OK', { status: 200 });
          }

          case 'ROOM_CLOSED': {
            this.rooms.delete(data.roomId);
            await this.persistRooms();
            this.broadcastRooms();
            return new Response('OK', { status: 200 });
          }
        }
      } catch (e) {
        console.error('[LOBBY] Error handling request:', e);
      }
    }

    // GET returns current room list
    if (req.method === 'GET') {
      const rooms = Array.from(this.rooms.values()).map(r => ({ ...r, maxPlayers: r.maxPlayers ?? 2 }));
      return new Response(JSON.stringify({ rooms }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  onClose(conn: Party.Connection) {
    // Client disconnected from lobby — no action needed
  }

  broadcastRooms() {
    const rooms = Array.from(this.rooms.values()).map(r => ({ ...r, maxPlayers: r.maxPlayers ?? 2 }));
    const msg = JSON.stringify({ type: 'ROOMS_LIST', rooms });
    for (const conn of this.room.getConnections()) {
      conn.send(msg);
    }
  }
}
