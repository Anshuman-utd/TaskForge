import { RealtimeEvent } from "../types";

export type ConnectionState = "CONNECTED" | "RECONNECTING" | "DISCONNECTED";
export type MessageCallback = (event: RealtimeEvent) => void;
export type StateCallback = (state: ConnectionState) => void;


class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private state: ConnectionState = "DISCONNECTED";
  private messageListeners: Set<MessageCallback> = new Set();
  private stateListeners: Set<StateCallback> = new Set();
  private reconnectTimeout: any = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;

  constructor() {
    // Determine default WebSocket URL based on window location if in browser,
    // otherwise default to localhost:8000
    const defaultWsUrl = typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host.split(":")[0]}:8000/ws/dashboard`
      : "ws://localhost:8000/ws/dashboard";
      
    this.url = process.env.NEXT_PUBLIC_WS_URL || defaultWsUrl;
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.cleanup();
    
    try {
      this.ws = new WebSocket(this.url);
      this.updateState(this.reconnectAttempts > 0 ? "RECONNECTING" : "DISCONNECTED");

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.updateState("CONNECTED");
        console.log("WebSocket connected successfully to:", this.url);
      };

      this.ws.onmessage = (event) => {
        try {
          if (event.data === "pong") return; // Ignore keepalive pong
          const parsed = JSON.parse(event.data) as RealtimeEvent;
          this.notifyMessage(parsed);
        } catch (e) {
          console.error("Error parsing WebSocket message data:", e);
        }
      };

      this.ws.onclose = () => {
        this.updateState("DISCONNECTED");
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        this.ws?.close();
      };
    } catch (e) {
      console.error("WebSocket connection failure:", e);
      this.updateState("DISCONNECTED");
      this.scheduleReconnect();
    }
  }

  public send(msg: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    }
  }

  public subscribe(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  public subscribeState(callback: StateCallback): () => void {
    this.stateListeners.add(callback);
    callback(this.state); // Immediate initial notify
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  public getState(): ConnectionState {
    return this.state;
  }

  private updateState(newState: ConnectionState) {
    this.state = newState;
    this.stateListeners.forEach((listener) => listener(newState));
  }

  private notifyMessage(event: RealtimeEvent) {
    this.messageListeners.forEach((listener) => listener(event));
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    console.log(`Scheduling WebSocket reconnect in ${(delay / 1000).toFixed(1)} seconds...`);
    this.updateState("RECONNECTING");

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private cleanup() {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  public disconnect() {
    this.cleanup();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
    this.updateState("DISCONNECTED");
  }
}

export const wsClient = new WebSocketClient();
