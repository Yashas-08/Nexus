// Web Speech API interface definitions for TypeScript
interface IWindowSpeech extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SpeechRecognition?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webkitSpeechRecognition?: any;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as IWindowSpeech;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export interface SpeechListenerOptions {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (errorMessage: string) => void;
  onEnd: () => void;
}

export class SpeechTranscriber {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private isListening: boolean = false;

  constructor(options: SpeechListenerOptions) {
    if (!isSpeechRecognitionSupported()) return;

    const win = window as IWindowSpeech;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        const activeText = finalTranscript || interimTranscript;
        if (activeText) {
          options.onTranscript(activeText.trim(), Boolean(finalTranscript));
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onerror = (event: any) => {
        let message = 'Voice transcription error';
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          message = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
        } else if (event.error === 'no-speech') {
          message = 'No speech was detected. Please try speaking again.';
        } else if (event.error === 'network') {
          message = 'Network issue occurred during transcription.';
        }
        options.onError(message);
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
        options.onEnd();
      };
    } catch (err) {
      console.warn('SpeechRecognition initialization error:', err);
    }
  }

  public start(): boolean {
    if (!this.recognition) return false;
    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch {
      return false;
    }
  }

  public stop(): void {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
      this.isListening = false;
    } catch {
      // Ignored if already stopped
    }
  }

  public get active(): boolean {
    return this.isListening;
  }
}
