import { InterACTWebSocket } from './websocket';
import { EventType } from '../types/events';

export type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended' | 'error';

export interface WebRTCCallback {
  onRemoteStream: (stream: MediaStream) => void;
  onCallStateChange: (state: CallState, error?: string) => void;
}

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private isMuted: boolean = false;
  private callbacks: WebRTCCallback | null = null;
  private pendingOffer: any = null;

  private iceConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  public init(callbacks: WebRTCCallback) {
    this.callbacks = callbacks;
  }

  /**
   * Start an outgoing call (caller side)
   */
  public async startCall(ws: InterACTWebSocket): Promise<void> {
    try {
      this.callbacks?.onCallStateChange('calling');

      // 1. Get user microphone stream (requires user gesture)
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      // 2. Initialize PeerConnection
      this.setupPeerConnection(ws);

      // 3. Add local audio tracks
      if (this.pc && this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          this.pc!.addTrack(track, this.localStream!);
        });
      }

      // 4. Create and send SDP Offer
      const offer = await this.pc!.createOffer({
        offerToReceiveAudio: true
      });
      await this.pc!.setLocalDescription(offer);

      ws.sendEvent(EventType.RTC_SIGNAL, {
        type: 'offer',
        sdp: offer
      });
    } catch (err: any) {
      console.error('[WebRTC] startCall failed:', err);
      this.callbacks?.onCallStateChange('error', err.message || 'Microphone access denied or WebRTC error');
    }
  }

  /**
   * Accept an incoming call (callee side, triggered by user click gesture)
   */
  public async acceptIncomingCall(ws: InterACTWebSocket): Promise<void> {
    if (!this.pendingOffer) {
      console.warn('[WebRTC] No pending offer to accept');
      return;
    }

    try {
      this.callbacks?.onCallStateChange('calling');

      // 1. Request microphone in user click gesture
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      } catch (e: any) {
        console.warn('[WebRTC] Microphone permission denied for incoming call, continuing in receive-only mode:', e);
      }

      // 2. Setup PeerConnection
      this.setupPeerConnection(ws);

      // 3. Add local audio tracks
      if (this.localStream && this.pc) {
        this.localStream.getAudioTracks().forEach((track) => {
          this.pc!.addTrack(track, this.localStream!);
        });
      }

      // 4. Apply remote offer and create answer
      await this.pc!.setRemoteDescription(new RTCSessionDescription(this.pendingOffer.sdp));
      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);

      // 5. Send SDP Answer back to caller
      ws.sendEvent(EventType.RTC_SIGNAL, {
        type: 'answer',
        sdp: answer
      });

      this.pendingOffer = null;
      this.callbacks?.onCallStateChange('connected');
    } catch (err: any) {
      console.error('[WebRTC] acceptIncomingCall failed:', err);
      this.callbacks?.onCallStateChange('error', err.message || 'Failed to answer call');
    }
  }

  /**
   * Decline an incoming call
   */
  public declineCall(ws: InterACTWebSocket) {
    this.pendingOffer = null;
    this.endCall(true, ws);
  }

  /**
   * Handle incoming WebRTC signaling events from peer
   */
  public async handleSignal(signal: any, ws: InterACTWebSocket): Promise<void> {
    if (!signal || !signal.type) return;

    try {
      if (signal.type === 'offer') {
        // Save pending offer and notify UI of incoming call
        this.pendingOffer = signal;
        this.callbacks?.onCallStateChange('incoming');
      } else if (signal.type === 'answer') {
        if (this.pc) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          this.callbacks?.onCallStateChange('connected');
        }
      } else if (signal.type === 'ice_candidate') {
        if (this.pc && signal.candidate) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            console.warn('[WebRTC] Error adding ICE candidate:', e);
          }
        }
      } else if (signal.type === 'end_call') {
        this.endCall(false);
      }
    } catch (err: any) {
      console.error('[WebRTC] handleSignal error:', err);
    }
  }

  private setupPeerConnection(ws: InterACTWebSocket) {
    if (this.pc) {
      this.pc.close();
    }

    const pc = new RTCPeerConnection(this.iceConfig);
    this.pc = pc;

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && ws.isConnected()) {
        ws.sendEvent(EventType.RTC_SIGNAL, {
          type: 'ice_candidate',
          candidate: event.candidate
        });
      }
    };

    // Receive remote audio track
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.callbacks?.onRemoteStream(event.streams[0]);
        this.callbacks?.onCallStateChange('connected');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.callbacks?.onCallStateChange('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.callbacks?.onCallStateChange('ended');
      }
    };
  }

  public toggleMute(): boolean {
    if (!this.localStream) return false;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });
    return this.isMuted;
  }

  public endCall(notifyPeer: boolean = true, ws?: InterACTWebSocket): void {
    if (notifyPeer && ws && ws.isConnected()) {
      ws.sendEvent(EventType.RTC_SIGNAL, { type: 'end_call' });
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.pendingOffer = null;
    this.callbacks?.onCallStateChange('idle');
  }
}
