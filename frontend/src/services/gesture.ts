import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

export interface EnrolledGesture {
  id: string;
  name: string;
  phrase: string;
  emoji: string;
  isCustom?: boolean;
  vector?: number[]; // 63-element normalized feature vector
}

export interface MatchResult {
  gesture: EnrolledGesture;
  confidence: number;
}

// 6 Core Out-Of-The-Box Accessible Gesture Presets
export const DEFAULT_PRESET_GESTURES: EnrolledGesture[] = [
  {
    id: 'open_palm',
    name: 'Open Palm',
    phrase: 'Please wait a moment, I am preparing my response.',
    emoji: '✋'
  },
  {
    id: 'thumbs_up',
    name: 'Thumbs Up',
    phrase: 'Yes, I confirm.',
    emoji: '👍'
  },
  {
    id: 'thumbs_down',
    name: 'Thumbs Down',
    phrase: 'No, I disagree / that is incorrect.',
    emoji: '👎'
  },
  {
    id: 'pointing',
    name: 'Pointing Finger',
    phrase: 'There is an issue with my order.',
    emoji: '☝️'
  },
  {
    id: 'fist',
    name: 'Closed Fist',
    phrase: 'Please repeat what you said.',
    emoji: '✊'
  },
  {
    id: 'peace_v',
    name: 'Victory / V-Sign',
    phrase: 'Thank you for your help.',
    emoji: '✌️'
  }
];

export class GestureService {
  private static landmarker: HandLandmarker | null = null;
  private static isInitializing: boolean = false;
  private static customGesturesKey = 'interact_custom_gestures_v1';

