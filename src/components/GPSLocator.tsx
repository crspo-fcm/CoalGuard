import { useState } from "react";

type GPSData = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type GPSLocatorProps = {
  onLocationCaptured?: (data: GPSData) => void;
};

function GPSLocator({ onLocationCaptured }: GPSLocatorProps) {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState("Tap to get your location.");

  const getLocation = () => {
    if (!("geolocation" in navigator)) {
      setStatus("Geolocation is not supported by this browser.");
      return;
    }

    setStatus("Requesting high-accuracy location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const {
          latitude,
          longitude,
          accuracy,
        } = position.coords;

        setLatitude(latitude);
        setLongitude(longitude);
        setAccuracy(accuracy);

        onLocationCaptured?.({
          latitude,
          longitude,
          accuracy,
        });

        setStatus(
          `Location acquired (±${accuracy.toFixed(0)} m)`
        );
      },
      (error) => {
        if (error.code === 1) {
          setStatus(
            "Permission denied. Please allow location access."
          );
        } else if (error.code === 2) {
          setStatus("Position unavailable.");
        } else if (error.code === 3) {
          setStatus("Location request timed out.");
        } else {
          setStatus("Unable to get your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-slate-900 p-4">

      <h3 className="font-black text-cyan-400">
        📍 GPS Location
      </h3>

      <p className="mt-1 text-sm text-slate-400">
        Capture the inspector's current coordinates.
      </p>

      <button
        type="button"
        onClick={getLocation}
        className="mt-4 w-full rounded-xl bg-cyan-500 py-3 font-black text-slate-950"
      >
        📍 GET MY LOCATION
      </button>

      <p className="mt-3 text-sm text-slate-400">
        {status}
      </p>

      {latitude !== null && longitude !== null && (
        <div className="mt-4 space-y-2 rounded-xl bg-white/5 p-3">

          <div className="flex justify-between">
            <span className="text-slate-400">
              Latitude
            </span>

            <span className="font-bold">
              {latitude.toFixed(6)}°
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">
              Longitude
            </span>

            <span className="font-bold">
              {longitude.toFixed(6)}°
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">
              Accuracy
            </span>

            <span className="font-bold">
              ±{accuracy?.toFixed(1)} m
            </span>
          </div>

          <a
            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block pt-2 text-center font-bold text-cyan-400"
          >
            🗺️ Open in Google Maps →
          </a>

        </div>
      )}

    </div>
  );
}

export default GPSLocator;