import { useEffect, useRef, useState } from "react";

type VoiceRecorderProps = {
  inspectionId: string;
  onVoiceSaved?: () => void;
  onTranscript?: (text: string) => void;
};

type SavedVoiceNote = {
  id: number;
  inspectionId: string;
  audio?: string;
  text?: string;
  timestamp: string;
  duration: number;
};

const STORAGE_KEY = "coalguard_voice_notes";

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
    length: number;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;


function VoiceRecorder({
  inspectionId,
  onVoiceSaved,
  onTranscript,
}: VoiceRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const secondsRef = useRef(0);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechFinalTextRef = useRef("");
  const speechLiveTextRef = useRef("");
  const speechActiveRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState(
    "Press START RECORDING and speak your observation."
  );
  const [notes, setNotes] = useState<SavedVoiceNote[]>([]);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    loadNotes();

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      speechActiveRef.current = false;

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // Recognition may already be stopped.
        }
        speechRecognitionRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [inspectionId]);

  const loadNotes = () => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      setNotes([]);
      return;
    }

    try {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        setNotes(parsed);
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
    }
  };

  const getSpeechRecognition = (): SpeechRecognitionLike | null => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return null;
    }

    return new SpeechRecognition();
  };

  const startSpeechToText = () => {
    const recognition = getSpeechRecognition();

    if (!recognition) {
      setStatus(
        "Audio recording is active. Speech-to-text is not supported in this browser."
      );
      return;
    }

    speechFinalTextRef.current = "";
    speechLiveTextRef.current = "";
    speechActiveRef.current = true;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript || "";

        if (result.isFinal) {
          speechFinalTextRef.current += `${text} `;
        } else {
          interimText += text;
        }
      }

      const combinedText =
        `${speechFinalTextRef.current} ${interimText}`.trim();

      speechLiveTextRef.current = combinedText;
      setTranscript(combinedText);

    };

    recognition.onerror = (event) => {
      console.warn("Speech-to-text error:", event);
      setStatus("Speech-to-text is still recording. Please continue speaking.");
    };

    recognition.onend = () => {
      if (speechActiveRef.current) {
        try {
          recognition.start();
        } catch {
          // Browser may reject a rapid restart. Recording continues normally.
        }
      }
    };

    speechRecognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.warn("Speech-to-text could not start:", error);
      speechActiveRef.current = false;
      speechRecognitionRef.current = null;
    }
  };

  const stopSpeechToText = () => {
    speechActiveRef.current = false;

    const recognition = speechRecognitionRef.current;

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Recognition may already be stopped.
      }
    }

    speechRecognitionRef.current = null;

    const finalText = speechFinalTextRef.current.trim();
    setTranscript(finalText);

    if (onTranscript && finalText) {
      onTranscript(finalText);
    }

    return finalText;
  };

  const startRecording = async () => {
    if (isRecording) {
      return;
    }

    try {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setStatus(
          "This browser does not support microphone recording."
        );
        return;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      streamRef.current = stream;
      audioChunksRef.current = [];
      secondsRef.current = 0;

      let mimeType = "";

      if (
        MediaRecorder.isTypeSupported(
          "audio/webm;codecs=opus"
        )
      ) {
        mimeType = "audio/webm;codecs=opus";
      } else if (
        MediaRecorder.isTypeSupported("audio/webm")
      ) {
        mimeType = "audio/webm";
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setIsRecording(false);
        setStatus(
          "Recording error. Please try again."
        );
      };

      recorder.onstop = async () => {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (streamRef.current) {
          streamRef.current
            .getTracks()
            .forEach((track) => track.stop());

          streamRef.current = null;
        }

        setIsRecording(false);

        const blob = new Blob(
          audioChunksRef.current,
          {
            type:
              recorder.mimeType ||
              "audio/webm",
          }
        );

        if (blob.size === 0) {
          setStatus(
            "No audio was captured. Please try again."
          );
          return;
        }

        const speechTranscript = stopSpeechToText();

        setStatus(
          speechTranscript
            ? "Speech-to-text complete. Saving voice evidence..."
            : "Saving voice evidence..."
        );

        const reader = new FileReader();

        reader.onloadend = () => {
          const audioData =
            reader.result as string;

          const newNote: SavedVoiceNote = {
            id: Date.now(),
            inspectionId,
            audio: audioData,
            text: speechTranscript,
            timestamp:
              new Date().toLocaleString(),
            duration: secondsRef.current,
          };

          const saved =
            localStorage.getItem(
              STORAGE_KEY
            );

          let allNotes: SavedVoiceNote[] = [];

          if (saved) {
            try {
              const parsed = JSON.parse(saved);

              if (Array.isArray(parsed)) {
                allNotes = parsed;
              }
            } catch {
              allNotes = [];
            }
          }

          allNotes.push(newNote);

          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(allNotes)
            );

            setNotes(allNotes);

            setStatus(
              speechTranscript
                ? "✅ Voice + transcript saved and attached to this inspection."
                : "✅ Voice note saved. No transcript was available."
            );

            if (onVoiceSaved) {
              onVoiceSaved();
            }
          } catch {
            setStatus(
              "The recording is too large for browser storage. Try a shorter recording."
            );
          }

          audioChunksRef.current = [];
        };

        reader.readAsDataURL(blob);
      };

      recorder.start();
      startSpeechToText();

      setIsRecording(true);
      setSeconds(0);
      setStatus(
        "🎙️ RECORDING — speak your observation. Speech-to-text is running."
      );

      timerRef.current =
        window.setInterval(() => {
          secondsRef.current += 1;
          setSeconds(secondsRef.current);
        }, 1000);
    } catch (error) {
      console.error(
        "Microphone error:",
        error
      );

      setStatus(
        "Microphone permission was denied or the microphone is unavailable."
      );
    }
  };

  const stopRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state === "recording"
    ) {
      setStatus("Finishing recording...");
      recorder.stop();
    }
  };

  const deleteNote = (id: number) => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return;
    }

    try {
      const allNotes = JSON.parse(saved);

      if (!Array.isArray(allNotes)) {
        return;
      }

      const updated = allNotes.filter(
        (note: SavedVoiceNote) => note.id !== id
      );

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updated)
      );

      setNotes(updated);

      if (onVoiceSaved) {
        onVoiceSaved();
      }

      setStatus("Voice note deleted.");
    } catch {
      setStatus("Could not delete the voice note.");
    }
  };

  const downloadVoice = (note: SavedVoiceNote) => {
    if (!note.audio) {
      setStatus("This voice note has no downloadable audio.");
      return;
    }

    const link = document.createElement("a");
    link.href = note.audio;
    link.download = `coalguard-voice-${note.id}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatus("Voice evidence downloaded.");
  };

  const currentNotes =
    notes.filter(
      (note) =>
        note.inspectionId ===
        inspectionId
    );

  const previousNotes =
    notes.filter(
      (note) =>
        note.inspectionId !==
        inspectionId
    );

  const formatTime = (
    value: number
  ) => {
    const minutes =
      Math.floor(value / 60);

    const remaining =
      value % 60;

    return (
      minutes
        .toString()
        .padStart(2, "0") +
      ":" +
      remaining
        .toString()
        .padStart(2, "0")
    );
  };

  return (
    <div className="mt-4 rounded-2xl border border-green-400/20 bg-slate-900 p-4">

      <h3 className="font-black text-green-400">
        🎙️ VOICE OBSERVATION
      </h3>

      <p className="mt-1 text-sm text-slate-400">
        Record actual audio evidence for the current inspection.
      </p>

      {!isRecording ? (
        <button
          type="button"
          onClick={startRecording}
          className="mt-5 w-full rounded-xl bg-green-500 py-4 font-black text-slate-950"
        >
          🎙️ START RECORDING
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="mt-5 w-full rounded-xl bg-red-500 py-4 font-black text-white"
        >
          ⏹ STOP RECORDING
        </button>
      )}

      <div className="mt-4 rounded-xl bg-white/5 p-4 text-center">
        <p className="text-3xl font-black text-green-400">
          {formatTime(seconds)}
        </p>

        <p className="mt-2 text-sm text-slate-400">
          {status}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-black text-cyan-300">
            📝 SPEECH-TO-TEXT TRANSCRIPT
          </span>

          <span className="text-xs text-slate-500">
            {transcript ? "TRANSCRIBED" : "WAITING"}
          </span>
        </div>

        <p className="mt-3 min-h-[72px] rounded-lg bg-black/20 p-3 text-sm leading-6 text-slate-200">
          {transcript ||
            "Record your observation, press STOP, and Speech-to-text will convert your speech into text here."}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-green-400/20 bg-green-400/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            Current inspection voice notes
          </span>

          <span className="text-xl font-black text-green-400">
            {currentNotes.length}
          </span>
        </div>
      </div>

      {currentNotes.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 font-bold text-slate-300">
            🎙️ Current Inspection Voice Evidence
          </h4>

          <div className="space-y-3">
            {currentNotes.map(
              (note, index) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-green-400/20 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-green-400">
                      Voice Note #{index + 1}
                    </p>

                    <span className="text-xs text-slate-500">
                      {note.duration}s
                    </span>
                  </div>

                  {note.audio ? (
                    <audio
                      controls
                      src={note.audio}
                      className="mt-3 w-full"
                    />
                  ) : null}

                  <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-widest text-cyan-300">
                        📝 TRANSCRIPT TEXT
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Speech → Text
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                      {note.text?.trim() ||
                        "No transcript was saved for this voice note."}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      🕒 {note.timestamp}
                    </span>

                    <div className="flex items-center gap-3">
                      {note.audio && (
                        <button
                          type="button"
                          onClick={() => downloadVoice(note)}
                          className="text-xs font-bold text-cyan-400"
                        >
                          ⬇️ DOWNLOAD
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => deleteNote(note.id)}
                        className="text-xs font-bold text-red-400"
                      >
                        🗑️ DELETE
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {previousNotes.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 font-bold text-slate-300">
            📁 Previous Voice Notes ({previousNotes.length})
          </h4>

          <div className="space-y-3">
            {previousNotes.map(
              (note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-cyan-400">
                      Previous Inspection
                    </span>

                    <span className="text-xs text-slate-500">
                      {note.timestamp}
                    </span>
                  </div>

                  {note.audio ? (
                    <audio
                      controls
                      src={note.audio}
                      className="mt-3 w-full"
                    />
                  ) : null}

                  <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-widest text-cyan-300">
                        📝 TRANSCRIPT TEXT
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Speech → Text
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                      {note.text?.trim() ||
                        "No transcript was saved for this voice note."}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-3">
                    {note.audio && (
                      <button
                        type="button"
                        onClick={() => downloadVoice(note)}
                        className="text-xs font-bold text-cyan-400"
                      >
                        ⬇️ DOWNLOAD
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => deleteNote(note.id)}
                      className="text-xs font-bold text-red-400"
                    >
                      🗑️ DELETE
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default VoiceRecorder;
