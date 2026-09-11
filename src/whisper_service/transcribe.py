from flask import Flask, request, jsonify
import whisper
import os
import tempfile

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    # Allow the Vite React frontend (localhost:5174) to call Whisper.
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5174"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


print("Loading Whisper model...")
model = whisper.load_model("base")
print("Whisper model loaded successfully.")


@app.get("/")
def health_check():
    return jsonify({
        "service": "CoalGuard Whisper Service",
        "status": "online"
    })


@app.post("/transcribe")
def transcribe_audio():
    if "audio" not in request.files:
        return jsonify({
            "error": "No audio file received."
        }), 400

    audio_file = request.files["audio"]

    if not audio_file.filename:
        return jsonify({
            "error": "Audio filename is missing."
        }), 400

    temp_path = None

    try:
        extension = os.path.splitext(audio_file.filename)[1] or ".webm"

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension
        ) as temp_file:
            audio_file.save(temp_file.name)
            temp_path = temp_file.name

        result = model.transcribe(
            temp_path,
            task="transcribe",
            fp16=False
        )

        text = result.get("text", "").strip()
        detected_language = result.get("language")

        return jsonify({
            "success": True,
            "text": text,
            "language": detected_language
        })

    except Exception as error:
        print("Whisper transcription error:", repr(error))

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5001,
        debug=True
    )
import os

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5001))
    )