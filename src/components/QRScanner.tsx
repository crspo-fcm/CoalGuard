import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type QRScannerProps = {
  onScan?: (data: string) => void;
};

function QRScanner({ onScan }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState(
    "Press START SCANNER to scan the mine QR code."
  );

  const readerId = "coalguard-qr-reader";

  const stopScanner = async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      setScanning(false);
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }

      scanner.clear();
    } catch (error) {
      console.error("Error stopping QR scanner:", error);
    }

    scannerRef.current = null;
    setScanning(false);
  };

  const startScanner = async () => {
    try {
      setResult(null);
      setStatus("Starting camera...");

      await stopScanner();

      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250,
          },
        },

        async (decodedText) => {
          const value = decodedText.trim();

          if (!value) {
            return;
          }

          console.log("COALGUARD QR DETECTED:", value);

          setResult(value);

          setStatus(
            `QR detected: ${value}`
          );

          // IMPORTANT:
          // Pass ANY QR text to InspectorMobileView.
          // It does NOT need to be a web link.
          if (onScan) {
            onScan(value);
          }

          await stopScanner();
        },

        () => {
          // Keep scanning while no QR code is detected.
        }
      );

      setScanning(true);

      setStatus(
        "Scanning... Point the camera at the mine QR code."
      );
    } catch (error) {
      console.error("QR scanner error:", error);

      scannerRef.current = null;
      setScanning(false);

      setStatus(
        "Could not start the camera. Please allow camera access in Chrome."
      );
    }
  };

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;

      if (scanner?.isScanning) {
        scanner
          .stop()
          .then(() => {
            scanner.clear();
          })
          .catch((error) => {
            console.error(
              "QR scanner cleanup error:",
              error
            );
          });
      }
    };
  }, []);

  const clearResult = () => {
    setResult(null);

    setStatus(
      "Press START SCANNER to scan the mine QR code."
    );
  };

  return (
    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-slate-900 p-4">

      <h3 className="font-black text-cyan-400">
        📱 COALGUARD MINE QR SCANNER
      </h3>

      <p className="mt-1 text-sm text-slate-400">
        Scan the QR code attached to the registered mine.
      </p>

      <div
        id={readerId}
        className="mt-4 overflow-hidden rounded-xl bg-black"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">

        <button
          type="button"
          onClick={startScanner}
          disabled={scanning}
          className="rounded-xl bg-cyan-500 py-3 font-black text-slate-950 disabled:opacity-50"
        >
          📷 START SCANNER
        </button>

        <button
          type="button"
          onClick={stopScanner}
          disabled={!scanning}
          className="rounded-xl bg-slate-700 py-3 font-bold text-white disabled:opacity-50"
        >
          ⏹ STOP
        </button>

      </div>

      <p className="mt-3 text-sm text-slate-400">
        {status}
      </p>

      {result && (
        <div className="mt-4 rounded-xl border border-green-400/30 bg-green-400/10 p-4">

          <h4 className="font-black text-green-400">
            ✅ MINE QR DETECTED
          </h4>

          <p className="mt-2 break-all rounded-lg bg-black/30 p-3 text-sm font-bold text-white">
            {result}
          </p>

          <p className="mt-3 text-xs text-green-300">
            CoalGuard accepts mine IDs, QR text, and QR links.
          </p>

          <button
            type="button"
            onClick={clearResult}
            className="mt-3 w-full rounded-xl bg-slate-700 py-2 font-bold text-white"
          >
            CLEAR RESULT
          </button>

        </div>
      )}
    </div>
  );
}

export default QRScanner;