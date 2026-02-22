import type * as Party from "partykit/server";

// Room info stored in lobby
interface RoomInfo {
  roomId: string;
  betAmount: number; // in wei as string-safe number
  betDisplay: string; // e.g. "0.001 ETH"
  creatorName: string;
  playerCount: number;
  createdAt: number;
  contractRoomId?: number; // on-chain room ID from smart contract
}

export default class LobbyRoom implements Party.Server {
  rooms: Map<string, RoomInfo> = new Map();

  constructor(readonly room: Party.Room) {}

  // When a client connects, send them the current room list
  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({
      type: 'ROOMS_LIST',
      rooms: Array.from(this.rooms.values()),
    }));
  }

  // Handle messages from clients or game rooms
  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'REGISTER_ROOM': {
          // Game room creator registers a new open room
          const info: RoomInfo = {
            roomId: data.roomId,
            betAmount: data.betAmount,
            betDisplay: data.betDisplay || '0 ETH',
            creatorName: data.creatorName || 'Anonymous',
            playerCount: 1,
            createdAt: Date.now(),
            contractRoomId: data.contractRoomId,
          };
          this.rooms.set(data.roomId, info);
          this.broadcastRooms();
          break;
        }

        case 'ROOM_FULL': {
          // Game room is full (2 players) — remove from lobby
          this.rooms.delete(data.roomId);
          this.broadcastRooms();
          break;
        }

        case 'ROOM_CLOSED': {
          // Game room closed (player left, game over)
          this.rooms.delete(data.roomId);
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
            const info: RoomInfo = {
              roomId: data.roomId,
              betAmount: data.betAmount,
              betDisplay: data.betDisplay || '0 ETH',
              creatorName: data.creatorName || 'Anonymous',
              playerCount: 1,
              createdAt: Date.now(),
              contractRoomId: data.contractRoomId,
            };
            this.rooms.set(data.roomId, info);
            this.broadcastRooms();
            return new Response('OK', { status: 200 });
          }

          case 'ROOM_FULL': {
            this.rooms.delete(data.roomId);
            this.broadcastRooms();
            return new Response('OK', { status: 200 });
          }

          case 'ROOM_CLOSED': {
            this.rooms.delete(data.roomId);
            this.broadcastRooms();
            return new Response('OK', { status: 200 });
          }
        }
      } catch (e) {
        console.error('[LOBBY] Error handling request:', e);
      }
    }

    // GET returns current room list (for bot API)
    if (req.method === 'GET') {
      return new Response(JSON.stringify({
        rooms: Array.from(this.rooms.values()),
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  onClose(conn: Party.Connection) {
    // Client disconnected from lobby — no action needed
  }

  broadcastRooms() {
    const msg = JSON.stringify({
      type: 'ROOMS_LIST',
      rooms: Array.from(this.rooms.values()),
    });
    for (const conn of this.room.getConnections()) {
      conn.send(msg);
    }
  }
}
