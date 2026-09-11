import { useEffect, useRef, useState } from "react";

type PhotoWatermarkProps = {
  inspectionId: string;
  onPhotoSaved?: () => void;
};

type SavedPhoto = {
  id: number;
  inspectionId: string;
  image: string;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
};

const STORAGE_KEY = "coalguard_photos";

function PhotoWatermark({
  inspectionId,
  onPhotoSaved,
}: PhotoWatermarkProps) {
  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const [cameraStarted, setCameraStarted] =
    useState(false);

  const [facingMode, setFacingMode] =
    useState<"environment" | "user">(
      "environment"
    );

  const [status, setStatus] = useState(
    "Start the camera to capture evidence."
  );

  const [savedPhotos, setSavedPhotos] =
    useState<SavedPhoto[]>([]);

  useEffect(() => {
    loadPhotos();

    return () => {
      stopCamera();
    };
  }, [inspectionId]);

  const loadPhotos = () => {
    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      setSavedPhotos([]);
      return;
    }

    try {
      const photos = JSON.parse(saved);

      if (Array.isArray(photos)) {
        setSavedPhotos(photos);
      } else {
        setSavedPhotos([]);
      }
    } catch {
      setSavedPhotos([]);
    }
  };

  const getAllPhotos = (): SavedPhoto[] => {
    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return [];
    }

    try {
      const photos = JSON.parse(saved);

      return Array.isArray(photos)
        ? photos
        : [];
    } catch {
      return [];
    }
  };

  const startCamera = async (
    mode: "environment" | "user" = facingMode
  ) => {
    try {
      stopCamera();

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setStatus(
          "Camera is not supported by this browser."
        );
        return;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: mode,
            },
          },
          audio: false,
        });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();
      }

      setFacingMode(mode);
      setCameraStarted(true);
      setStatus(
        "Camera ready. Capture the safety evidence."
      );
    } catch (error) {
      console.error(
        "Camera error:",
        error
      );

      setCameraStarted(false);
      setStatus(
        "Camera permission was denied or the camera is unavailable."
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStarted(false);
  };

  const getLocation = (): Promise<{
    latitude: number | null;
    longitude: number | null;
  }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({
          latitude: null,
          longitude: null,
        });

        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude:
              position.coords.latitude,
            longitude:
              position.coords.longitude,
          });
        },
        () => {
          resolve({
            latitude: null,
            longitude: null,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const capturePhoto = async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !cameraStarted
    ) {
      setStatus(
        "Start the camera before capturing a photo."
      );

      return;
    }

    setStatus(
      "Capturing photo and GPS watermark..."
    );

    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    const width =
      video.videoWidth || 1280;

    const height =
      video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext("2d");

    if (!context) {
      setStatus(
        "Could not prepare the photo."
      );

      return;
    }

    context.drawImage(
      video,
      0,
      0,
      width,
      height
    );

    const location =
      await getLocation();

    const timestamp =
      new Date().toLocaleString();

    const gpsText =
      location.latitude !== null &&
      location.longitude !== null
        ? "GPS: " +
          location.latitude.toFixed(6) +
          ", " +
          location.longitude.toFixed(6)
        : "GPS: Location unavailable";

    const inspectionText =
      "INSPECTION: " +
      inspectionId;

    const boxHeight = 120;

    context.fillStyle =
      "rgba(0, 0, 0, 0.72)";

    context.fillRect(
      0,
      height - boxHeight,
      width,
      boxHeight
    );

    context.fillStyle =
      "#ffffff";

    context.font =
      "bold 28px Arial";

    context.fillText(
      "COALGUARD",
      25,
      height - 82
    );

    context.font =
      "20px Arial";

    context.fillText(
      inspectionText,
      25,
      height - 52
    );

    context.fillText(
      timestamp,
      25,
      height - 25
    );

    context.textAlign =
      "right";

    context.fillText(
      gpsText,
      width - 25,
      height - 25
    );

    context.textAlign =
      "left";

    const image =
      canvas.toDataURL(
        "image/jpeg",
        0.82
      );

    const newPhoto: SavedPhoto = {
      id: Date.now(),
      inspectionId,
      image,
      timestamp,
      latitude:
        location.latitude,
      longitude:
        location.longitude,
    };

    const allPhotos =
      getAllPhotos();

    allPhotos.push(newPhoto);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(allPhotos)
      );

      setSavedPhotos(
        allPhotos
      );

      setStatus(
        "✅ Photo evidence saved and attached to this inspection."
      );

      if (onPhotoSaved) {
        onPhotoSaved();
      }
    } catch {
      setStatus(
        "The photo is too large for browser storage. Try again."
      );
    }
  };

  const deletePhoto = (id: number) => {
    const allPhotos = getAllPhotos();

    const updated = allPhotos.filter(
      (photo) => photo.id !== id
    );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );

    setSavedPhotos(updated);

    if (onPhotoSaved) {
      onPhotoSaved();
    }

    setStatus("Photo evidence deleted.");
  };

  const downloadPhoto = (photo: SavedPhoto) => {
    const link = document.createElement("a");
    link.href = photo.image;
    link.download = `coalguard-photo-${photo.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatus("Photo evidence downloaded.");
  };

  const currentPhotos =
    savedPhotos.filter(
      (photo) =>
        photo.inspectionId ===
        inspectionId
    );

  const previousPhotos =
    savedPhotos.filter(
      (photo) =>
        photo.inspectionId !==
        inspectionId
    );

  return (
    <div className="mt-4 rounded-2xl border border-orange-400/20 bg-slate-900 p-4">

      <h3 className="font-black text-orange-400">
        📸 PHOTO EVIDENCE
      </h3>

      <p className="mt-1 text-sm text-slate-400">
        Capture a timestamped and GPS-tagged photo for this inspection.
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="aspect-video w-full object-cover"
        />
      </div>

      <canvas
        ref={canvasRef}
        className="hidden"
      />

      {!cameraStarted ? (
        <button
          type="button"
          onClick={() =>
            startCamera("environment")
          }
          className="mt-4 w-full rounded-xl bg-orange-500 py-4 font-black text-slate-950"
        >
          📷 START CAMERA
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={capturePhoto}
            className="mt-4 w-full rounded-xl bg-orange-500 py-4 font-black text-slate-950"
          >
            📸 CAPTURE EVIDENCE
          </button>

          <div className="mt-3 grid grid-cols-2 gap-3">

            <button
              type="button"
              onClick={() =>
                startCamera(
                  facingMode ===
                    "environment"
                    ? "user"
                    : "environment"
                )
              }
              className="rounded-xl bg-slate-700 py-3 font-bold text-white"
            >
              🔄 FLIP CAMERA
            </button>

            <button
              type="button"
              onClick={stopCamera}
              className="rounded-xl bg-slate-700 py-3 font-bold text-white"
            >
              ⏹ STOP CAMERA
            </button>

          </div>
        </>
      )}

      <div className="mt-4 rounded-xl bg-white/5 p-4">
        <p className="text-sm text-slate-400">
          {status}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-orange-400/20 bg-orange-400/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            Current inspection photos
          </span>

          <span className="text-xl font-black text-orange-400">
            {currentPhotos.length}
          </span>
        </div>
      </div>

      {currentPhotos.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 font-bold text-slate-300">
            📸 Current Inspection Photo Evidence
          </h4>

          <div className="space-y-4">

            {currentPhotos.map(
              (photo, index) => (
                <div
                  key={photo.id}
                  className="rounded-xl border border-orange-400/20 bg-white/5 p-3"
                >

                  <p className="font-bold text-orange-400">
                    Photo #{index + 1}
                  </p>

                  <img
                    src={photo.image}
                    alt="Mine safety inspection evidence"
                    className="mt-3 w-full rounded-xl"
                  />

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      🕒 {photo.timestamp}
                    </span>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => downloadPhoto(photo)}
                        className="text-xs font-bold text-cyan-400"
                      >
                        ⬇️ DOWNLOAD
                      </button>

                      <button
                        type="button"
                        onClick={() => deletePhoto(photo.id)}
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

      {previousPhotos.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 font-bold text-slate-300">
            📁 Previous Photo Evidence ({previousPhotos.length})
          </h4>

          <div className="space-y-4">

            {previousPhotos.map(
              (photo) => (
                <div
                  key={photo.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >

                  <p className="text-sm font-bold text-cyan-400">
                    Previous Inspection
                  </p>

                  <img
                    src={photo.image}
                    alt="Previous mine safety inspection evidence"
                    className="mt-3 w-full rounded-xl"
                  />

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      🕒 {photo.timestamp}
                    </span>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => downloadPhoto(photo)}
                        className="text-xs font-bold text-cyan-400"
                      >
                        ⬇️ DOWNLOAD
                      </button>

                      <button
                        type="button"
                        onClick={() => deletePhoto(photo.id)}
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

    </div>
  );
}

export default PhotoWatermark;
