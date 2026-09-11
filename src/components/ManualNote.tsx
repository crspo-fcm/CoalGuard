import { useEffect, useState } from "react";

type ManualNote = {
  id: number;
  text: string;
  timestamp: string;
};

const STORAGE_KEY = "coalguard_manual_notes";

function ManualNote() {
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<ManualNote[]>([]);
  const [status, setStatus] = useState("Write an inspection observation.");

  useEffect(() => {
    const savedNotes = localStorage.getItem(STORAGE_KEY);

    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const saveNote = () => {
    if (note.trim() === "") {
      setStatus("Please write a note first.");
      return;
    }

    const newNote: ManualNote = {
      id: Date.now(),
      text: note.trim(),
      timestamp: new Date().toLocaleString(),
    };

    const updatedNotes = [newNote, ...notes];

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedNotes)
    );

    setNotes(updatedNotes);
    setNote("");
    setStatus("Inspection note saved successfully.");
  };

  const deleteNote = (id: number) => {
    const updatedNotes = notes.filter(
      (item) => item.id !== id
    );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedNotes)
    );

    setNotes(updatedNotes);
    setStatus("Note deleted.");
  };

  return (
    <div className="rounded-2xl border border-yellow-400/20 bg-slate-900 p-4">

      <h3 className="font-black text-yellow-400">
        ✍️ Manual Note
      </h3>

      <p className="mt-1 text-sm text-slate-400">
        Record an observation from the inspection.
      </p>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Example: Emergency exit needs maintenance..."
        className="mt-4 h-36 w-full resize-none rounded-xl border border-white/10 bg-[#111827] p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-yellow-400"
      />

      <button
        type="button"
        onClick={saveNote}
        className="mt-3 w-full rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 py-3 font-black text-slate-950"
      >
        💾 SAVE NOTE
      </button>

      <p className="mt-3 text-sm text-slate-400">
        {status}
      </p>

      {notes.length > 0 && (
        <div className="mt-5">

          <h4 className="mb-3 font-bold text-slate-300">
            Saved Notes ({notes.length})
          </h4>

          <div className="space-y-3">

            {notes.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >

                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  {item.text}
                </p>

                <div className="mt-3 flex items-center justify-between">

                  <span className="text-xs text-slate-500">
                    🕒 {item.timestamp}
                  </span>

                  <button
                    type="button"
                    onClick={() => deleteNote(item.id)}
                    className="text-xs font-bold text-red-400"
                  >
                    🗑️ Delete
                  </button>

                </div>

              </div>
            ))}

          </div>

        </div>
      )}

    </div>
  );
}

export default ManualNote;