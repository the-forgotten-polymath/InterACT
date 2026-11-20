export interface SpeakOptions {
  language?: string;
  voice?: string;
  audioUrl?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export interface ListenOptions {
  language?: string;
  onInterim?: (interimText: string) => void;
  onFinal: (finalText: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export class SpeechService {
  private static activeRecognition: any = null;
  private static activeAudio: HTMLAudioElement | null = null;

  public static isSpeechSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public static isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  /**
   * Speak text aloud using Mithi v2 Flash audio if available, or SpeechSynthesis
   */
  public static async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    // 1. Stop any current audio or speech
    this.stop();

    // 2. If a direct audioUrl is provided, play it
    if (options.audioUrl) {
      try {
        const audio = new Audio(options.audioUrl);
        this.activeAudio = audio;
        audio.onplay = () => options.onStart?.();
        audio.onended = () => {
          this.activeAudio = null;
          options.onEnd?.();
        };
        audio.onerror = (e) => {
          console.warn('[InterACT Speech] AudioUrl play failed, falling back to Web Speech', e);
          this.speakNative(text, options);
        };
        await audio.play();
        return;
      } catch (err) {
        console.warn('[InterACT Speech] Audio play error, fallback to Web Speech:', err);
      }
    }

    // 3. Try synthesizing with backend Mithi v2 Flash endpoint
    try {
      const lang = options.language || 'en';
      const voice = options.voice || 'ahana';

      const res = await fetch('/api/v1/speech/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: lang.split('-')[0],
          voice
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio_url) {
          const audio = new Audio(data.audio_url);
          this.activeAudio = audio;
          audio.onplay = () => options.onStart?.();
          audio.onended = () => {
            this.activeAudio = null;
            options.onEnd?.();
          };
          audio.onerror = () => this.speakNative(text, options);
          await audio.play();
          return;
        }
      }
    } catch (e) {
      // Backend unavailable or network offline, proceed to native synthesis
    }

    // 4. Native browser speech synthesis fallback
    this.speakNative(text, options);
  }

  private static speakNative(text: string, options: SpeakOptions = {}): void {
    if (!this.isSpeechSynthesisSupported()) {
      options.onError?.('SpeechSynthesis not supported');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate ?? 1.0;
      utterance.pitch = options.pitch ?? 1.0;

      const lang = options.language || 'en-US';
      utterance.lang = lang;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const matchingVoice =
          voices.find((v) => v.lang === lang) ||
          voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ||
          voices[0];
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }

      utterance.onstart = () => options.onStart?.();
      utterance.onend = () => options.onEnd?.();
      utterance.onerror = (e) => options.onError?.(e);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      options.onError?.(err);
    }
  }

  /**
   * Stop any active audio or speech
   */
  public static stop(): void {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.currentTime = 0;
      this.activeAudio = null;
    }
    if (this.isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  public static isSpeaking(): boolean {
    return (
      (this.activeAudio !== null && !this.activeAudio.paused) ||
      (this.isSpeechSynthesisSupported() && window.speechSynthesis.speaking)
    );
  }

  /**
   * Listen to microphone and transcribe speech
   */
  public static startListening(options: ListenOptions): void {
    if (!this.isSpeechRecognitionSupported()) {
      options.onError?.('SpeechRecognition not supported in this browser');
      return;
    }

    try {
      this.stopListening();

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = options.language || 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        if (interimTranscript && options.onInterim) {
          options.onInterim(interimTranscript);
        }

        if (finalTranscript) {
          options.onFinal(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        options.onError?.(event.error);
      };

      recognition.onend = () => {
        this.activeRecognition = null;
        options.onEnd?.();
      };

      recognition.start();
      this.activeRecognition = recognition;
    } catch (err: any) {
      options.onError?.(err.message || 'Failed to start microphone');
    }
  }

  public static stopListening(): void {
    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch (e) {
        // Ignore stop error
      }
      this.activeRecognition = null;
    }
  }
}