  /**
   * Initialize MediaPipe HandLandmarker with WASM runtime
   */
  public static async initLandmarker(): Promise<HandLandmarker> {
    if (this.landmarker) return this.landmarker;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.landmarker) return this.landmarker;
    }

    this.isInitializing = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1
      });

      return this.landmarker;
    } catch (err) {
      console.warn('[GestureService] GPU delegate failed, falling back to CPU:', err);
      // Fallback to CPU delegate
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numHands: 1
      });
      return this.landmarker;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Normalize 21 3D landmarks into a 63-dimensional translation & scale invariant vector
   */
  public static normalizeLandmarks(landmarks: Landmark3D[]): number[] {
    if (!landmarks || landmarks.length !== 21) return [];

    const wrist = landmarks[0];
    const middleMcp = landmarks[9];

    // Reference scale: distance between wrist and middle finger MCP joint
    const scale = Math.sqrt(
      Math.pow(middleMcp.x - wrist.x, 2) +
      Math.pow(middleMcp.y - wrist.y, 2) +
      Math.pow(middleMcp.z - wrist.z, 2)
    ) || 1.0;

    const normalizedVector: number[] = [];
    for (let i = 0; i < 21; i++) {
      normalizedVector.push(
        (landmarks[i].x - wrist.x) / scale,
        (landmarks[i].y - wrist.y) / scale,
        (landmarks[i].z - wrist.z) / scale
      );
    }

    return normalizedVector;
  }

  /**
   * Compute Cosine Similarity between two 63-dimensional vectors
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Detect rule-based core presets with geometric joint validation
   */
  public static matchPresetGesture(landmarks: Landmark3D[]): MatchResult | null {
    if (!landmarks || landmarks.length !== 21) return null;

    const wrist = landmarks[0];

    // Finger joint indexes: [MCP, PIP, DIP, TIP]
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];

    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const indexMcp = landmarks[5];

    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const middleMcp = landmarks[9];

    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const ringMcp = landmarks[13];

    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];
    const pinkyMcp = landmarks[17];

    // Distance helper
    const dist = (p1: Landmark3D, p2: Landmark3D) =>
      Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);

    // Finger extension checks (Tip is farther from wrist than PIP joint)
    const isIndexExtended = dist(indexTip, wrist) > dist(indexPip, wrist) * 1.15;
    const isMiddleExtended = dist(middleTip, wrist) > dist(middlePip, wrist) * 1.15;
    const isRingExtended = dist(ringTip, wrist) > dist(ringPip, wrist) * 1.15;
    const isPinkyExtended = dist(pinkyTip, wrist) > dist(pinkyPip, wrist) * 1.15;

    // Curl checks (Tip is close to MCP joint)
    const isIndexCurled = dist(indexTip, indexMcp) < dist(indexPip, indexMcp) * 1.35;
    const isMiddleCurled = dist(middleTip, middleMcp) < dist(middlePip, middleMcp) * 1.35;
    const isRingCurled = dist(ringTip, ringMcp) < dist(ringPip, ringMcp) * 1.35;
    const isPinkyCurled = dist(pinkyTip, pinkyMcp) < dist(pinkyPip, pinkyMcp) * 1.35;

    // 1. Thumbs Up: Thumb pointing upward (lower y in screen coords), other 4 fingers curled
    const isThumbPointingUp = thumbTip.y < thumbMcp.y - 0.05;
    if (isThumbPointingUp && isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
      return {
        gesture: DEFAULT_PRESET_GESTURES[1], // thumbs_up
        confidence: 0.94
      };
    }

    // 2. Thumbs Down: Thumb pointing downward (higher y in screen coords), other 4 fingers curled
    const isThumbPointingDown = thumbTip.y > thumbMcp.y + 0.05;
    if (isThumbPointingDown && isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
      return {
        gesture: DEFAULT_PRESET_GESTURES[2], // thumbs_down
        confidence: 0.92
      };
    }

    // 3. Victory / V-Sign: Index and Middle extended, Ring and Pinky curled
    if (isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled) {
      return {
        gesture: DEFAULT_PRESET_GESTURES[5], // peace_v
        confidence: 0.95
      };
    }

    // 4. Pointing Finger: Index extended, Middle, Ring, Pinky curled
    if (isIndexExtended && isMiddleCurled && isRingCurled && isPinkyCurled) {
      return {
        gesture: DEFAULT_PRESET_GESTURES[3], // pointing
        confidence: 0.93
      };
    }

    // 5. Closed Fist: All 4 main fingers curled
    if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && !isThumbPointingUp) {
      return {
        gesture: DEFAULT_PRESET_GESTURES[4], // fist
        confidence: 0.91
      };
    }

    // 6. Open Palm: All 4 main fingers extended
    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      return {
        gesture: DEFAULT_PRESET_GESTURES[0], // open_palm
        confidence: 0.96
      };
    }

    return null;
  }

  /**
   * Match against user-enrolled custom gestures via Cosine Similarity
   */
  public static matchCustomGestures(landmarks: Landmark3D[]): MatchResult | null {
    const customList = this.getCustomGestures();
    if (customList.length === 0) return null;

    const liveVector = this.normalizeLandmarks(landmarks);
    if (liveVector.length === 0) return null;

    let bestMatch: EnrolledGesture | null = null;
    let maxSimilarity = 0;

    for (const custom of customList) {
      if (!custom.vector) continue;
      const sim = this.cosineSimilarity(liveVector, custom.vector);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        bestMatch = custom;
      }
    }

    // Threshold of 0.84 for accessible custom vector template match
    if (bestMatch && maxSimilarity >= 0.84) {
      return {
        gesture: bestMatch,
        confidence: Math.round(maxSimilarity * 100) / 100
      };
    }

    return null;
  }

  /**
   * Save a newly enrolled custom gesture to LocalStorage
   */
  public static saveCustomGesture(gesture: Omit<EnrolledGesture, 'id'>): EnrolledGesture {
    const list = this.getCustomGestures();
    const newGesture: EnrolledGesture = {
      ...gesture,
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      isCustom: true
    };
    list.push(newGesture);
    localStorage.setItem(this.customGesturesKey, JSON.stringify(list));
    return newGesture;
  }

  public static getCustomGestures(): EnrolledGesture[] {
    try {
      const raw = localStorage.getItem(this.customGesturesKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public static deleteCustomGesture(id: string): void {
    const list = this.getCustomGestures().filter((g) => g.id !== id);
    localStorage.setItem(this.customGesturesKey, JSON.stringify(list));
  }
}
