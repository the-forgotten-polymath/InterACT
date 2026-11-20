import { EventType, InterACTEvent } from '../types/events';

type EventHandler<T = any> = (event: InterACTEvent<T>) => void;

export class InterACTWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 8;
  private pingInterval: any = null;
  private isIntentionallyClosed = false;

  public onConnectionStateChange?: (state: 'connecting' | 'connected' | 'disconnected') => void;

  constructor(url: string) {
    this.url = url;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public connect(): void {
    this.isIntentionallyClosed = false;
    this.onConnectionStateChange?.('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.onConnectionStateChange?.('connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: InterACTEvent = JSON.parse(event.data);
          this.dispatchEvent(data);
        } catch (err) {
          console.warn('[InterACT WS] Failed to parse message', err);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.onConnectionStateChange?.('disconnected');
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[InterACT WS] Error', err);
      };
    } catch (e) {
      this.onConnectionStateChange?.('disconnected');
      this.scheduleReconnect();
    }
  }

  public send<T = any>(eventType: EventType | string, payload: T = {} as T): void {
    if (!this.isConnected()) {
      console.warn('[InterACT WS] Cannot send, socket not open');
      return;
    }

    const eventObj = {
      event_type: eventType,
      timestamp: Date.now(),
      payload
    };

    try {
      this.ws!.send(JSON.stringify(eventObj));
    } catch (err) {
      console.error('[InterACT WS] send failed:', err);
    }
  }

  public sendEvent<T = any>(eventType: EventType | string, payload: T = {} as T): void {
    this.send(eventType, payload);
  }

  public sendActivity(activity: string): void {
    this.send(EventType.PARTICIPANT_ACTIVITY, { activity });
  }

  public on<T = any>(eventType: EventType | string | '*', handler: EventHandler<T>): void {
    const key = String(eventType);
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler);
  }

  public off<T = any>(eventType: EventType | string | '*', handler: EventHandler<T>): void {
    const key = String(eventType);
    const set = this.handlers.get(key);
    if (set) {
      set.delete(handler);
    }
  }

  private dispatchEvent(event: InterACTEvent): void {
    // Specific handlers
    const specific = this.handlers.get(event.event_type);
    specific?.forEach((h) => h(event));

    // Wildcard handlers
    const wildcard = this.handlers.get('*');
    wildcard?.forEach((h) => h(event));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.send('ping', {});
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[InterACT WS] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    console.log(`[InterACT WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (!this.isIntentionallyClosed) {
        this.connect();
      }
    }, delay);
  }

  public close(): void {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
