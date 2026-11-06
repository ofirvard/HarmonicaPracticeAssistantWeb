/** An error whose message is ready to show to the player. */
export class MicError extends Error {}

export interface MicSession {
  sampleRate: number;
  warning: string | null; // something worth telling the player, though capture is running
  close(): void;
}

export interface MicCallbacks {
  onHop(samples: Float32Array, sampleRate: number): void;
  onFailure(message: string): void; // capture died after it started
}

// All three must be off. Noise suppression in particular treats a sustained harmonica note as
// background noise and removes it, and auto gain moves the level the silence threshold relies on.
const CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

function describeError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
      return "Microphone access is blocked. Allow it in your browser's site settings, then try again.";
    case 'NotFoundError':
      return 'No microphone was found. Connect one, then try again.';
    case 'NotReadableError':
      return 'The microphone could not be started. Another app may be using it.';
    default:
      return `Could not start the microphone: ${e instanceof Error ? e.message : e}`;
  }
}

function processingWarning(track: MediaStreamTrack): string | null {
  const { echoCancellation, noiseSuppression, autoGainControl } = track.getSettings();
  const stillOn = [
    echoCancellation && 'echo cancellation',
    noiseSuppression && 'noise suppression',
    autoGainControl && 'auto gain',
  ].filter(Boolean);
  return stillOn.length > 0
    ? `Your browser kept ${stillOn.join(', ')} on, so notes may be missed.`
    : null;
}

/** Opens the default microphone. Must be called from a click, which browsers require for audio. */
export async function openMic(hopSize: number, callbacks: MicCallbacks): Promise<MicSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicError('The microphone needs a secure page. Open this app over HTTPS or localhost.');
  }

  // Created before the first await so it still counts as part of the click.
  const context = new AudioContext({ latencyHint: 'interactive' });
  let stream: MediaStream | null = null;
  let closed = false;

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    stream?.getTracks().forEach((track) => track.stop());
    void context.close();
  };

  const fail = (message: string) => {
    if (!closed) {
      close();
      callbacks.onFailure(message);
    }
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: CONSTRAINTS });
    await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}hop-processor.js`);
    await context.resume();

    const worklet = new AudioWorkletNode(context, 'hop-processor', {
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit', // downmixes a stereo mic by averaging its channels
      processorOptions: { hopSize },
    });
    worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (!closed) {
        callbacks.onHop(event.data, context.sampleRate);
      }
    };
    worklet.onprocessorerror = () => fail('Audio capture stopped unexpectedly.');

    const track = stream.getAudioTracks()[0]!;
    track.addEventListener('ended', () => fail('The microphone was disconnected.'));

    // The worklet never writes to its output, so this plays silence. It's connected only because
    // browsers can skip processing for nodes that don't lead to the destination.
    context.createMediaStreamSource(stream).connect(worklet).connect(context.destination);

    return { sampleRate: context.sampleRate, warning: processingWarning(track), close };
  } catch (e) {
    close();
    throw new MicError(describeError(e));
  }
}
