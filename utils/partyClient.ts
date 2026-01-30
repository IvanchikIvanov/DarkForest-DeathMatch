import PartySocket from "partysocket";

// PartyKit host configuration:
// - In production: set VITE_PARTYKIT_HOST to your deployed PartyKit URL (e.g., "duel-arena.username.partykit.dev")
// - In development: falls back to localhost:1999
const getPartyKitHost = (): string => {
  // Check window override first (for runtime config)
  if (typeof window !== 'undefined' && (window as any).__PARTYKIT_HOST__) {
    const host = (window as any).__PARTYKIT_HOST__;
    console.log('[PartyClient] Using PartyKit host from window override:', host);
    return host;
  }
  
  // Check Vite env variable
  const envHost = import.meta.env.VITE_PARTYKIT_HOST;
  if (envHost && envHost.trim() !== '' && envHost !== 'localhost:1999') {
    console.log('[PartyClient] Using PartyKit host from env:', envHost);
    return envHost.trim();
  }
  
  // Fallback to localhost for dev
  console.log('[PartyClient] Using localhost (dev mode)');
  return "localhost:1999";
};

const PARTYKIT_HOST = getPartyKitHost();

export interface PartyClientCallbacks {
    onStateUpdate: (state: any, hostId: string | null) => void;
    onConnect: (playerId: string, isHost: boolean) => void;
    onClose: () => void;
    onError: (error: Event) => void;
}

export class PartyClient {
    private socket: PartySocket | null = null;
    private callbacks: PartyClientCallbacks;
    private roomId: string = '';
    private playerId: string = '';
    private isHost: boolean = false;

    constructor(callbacks: PartyClientCallbacks) {
        this.callbacks = callbacks;
    }

    // Create or join a room
    connect(roomId: string): void {
        this.roomId = roomId;

        // Close existing connection if any
        if (this.socket) {
            this.socket.close();
        }

        console.log(`[PartyClient] Connecting to room: ${roomId} on host: ${PARTYKIT_HOST}`);

        this.socket = new PartySocket({
            host: PARTYKIT_HOST,
            room: roomId,
            party: "main",
        });

        this.socket.addEventListener('open', () => {
            console.log('[PartyClient] Connected to PartyKit server');
        });

        this.socket.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'STATE') {
                    // First message contains yourId
                    if (data.yourId && !this.playerId) {
                        this.playerId = data.yourId;
                        this.isHost = data.isHost || false;
                        console.log(`[PartyClient] Assigned ID: ${this.playerId}, isHost: ${this.isHost}`);
                        this.callbacks.onConnect(this.playerId, this.isHost);
                    }

                    // Update host status from broadcast
                    if (data.hostId) {
                        this.isHost = data.hostId === this.playerId;
                    }

                    this.callbacks.onStateUpdate(data.payload, data.hostId);
                }
            } catch (e) {
                console.error('[PartyClient] Error parsing message:', e);
            }
        });

        this.socket.addEventListener('close', () => {
            console.log('[PartyClient] Disconnected');
            this.callbacks.onClose();
        });

        this.socket.addEventListener('error', (error) => {
            console.error('[PartyClient] Error:', error);
            this.callbacks.onError(error);
        });
    }

    // Send player input
    sendInput(input: { keys: string[], mouse: { x: number, y: number }, mouseDown: boolean, mouseRightDown: boolean, throwBomb: boolean }): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        this.socket.send(JSON.stringify({
            type: 'INPUT',
            playerId: this.playerId,
            payload: input
        }));
    }

    // Start the game (host only)
    startGame(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        this.socket.send(JSON.stringify({
            type: 'START'
        }));
    }

    // Reset the game (host only)
    resetGame(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        this.socket.send(JSON.stringify({
            type: 'RESET'
        }));
    }

    // Disconnect
    disconnect(): void {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.playerId = '';
        this.isHost = false;
    }

    // Getters
    getPlayerId(): string {
        return this.playerId;
    }

    getIsHost(): boolean {
        return this.isHost;
    }

    getRoomId(): string {
        return this.roomId;
    }

    isConnected(): boolean {
        return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
    }
}

// Generate a random room ID
export const generateRoomId = (): string => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};
