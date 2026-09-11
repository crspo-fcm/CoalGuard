import { useEffect, useState } from "react";
import GPSLocator from "./GPSLocator";
import VoiceRecorder from "./VoiceRecorder";
import PhotoWatermark from "./PhotoWatermark";
import ManualNote from "./ManualNote";
import QRScanner from "./QRScanner";
import ComplianceManagement from "./ComplianceManagement";
import ViolationsManagement from "./ViolationsManagement";
import { submitInspection, getLocations } from "../api";
type VoiceEvidence = {
  id: number;
  inspectionId: string;
  audio?: string;
  text?: string;
  timestamp: string;
  duration: number;
};

type PhotoEvidence = {
  id: number;
  inspectionId: string;
  image: string;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
};

type Inspection = {
  id: string;
  dateTime: string;
  mineId: string;
  mineLink: string;
  inspectorName: string;
  inspectionType: string;
  safetyStatus: string;
  latitude: string;
  longitude: string;
  observations: string;
  emergencyExit: string;
  ventilation: string;
  ppe: string;
  electrical: string;
  fireSafety: string;
  remarks: string;
  photoCount: number;
  voiceCount: number;
  voiceNoteIds: number[];
};

const STORAGE_KEY = "coalguard_inspections";
const VOICE_STORAGE_KEY = "coalguard_voice_notes";
const PHOTO_STORAGE_KEY = "coalguard_photos";


function ToolIcon({
  type,
}: {
  type: "qr" | "gps" | "photo" | "voice" | "note";
}) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (type === "qr") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h3v3h-3z" />
        <path d="M20 14v3h-3M14 20h3v-3M20 20h1" />
      </svg>
    );
  }

  if (type === "gps") {
    return (
      <svg {...common}>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (type === "photo") {
    return (
      <svg {...common}>
        <path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    );
  }

  if (type === "voice") {
    return (
      <svg {...common}>
        <rect x="8" y="3" width="8" height="12" rx="4" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M6 3h9l3 3v15H6V3Z" />
      <path d="M15 3v4h4M9 12h6M9 16h6" />
    </svg>
  );
}

function InspectorMobileView() {
  const [showGPS, setShowGPS] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showInspection, setShowInspection] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showMinistry, setShowMinistry] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [currentInspectionId, setCurrentInspectionId] = useState("");
  const [voiceRefresh, setVoiceRefresh] = useState(0);
  const [photoRefresh, setPhotoRefresh] = useState(0);

  const [mineId, setMineId] = useState("");
  const [mineLink, setMineLink] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [inspectionType, setInspectionType] =
    useState("Routine Inspection");
  const [safetyStatus, setSafetyStatus] =
    useState("Pending");

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [gpsMode, setGpsMode] = useState<"live" | "demo">("live");

  const [observations, setObservations] = useState("");
  const [emergencyExit, setEmergencyExit] =
    useState("Not Checked");
  const [ventilation, setVentilation] =
    useState("Not Checked");
  const [ppe, setPpe] = useState("Not Checked");
  const [electrical, setElectrical] =
    useState("Not Checked");
  const [fireSafety, setFireSafety] =
    useState("Not Checked");
  const [remarks, setRemarks] = useState("");

  const [statusMessage, setStatusMessage] = useState("");

  type InspectorTab =
    | "dashboard"
     | "evidence"
    | "compliance"
    | "violations"
    | "records"
    | "resources";

  const [activeTab, setActiveTab] =
    useState<InspectorTab>("dashboard");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setInspections(parsed);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const openInspection = () => {
    // Keep the same inspection ID if evidence was already
    // captured from the Voice Note or Photo Evidence buttons.
    if (!currentInspectionId) {
      const newId =
        "INS-" + Date.now().toString();

      setCurrentInspectionId(newId);
    }

    setVoiceRefresh((value) => value + 1);
    setPhotoRefresh((value) => value + 1);
    setShowInspection(true);
    setStatusMessage("");
  };

  const closeInspection = () => {
    setShowInspection(false);
  };

  const getGPS = () => {
    if (!navigator.geolocation) {
      setStatusMessage(
        "GPS is not supported by this browser."
      );
      return;
    }

    setStatusMessage(
      "Getting current GPS location..."
    );

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(
          position.coords.latitude.toFixed(6)
        );

        setLongitude(
          position.coords.longitude.toFixed(6)
        );
        setGpsMode("live");

        setStatusMessage(
          "GPS location captured successfully."
        );
      },
      () => {
        setStatusMessage(
          "Could not get GPS location. Please allow location access."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const useDemoGPS = async () => {
    const demoLatitude = "22.572600";
    const demoLongitude = "88.363900";

    setLatitude(demoLatitude);
    setLongitude(demoLongitude);
    setGpsMode("demo");
    setStatusMessage("Loading registered demo mine details...");

    try {
      const response = await getLocations();
      const locations = Array.isArray(response?.locations) ? response.locations : [];
      const matchedLocation = locations.find((location: any) =>
        Math.abs(Number(location.latitude) - Number(demoLatitude)) < 0.00001 &&
        Math.abs(Number(location.longitude) - Number(demoLongitude)) < 0.00001
      ) || locations.find((location: any) =>
        String(location.name || "").trim().toLowerCase() === "deep pit shaft 03"
      );

      if (!matchedLocation) {
        setMineId("");
        setMineLink("");
        setStatusMessage("Demo GPS loaded, but the registered demo mine could not be found.");
        return;
      }

      setMineId(String(matchedLocation.id));
      setMineLink(String(matchedLocation.qr_code || matchedLocation.qrCode || ""));
      setStatusMessage(`Demo mine verified: ${matchedLocation.name}. GPS coordinates and Mine ID loaded.`);
    } catch (error) {
      console.error("DEMO MINE LOOKUP FAILED:", error);
      setMineId("");
      setMineLink("");
      setStatusMessage("Demo GPS loaded, but registered mine details could not be retrieved.");
    }
  };

  const handleQRScan = async (data: string) => {
  const scannedValue = data.trim();

  if (!scannedValue) {
    setStatusMessage("QR code could not be read.");
    return;
  }

  try {
    const response = await getLocations();

    const locations = Array.isArray(response?.locations)
      ? response.locations
      : [];

    const matchedLocation = locations.find(
      (location: any) =>
        String(location.id) === scannedValue ||
        String(location.qr_code).trim().toLowerCase() ===
          scannedValue.toLowerCase()
    );

    if (matchedLocation) {
      setMineId(String(matchedLocation.id));
      setMineLink(String(matchedLocation.qr_code));

      setStatusMessage(
        `Mine verified: ${matchedLocation.name}`
      );
    } else {
      setMineId("");
      setMineLink(scannedValue);

      setStatusMessage(
        "QR scanned, but this mine is not registered in CoalGuard."
      );
    }
  } catch (error) {
    console.error(
      "QR MINE LOOKUP FAILED:",
      error
    );

    setMineId("");
    setMineLink(scannedValue);

    setStatusMessage(
      "QR scanned, but the backend mine lookup failed."
    );
  }

  setShowQR(false);
};

  const getAllPhotos = () => {
    const saved =
      localStorage.getItem("coalguard_photos");

    if (!saved) {
      return [];
    }

    try {
      const photos = JSON.parse(saved);

      return Array.isArray(photos)
        ? photos
        :[];
    } catch {
      return [];
    }
  };

  const getCurrentPhotos = () => {
    void photoRefresh;

    return getAllPhotos().filter(
      (photo) =>
        photo.inspectionId ===
        currentInspectionId
    );
  };

  const getPhotoCount = () => {
    return getCurrentPhotos().length;
  };

  const handlePhotoSaved = () => {
    setPhotoRefresh(
      (value) => value + 1
    );
  };

  const getAllVoiceNotes = (): VoiceEvidence[] => {
    const saved =
      localStorage.getItem(
        VOICE_STORAGE_KEY
      );

    if (!saved) {
      return [];
    }

    try {
      const notes = JSON.parse(saved);

      return Array.isArray(notes)
        ? notes
        : [];
    } catch {
      return [];
    }
  };

  const getCurrentVoiceNotes = () => {
    return getAllVoiceNotes().filter(
      (note) =>
        note.inspectionId ===
        currentInspectionId
    );
  };

  const getVoiceCount = () => {
    // voiceRefresh makes React re-read localStorage
    // after VoiceRecorder saves a note.
    void voiceRefresh;
    return getCurrentVoiceNotes().length;
  };

  const handleVoiceSaved = () => {
    setVoiceRefresh(
      (value) => value + 1
    );
  };

  const saveInspection = async () => {
    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (
      mineId.trim() === "" &&
      mineLink.trim() === ""
    ) {
      setStatusMessage(
        "Please scan a mine QR code or enter a Mine ID."
      );
      return;
    }

    if (inspectorName.trim() === "") {
      setStatusMessage(
        "Please enter the inspector name."
      );
      return;
    }

    if (!currentInspectionId) {
      setStatusMessage(
        "Start an inspection first."
      );
      return;
    }

    // -----------------------------------------
    // COLLECT CURRENT EVIDENCE
    // -----------------------------------------

    const currentVoiceNotes =
      getCurrentVoiceNotes();

    const currentPhotoCount =
      getCurrentPhotos().length;

    // -----------------------------------------
    // CREATE LOCAL INSPECTION RECORD
    // -----------------------------------------

    const newInspection: Inspection = {
      id: currentInspectionId,

      dateTime:
        new Date().toLocaleString(),

      mineId:
        mineId.trim(),

      mineLink:
        mineLink.trim(),

      inspectorName:
        inspectorName.trim(),

      inspectionType,

      safetyStatus,

      latitude,

      longitude,

      observations:
        observations.trim(),

      emergencyExit,

      ventilation,

      ppe,

      electrical,

      fireSafety,

      remarks:
        remarks.trim(),

      photoCount:
        currentPhotoCount,

      voiceCount:
        currentVoiceNotes.length,

      voiceNoteIds:
        currentVoiceNotes.map(
          (note) => note.id
        ),
    };

    // -----------------------------------------
    // SAVE TO LOCAL STORAGE
    // -----------------------------------------

    const updated = [
      newInspection,
      ...inspections,
    ];

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );

    setInspections(updated);

    // -----------------------------------------
    // PREPARE BACKEND DATA
    // -----------------------------------------

    const backendLocationId =
      Number(mineId.trim());

    const backendLatitude =
      Number(latitude);

    const backendLongitude =
      Number(longitude);

    const inspectorId =
      Number(
        localStorage.getItem(
          "coalguard_user_id"
        )
      ) || 1;

    // -----------------------------------------
    // CHECK BACKEND DATA
    // -----------------------------------------

    if (
      !Number.isInteger(
        backendLocationId
      ) ||
      backendLocationId <= 0
    ) {
      setStatusMessage(
        "Inspection saved locally. Enter a valid numeric Mine ID to sync with the backend."
      );
      return;
    }

    if (
      !Number.isFinite(
        backendLatitude
      ) ||
      !Number.isFinite(
        backendLongitude
      )
    ) {
      setStatusMessage(
        "Inspection saved locally. Capture GPS before syncing with the backend."
      );
      return;
    }

    // -----------------------------------------
    // SEND INSPECTION TO BACKEND
    // -----------------------------------------

    setStatusMessage(
      "Sending inspection to CoalGuard backend..."
    );

    try {
      const result =
        await submitInspection({
          inspector_id:
            inspectorId,

          location_id:
            backendLocationId,

          latitude:
            backendLatitude,

          longitude:
            backendLongitude,

          observation:
            observations.trim(),
        });

      console.log(
        "BACKEND INSPECTION CREATED:",
        result
      );

      setStatusMessage(
        "Inspection saved successfully to CoalGuard backend."
      );

    } catch (error) {
      console.error(
        "BACKEND INSPECTION FAILED:",
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown backend error";

      setStatusMessage(
        `Inspection saved locally, but backend sync failed: ${errorMessage}`
      );
    }

    // -----------------------------------------
    // CLOSE INSPECTION WINDOW
    // -----------------------------------------

    setShowInspection(false);

    // -----------------------------------------
    // RESET INSPECTION FORM
    // -----------------------------------------

    setCurrentInspectionId("");

    setMineId("");

    setMineLink("");

    setInspectorName("");

    setInspectionType(
      "Routine Inspection"
    );

    setSafetyStatus(
      "Pending"
    );

    setLatitude("");

    setLongitude("");
    setGpsMode("live");

    setObservations("");

    setEmergencyExit(
      "Not Checked"
    );

    setVentilation(
      "Not Checked"
    );

    setPpe(
      "Not Checked"
    );

    setElectrical(
      "Not Checked"
    );

    setFireSafety(
      "Not Checked"
    );

    setRemarks("");
  };


  const getAllSavedPhotos = (): PhotoEvidence[] => {
    const saved = localStorage.getItem(PHOTO_STORAGE_KEY);

    if (!saved) {
      return [];
    }

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const getSavedPhotosForInspection = (id: string) => {
    return getAllSavedPhotos().filter(
      (photo) => photo.inspectionId === id
    );
  };

  const deleteInspection = (id: string) => {
    const inspection = inspections.find(
      (item) => item.id === id
    );

    if (!inspection) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete inspection ${id} and all of its attached photo and voice evidence?`
    );

    if (!shouldDelete) {
      return;
    }

    const updatedInspections = inspections.filter(
      (item) => item.id !== id
    );

    const updatedPhotos = getAllSavedPhotos().filter(
      (photo) => photo.inspectionId !== id
    );

    const updatedVoiceNotes = getAllVoiceNotes().filter(
      (note) => note.inspectionId !== id
    );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedInspections)
    );

    localStorage.setItem(
      PHOTO_STORAGE_KEY,
      JSON.stringify(updatedPhotos)
    );

    localStorage.setItem(
      VOICE_STORAGE_KEY,
      JSON.stringify(updatedVoiceNotes)
    );

    setInspections(updatedInspections);
    setPhotoRefresh((value) => value + 1);
    setVoiceRefresh((value) => value + 1);

    if (currentInspectionId === id) {
      setCurrentInspectionId("");
    }
  };

  const downloadPhoto = (photo: PhotoEvidence) => {
    const link = document.createElement("a");
    link.href = photo.image;
    link.download = `coalguard-photo-${photo.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadVoice = (note: VoiceEvidence) => {
    if (!note.audio) {
      return;
    }

    const link = document.createElement("a");
    link.href = note.audio;
    link.download = `coalguard-voice-${note.id}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSavedVoiceNotesForInspection = (
    id: string
  ) => {
    return getAllVoiceNotes().filter(
      (note) => note.inspectionId === id
    );
  };

  return (
    <div className="cg-app">
      <style>{`
.cg-app{min-height:100vh;background:#0a0d0e;color:#e5e1d8}
.cg-header{position:relative;background:#111516;border-bottom:1px solid #293033;padding:0 30px}
.cg-header:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,#b87333 25%,#d6a85f 50%,#b87333 75%,transparent);opacity:.55}
.cg-header-inner{width:100%;max-width:1220px;margin:0 auto;min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.cg-logo{display:flex;align-items:center;gap:12px}
.cg-logo-mark{width:40px;height:40px;display:grid;place-items:center;background:#b87333;color:#0b0d0e;border-radius:4px;box-shadow:0 4px 12px rgba(184,115,51,.18)}
.cg-logo-title{margin:0;color:#f0ece4;font-family:Georgia,"Times New Roman",serif;font-size:24px;font-weight:700;letter-spacing:.01em}
.cg-logo-subtitle{margin:3px 0 0;color:#737a77;font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}
.cg-accent-text{color:#d6a85f!important}
.cg-inspector-status{width:42px;height:42px;display:grid;place-items:center;background:#191e20;border:1px solid #30383a;border-radius:4px;color:#d6a85f}
.cg-status-badge{display:inline-flex;align-items:center;gap:8px;margin:0 0 0 auto;padding:9px 13px;border:1px solid rgba(110,139,99,.35);border-radius:3px;background:rgba(110,139,99,.07);color:#9caf94;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.cg-status-dot{width:7px;height:7px;border-radius:50%;background:#6e8b63;box-shadow:0 0 8px rgba(110,139,99,.45)}
.cg-inspector-main{width:100%;max-width:1220px;margin:0 auto;padding:30px 30px 60px}
.cg-hero{position:relative;overflow:hidden;border:1px solid #30383a!important;border-radius:5px!important;background:#121719!important;box-shadow:0 16px 35px rgba(0,0,0,.22)}
.cg-hero:before{content:"";position:absolute;right:-120px;top:-170px;width:430px;height:430px;border:1px solid rgba(184,115,51,.12);border-radius:50%;box-shadow:0 0 0 42px rgba(184,115,51,.025),0 0 0 84px rgba(184,115,51,.018)}
.cg-hero:after{content:"";position:absolute;right:80px;bottom:-120px;width:300px;height:180px;background:linear-gradient(135deg,transparent 30%,rgba(184,115,51,.08));transform:skewX(-30deg)}
.cg-hero-content{position:relative;z-index:2;padding:34px 36px}
.cg-hero-grid{display:grid;grid-template-columns:1fr auto;gap:30px;align-items:center}
.cg-eyebrow{color:#c58a4a!important;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}
.cg-hero-title{margin:8px 0 0;color:#f0ece4;font-family:Georgia,"Times New Roman",serif;font-size:36px;line-height:1.15;font-weight:700}
.cg-hero-copy{max-width:650px;margin:12px 0 0;color:#919894;font-size:14px;line-height:1.7}
.cg-hero-actions{display:flex;align-items:center;gap:10px;margin-top:24px;flex-wrap:wrap}
.cg-hero-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:44px;padding:0 18px;border:1px solid #b87333;border-radius:3px;background:#b87333;color:#0b0d0e;font-size:10px;font-weight:800;letter-spacing:.07em}
.cg-hero-button:hover{background:#d6a85f;border-color:#d6a85f}
.cg-hero-secondary{border-color:#384144;background:#1a2022;color:#d8d2c7}
.cg-hero-secondary:hover{background:#22292b;border-color:#4a5457}
.cg-hero-emblem{width:112px;height:112px;display:grid;place-items:center;border:1px solid rgba(184,115,51,.3);border-radius:5px;background:rgba(184,115,51,.05);color:#d6a85f}
.cg-hero-meta{display:flex;gap:22px;margin-top:25px;padding-top:18px;border-top:1px solid #242b2d;flex-wrap:wrap}
.cg-meta-item{display:flex;align-items:center;gap:8px;color:#777f7b;font-size:10px;font-weight:600}
.cg-meta-value{color:#c9c4ba}
.cg-section{margin-top:30px}
.cg-section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:13px}
.cg-section-label{color:#707773;font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
.cg-section-title{margin:4px 0 0;color:#e8e3da;font-family:Georgia,"Times New Roman",serif;font-size:22px;font-weight:700}
.cg-section-note{color:#6f7673;font-size:10px}
.cg-tool-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.cg-tool-card{position:relative;min-height:154px;display:flex;flex-direction:column;justify-content:space-between;padding:17px!important;border:1px solid #2a3133!important;border-radius:4px!important;background:#14191b!important;box-shadow:none!important;color:#e5e1d8;overflow:hidden}
.cg-tool-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:#b87333;opacity:.7}
.cg-tool-card:hover{background:#1a2022!important;border-color:#3c4649!important;transform:translateY(-2px)}
.cg-tool-top{display:flex;align-items:center;justify-content:space-between}
.cg-tool-icon{width:42px;height:42px;display:grid;place-items:center;border:1px solid #30383a;border-radius:4px!important;background:#1d2325!important;color:#d6a85f}
.cg-tool-index{color:#555e5b;font-size:9px;font-weight:700;letter-spacing:.12em}
.cg-tool-title{margin-top:18px;color:#e7e2d9;font-family:Georgia,"Times New Roman",serif;font-size:16px;font-weight:700}
.cg-tool-desc{margin-top:4px;color:#747c78!important;font-size:11px;line-height:1.5}
.cg-tool-arrow{align-self:flex-end;color:#8b6a48;font-size:14px}
.cg-note-row{margin-top:10px;display:flex;align-items:center;gap:15px;padding:15px 17px!important;border:1px solid #2a3133!important;border-radius:4px!important;background:#14191b!important;color:#e5e1d8}.cg-note-card{grid-column:span 2;min-height:125px}
.cg-note-row:hover{background:#1a2022!important;border-color:#3c4649!important}.cg-note-card{margin-top:0}
.cg-note-copy{flex:1}
.cg-note-title{color:#e5e1d9;font-family:Georgia,"Times New Roman",serif;font-size:15px;font-weight:700}
.cg-note-desc{margin-top:3px;color:#747c78;font-size:11px}
.cg-panel{background:#121618;border:1px solid #2a3133;border-radius:4px!important;box-shadow:0 8px 20px rgba(0,0,0,.18)}
.cg-panel-header{padding:18px 20px;border-bottom:1px solid #252c2e}
.cg-panel-body{padding:20px}
.cg-kpi-card{border:1px solid #2a3133!important;border-radius:3px!important;background:#191e20!important}.cg-kpi-value{color:#d6a85f!important}
.cg-subpanel{border:1px solid #2a3133!important;border-radius:3px!important;background:#191e20!important;padding:14px}
.cg-input{border:1px solid #2a3133!important;border-radius:2px!important;background:#151a1c!important;color:#e5e1d8!important}.cg-input:focus{outline:none!important;border-color:#b87333!important;box-shadow:0 0 0 1px rgba(184,115,51,.25)!important}
.cg-button{min-height:38px;padding:9px 13px;border-radius:3px!important;border:1px solid #3a4244!important;background:transparent;color:#8e918d;text-transform:uppercase;letter-spacing:.05em;font-size:9px;font-weight:700}
.cg-button:hover{background:#22292b;color:#e5e1d8}.cg-button-primary{background:#b87333!important;border-color:#b87333!important;color:#0b0d0e!important}.cg-button-primary:hover{background:#d6a85f!important;border-color:#d6a85f!important}
.cg-button-secondary{background:#191e20!important;color:#e5e1d8!important}
.cg-message{border:1px solid #2a3133;border-radius:3px!important;background:#191e20!important}.cg-success-text{color:#91a787!important}.cg-danger-text{color:#c27a70!important}
.cg-icon-button{border:1px solid #2a3133;border-radius:3px!important;background:#191e20!important;color:#e5e1d8!important}
.cg-footer{border-top:1px solid #2a3133!important;color:#626966;margin-top:30px;padding-top:28px}
.cg-footer-title{color:#e5e1d8!important;font-family:Georgia,"Times New Roman",serif}
.cg-inspector-shell{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:calc(100vh - 70px);background:#080a0b}
.cg-inspector-sidebar{position:sticky;top:0;align-self:start;min-height:calc(100vh - 70px);padding:22px 14px;border-right:1px solid #252b2d;background:#0d1011}
.cg-inspector-sidebar-title{padding:4px 10px 18px;border-bottom:1px solid #252b2d}.cg-sidebar-kicker{display:block;font-size:9px;letter-spacing:.18em;color:#6f7a7d;font-weight:900;margin-bottom:5px}.cg-inspector-sidebar-title strong{font-size:19px;color:#f0f2f2}
.cg-inspector-nav{display:flex;flex-direction:column;gap:5px;padding-top:16px}.cg-inspector-nav-item{display:flex;align-items:center;gap:11px;width:100%;padding:12px 11px;border:1px solid transparent;border-radius:8px;background:transparent;color:#8e999c;font-size:12px;font-weight:900;text-align:left;cursor:pointer}.cg-inspector-nav-item:hover{background:#151a1b;color:#e6e8e8}.cg-inspector-nav-item.is-active{background:#1a1f20;border-color:#d7a536;color:#f0c35a;box-shadow:inset 3px 0 0 #d7a536}.cg-inspector-nav-icon{width:22px;text-align:center;font-size:16px}.cg-inspector-start-button{width:100%;margin-top:22px;padding:12px 10px;border:1px solid #d7a536;border-radius:8px;background:#d7a536;color:#101212;font-size:11px;font-weight:950;cursor:pointer}.cg-inspector-main{min-width:0}
.cg-inspector-main[data-inspector-active="dashboard"] [data-inspector-tab]:not([data-inspector-tab="dashboard"]),.cg-inspector-main[data-inspector-active="evidence"] [data-inspector-tab]:not([data-inspector-tab="evidence"]),.cg-inspector-main[data-inspector-active="compliance"] [data-inspector-tab]:not([data-inspector-tab="compliance"]),.cg-inspector-main[data-inspector-active="violations"] [data-inspector-tab]:not([data-inspector-tab="violations"]),.cg-inspector-main[data-inspector-active="records"] [data-inspector-tab]:not([data-inspector-tab="records"]),.cg-inspector-main[data-inspector-active="resources"] [data-inspector-tab]:not([data-inspector-tab="resources"]){display:none!important}
@media(max-width:850px){.cg-inspector-shell{grid-template-columns:1fr}.cg-inspector-sidebar{position:sticky;top:0;z-index:20;min-height:auto;padding:10px;border-right:0;border-bottom:1px solid #252b2d}.cg-inspector-sidebar-title{display:none}.cg-inspector-nav{flex-direction:row;overflow-x:auto;padding:0;gap:6px}.cg-inspector-nav-item{min-width:max-content;width:auto;padding:10px 12px}.cg-inspector-start-button{margin-top:9px}}
.cg-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:50;
  overflow:hidden;
  display:flex;
  align-items:flex-start;
  justify-content:center;
  background:rgba(5,6,6,.92)!important;
  backdrop-filter:blur(4px);
  padding:20px;
  box-sizing:border-box;
}
.cg-modal-center{
  display:flex;
  align-items:center;
  justify-content:center;
}
.cg-modal{
  width:100%;
  max-width:560px;
  max-height:calc(100vh - 40px);
  margin:0 auto;
  padding:22px!important;
  background:#121618!important;
  border:1px solid #2a3133;
  border-radius:4px!important;
  box-shadow:0 18px 50px rgba(0,0,0,.45);
  overflow-y:auto;
  overflow-x:hidden;
  overscroll-behavior:contain;
  box-sizing:border-box;
}
.cg-modal-wide{max-width:760px}
.cg-modal-top{z-index:60}
.cg-modal::-webkit-scrollbar{width:7px}
.cg-modal::-webkit-scrollbar-track{background:#0e1213}
.cg-modal::-webkit-scrollbar-thumb{background:#343c3e;border-radius:4px}
.cg-modal::-webkit-scrollbar-thumb:hover{background:#4b5659}
@media(max-width:700px){
  .cg-modal-backdrop{padding:12px}
  .cg-modal{max-height:calc(100vh - 24px);padding:18px!important}
}
@media(max-width:1000px){.cg-tool-grid{grid-template-columns:repeat(2,1fr)}.cg-hero-grid{grid-template-columns:1fr}.cg-hero-emblem{display:none}}
@media(max-width:700px){.cg-note-card{grid-column:span 2}.cg-header{padding:0 14px}.cg-header-inner{min-height:68px}.cg-status-badge{font-size:8px;padding:7px 9px}.cg-inspector-main{padding:18px 14px 40px}.cg-hero-content{padding:24px 20px}.cg-hero-title{font-size:29px}.cg-tool-grid{grid-template-columns:1fr 1fr;gap:8px}.cg-tool-card{min-height:142px;padding:14px!important}.cg-hero-meta{gap:12px}.cg-logo-title{font-size:21px}}
@media(max-width:480px){.cg-note-card{grid-column:span 1}.cg-tool-grid{grid-template-columns:1fr}.cg-hero-title{font-size:26px}}
`}</style>



      <div className="cg-inspector-shell">
        <aside className="cg-inspector-sidebar" aria-label="Inspector navigation">
          <div className="cg-inspector-sidebar-title">
            <span className="cg-sidebar-kicker">FIELD CONTROL</span>
            <strong>Inspector</strong>
          </div>
          <nav className="cg-inspector-nav">
            {[
              ["dashboard", "⌂", "Dashboard"],
               ["evidence", "◉", "Evidence Tools"],
              ["compliance", "▣", "Compliance"],
              ["violations", "!", "Violations"],
              ["records", "▤", "Records"],
              ["resources", "?", "Resources"],
            ].map(([id, icon, label]) => (
              <button key={id} type="button" className={`cg-inspector-nav-item ${activeTab === id ? "is-active" : ""}`} onClick={() => setActiveTab(id as InspectorTab)}>
                <span className="cg-inspector-nav-icon">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="cg-inspector-start-button" onClick={openInspection}>+ NEW INSPECTION</button>
        </aside>

        <main className="cg-inspector-main" data-inspector-active={activeTab}>

        <section className="cg-hero" data-inspector-tab="dashboard">
          <div className="cg-hero-content">
            <div className="cg-hero-grid">
              <div>
                <p className="cg-eyebrow">FIELD OPERATIONS / NEW INSPECTION</p>

                <h2 className="cg-hero-title">
                  Ready to inspect?
                </h2>

                <p className="cg-hero-copy">
                  Start a verified mine safety inspection, capture geo-tagged
                  evidence, and submit findings for compliance review.
                </p>

                <div className="cg-hero-actions">
                  <button
                    type="button"
                    onClick={openInspection}
                    className="cg-hero-button"
                  >
                    START INSPECTION
                    <span>→</span>
                  </button>

                  {inspections.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowSaved(true)}
                      className="cg-hero-button cg-hero-secondary"
                    >
                      VIEW RECORDS
                    </button>
                  )}
                </div>

                <div className="cg-hero-meta">
                  <div className="cg-meta-item">
                    <span className="cg-status-dot" />
                    <span>System</span>
                    <span className="cg-meta-value">Operational</span>
                  </div>

                  <div className="cg-meta-item">
                    <span>Saved inspections</span>
                    <span className="cg-meta-value">{inspections.length}</span>
                  </div>

                  <div className="cg-meta-item">
                    <span>Evidence</span>
                    <span className="cg-meta-value">GPS · Photo · Voice</span>
                  </div>
                </div>
              </div>

              <div className="cg-hero-emblem" aria-hidden="true">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4 18 7-12 3 3-7 12" />
                  <path d="m11 6 4 0 4 4" />
                  <path d="M14 15h6" />
                  <path d="M6 20h14" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        <section className="cg-section" data-inspector-tab="evidence">
          <div className="cg-section-head">
            <div>
              <p className="cg-section-label">Field Tools</p>
              <h2 className="cg-section-title">Inspection Toolkit</h2>
            </div>
            <p className="cg-section-note">Verified evidence collection</p>
          </div>

          <div className="cg-tool-grid">

            <button
              type="button"
              onClick={() => setShowQR(true)}
              className="cg-tool-card"
            >
              <div className="cg-tool-top">
                <div className="cg-tool-icon">
                  <ToolIcon type="qr" />
                </div>
                <span className="cg-tool-index">01</span>
              </div>
              <div>
                <h3 className="cg-tool-title">Scan QR</h3>
                <p className="cg-tool-desc">Identify and link the mine to the inspection.</p>
              </div>
              <span className="cg-tool-arrow">→</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGPS(true)}
              className="cg-tool-card"
            >
              <div className="cg-tool-top">
                <div className="cg-tool-icon">
                  <ToolIcon type="gps" />
                </div>
                <span className="cg-tool-index">02</span>
              </div>
              <div>
                <h3 className="cg-tool-title">GPS Verification</h3>
                <p className="cg-tool-desc">Capture the current inspection location.</p>
              </div>
              <span className="cg-tool-arrow">→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!currentInspectionId) {
                  const newId = "INS-" + Date.now().toString();
                  setCurrentInspectionId(newId);
                }
                setShowPhoto(true);
              }}
              className="cg-tool-card"
            >
              <div className="cg-tool-top">
                <div className="cg-tool-icon">
                  <ToolIcon type="photo" />
                </div>
                <span className="cg-tool-index">03</span>
              </div>
              <div>
                <h3 className="cg-tool-title">Photo Evidence</h3>
                <p className="cg-tool-desc">Capture visual evidence with inspection metadata.</p>
              </div>
              <span className="cg-tool-arrow">→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!currentInspectionId) {
                  const newId = "INS-" + Date.now().toString();
                  setCurrentInspectionId(newId);
                }
                setShowVoice(true);
              }}
              className="cg-tool-card"
            >
              <div className="cg-tool-top">
                <div className="cg-tool-icon">
                  <ToolIcon type="voice" />
                </div>
                <span className="cg-tool-index">04</span>
              </div>
              <div>
                <h3 className="cg-tool-title">Voice Note</h3>
                <p className="cg-tool-desc">Record a field observation hands-free.</p>
              </div>
              <span className="cg-tool-arrow">→</span>
            </button>

          </div>

          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="cg-tool-card cg-note-card"
          >
            <div className="cg-tool-top">
              <div className="cg-tool-icon">
                <ToolIcon type="note" />
              </div>
              <span className="cg-tool-index">05</span>
            </div>

            <div>
              <h3 className="cg-tool-title">Inspection Notes</h3>
              <p className="cg-tool-desc">
                Record a detailed manual observation or field remark.
              </p>
            </div>

            <span className="cg-tool-arrow">→</span>
          </button>
        </section>

        <div data-inspector-tab="compliance"><ComplianceManagement /></div>
        <div data-inspector-tab="violations"><ViolationsManagement /></div> 
        <section className="cg-panel" data-inspector-tab="records">

          <div className="cg-header-inner">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Inspection Records
              </p>

              <h3 className="mt-1 text-lg font-bold">
                Saved Inspections
              </h3>
            </div>

            <div className="rounded-full bg-cyan-400/10 px-3 py-2 text-xs font-bold cg-accent-text">
              {inspections.length}
            </div>
          </div>

          {inspections.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSaved(true)}
              className="mt-4 w-full cg-button cg-button-primary"
            >
              VIEW SAVED INSPECTIONS →
            </button>
          )}

          {inspections.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">
              No inspections saved yet.
            </p>
          )}
        </section>

        <section className="mt-8" data-inspector-tab="resources">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Resources & Support
          </p>

          <h2 className="mt-1 text-xl font-bold">
            Coal Governance Resources
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowMinistry(true)}
              className="rounded-3xl border border-yellow-400/20 bg-slate-800 p-5 text-left shadow-xl transition hover:border-yellow-400/40 hover:bg-slate-750"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-xl">
                  🏛️
                </div>
                <div>
                  <h3 className="font-black">Indian Coal Ministry</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Official coal-sector information
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowContact(true)}
              className="rounded-3xl border border-cyan-400/20 bg-slate-800 p-5 text-left shadow-xl transition hover:border-cyan-400/40 hover:bg-slate-750"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-xl">
                  📞
                </div>
                <div>
                  <h3 className="font-black">Contact & Support</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Help and official contact details
                  </p>
                </div>
              </div>
            </button>
          </div>
        </section>

        <section className="cg-panel" data-inspector-tab="dashboard">
          <div className="cg-header-inner">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                System Status
              </p>

              <h3 className="mt-1 text-lg font-bold">
                All Systems Ready
              </h3>
            </div>

            <div className="cg-logo rounded-full bg-green-400/10 px-3 py-2 text-xs font-bold cg-success-text">
              <span className="cg-status-dot" />
              ONLINE
            </div>
          </div>
        </section>

        {/* Privacy / legal footer */}
        <footer className="cg-footer">
          <div className="text-center">
            <p className="cg-footer-title">
              COALGUARD
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Mine Safety & Compliance Platform
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className="font-semibold text-slate-400 transition hover:cg-accent-text"
              >
                Privacy & Data Protection
              </button>

              <button
                type="button"
                onClick={() => setShowContact(true)}
                className="font-semibold text-slate-400 transition hover:cg-accent-text"
              >
                Contact Us
              </button>
            </div>

            <p className="mt-5 text-[11px] leading-5 text-slate-600">
              Camera • Microphone • GPS • Photos • Inspection Data
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              © 2026 CoalGuard. For responsible digital governance in coal mining.
            </p>
          </div>
        </footer>

      </main>
      </div>

      {showMinistry && (
        <div className="cg-modal-backdrop">
          <div className="cg-modal cg-modal-wide">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest cg-accent-text">
                  OFFICIAL RESOURCE
                </p>
                <h2 className="cg-section-title">
                  Ministry of Coal, Government of India
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMinistry(false)}
                className="cg-icon-button"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 cg-subpanel">
              <p className="text-sm leading-6 text-slate-300">
                The Ministry of Coal is responsible for policies and strategies concerning the exploration and development of coal and lignite reserves in India, along with related production, supply, distribution and regulatory matters.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Official Portal
                </p>
                <p className="mt-2 text-sm font-bold text-slate-200">
                  coal.gov.in
                </p>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Relevance to CoalGuard
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Reference point for coal-sector governance and regulatory information.
                </p>
              </div>
            </div>

            <a
              href="https://www.coal.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 block w-full cg-button cg-button-primary"
            >
              OPEN OFFICIAL MINISTRY WEBSITE →
            </a>
          </div>
        </div>
      )}

      {showContact && (
        <div className="cg-modal-backdrop">
          <div className="cg-modal cg-modal-wide">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest cg-accent-text">
                  SUPPORT
                </p>
                <h2 className="cg-section-title">
                  Contact & Support
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowContact(false)}
                className="cg-icon-button"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="cg-subpanel">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  CoalGuard Support
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  For application support, technical issues, or demo assistance, contact the CoalGuard project team.
                </p>
              </div>

              <div className="cg-subpanel">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Ministry of Coal — Official Contact
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Ministry of Coal, GPOA-3, Netaji Nagar, New Delhi - 110023
                </p>
                <p className="mt-2 text-sm font-bold cg-accent-text">
                  Phone: 011-20903117
                </p>
              </div>
            </div>

            <a
              href="https://www.coal.gov.in/contact-us"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 block w-full cg-button cg-button-primary"
            >
              VIEW OFFICIAL CONTACT PAGE →
            </a>
          </div>
        </div>
      )}

      {showInspection && (
        <div className="cg-modal-backdrop">

          <div className="cg-modal cg-modal-wide">

            <div className="mb-6 cg-header-inner">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest cg-accent-text">
                  NEW RECORD
                </p>

                <h2 className="text-2xl font-black">
                  Mine Safety Inspection
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {currentInspectionId}
                </p>
              </div>

              <button
                type="button"
                onClick={closeInspection}
                className="cg-icon-button"
              >
                ✕
              </button>
            </div>

            <div className="cg-subpanel">
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Automatic
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Inspection date and record ID are generated automatically.
              </p>
            </div>

            <div className="mt-5">
              <h3 className="font-black cg-accent-text">
                ⛏️ Mine Information
              </h3>

              <input
                value={mineId}
                onChange={(event) =>
                  setMineId(event.target.value)
                }
                placeholder="Mine ID"
                className="mt-3 w-full cg-input"
              />

              <input
                value={mineLink}
                onChange={(event) =>
                  setMineLink(event.target.value)
                }
                placeholder="Mine / QR link"
                className="mt-3 w-full cg-input"
              />

              <button
                type="button"
                onClick={() => setShowQR(true)}
                className="mt-3 w-full cg-button cg-button-secondary"
              >
                <ToolIcon type="qr" /> SCAN MINE QR
              </button>
            </div>

            <div className="mt-5">
              <h3 className="font-black cg-accent-text">
                👷 Inspector Details
              </h3>

              <input
                value={inspectorName}
                onChange={(event) =>
                  setInspectorName(event.target.value)
                }
                placeholder="Inspector name"
                className="mt-3 w-full cg-input"
              />

              <select
                value={inspectionType}
                onChange={(event) =>
                  setInspectionType(event.target.value)
                }
                className="mt-3 w-full cg-input"
              >
                <option>Routine Inspection</option>
                <option>Emergency Inspection</option>
                <option>Follow-up Inspection</option>
                <option>Compliance Inspection</option>
              </select>
            </div>

            <div className="mt-5">
              <h3 className="font-black cg-accent-text">
                🚦 Overall Safety Status
              </h3>

              <select
                value={safetyStatus}
                onChange={(event) =>
                  setSafetyStatus(event.target.value)
                }
                className="mt-3 w-full cg-input"
              >
                <option>Pending</option>
                <option>Safe</option>
                <option>Warning</option>
                <option>Critical</option>
              </select>
            </div>

            <div className="mt-5">
              <h3 className="font-black cg-accent-text">
                <ToolIcon type="gps" /> Location
              </h3>

              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  GPS Mode
                </p>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGpsMode("live")}
                    className={`rounded-xl py-3 text-sm font-black ${
                      gpsMode === "live"
                        ? "bg-cyan-500 text-slate-950"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    📍 LIVE GPS
                  </button>

                  <button
                    type="button"
                    onClick={useDemoGPS}
                    className={`rounded-xl py-3 text-sm font-black ${
                      gpsMode === "demo"
                        ? "bg-yellow-400 text-slate-950"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    🧪 DEMO GPS
                  </button>
                </div>

                {gpsMode === "demo" && (
                  <p className="mt-3 text-xs leading-5 text-yellow-300">
                    Demo mode uses the registered test-mine coordinates. This is for demonstrations only; the backend still performs the 30-meter geofence check.
                  </p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">

                <input
                  value={latitude}
                  onChange={(event) =>
                    setLatitude(event.target.value)
                  }
                  placeholder="Latitude"
                  className="w-full cg-input"
                />

                <input
                  value={longitude}
                  onChange={(event) =>
                    setLongitude(event.target.value)
                  }
                  placeholder="Longitude"
                  className="w-full cg-input"
                />

              </div>

              <button
                type="button"
                onClick={gpsMode === "demo" ? useDemoGPS : getGPS}
                className="mt-3 w-full cg-button cg-button-primary"
              >
                <ToolIcon type="gps" /> {gpsMode === "demo" ? "USE DEMO MINE GPS" : "CAPTURE CURRENT GPS"}
              </button>
            </div>

            <div className="mt-5">
              <h3 className="font-black cg-success-text">
                ☑️ Safety Checklist
              </h3>

              <select
                value={emergencyExit}
                onChange={(event) =>
                  setEmergencyExit(event.target.value)
                }
                className="mt-3 w-full cg-input"
              >
                <option>Emergency Exit — Not Checked</option>
                <option>Emergency Exit — Safe</option>
                <option>Emergency Exit — Warning</option>
                <option>Emergency Exit — Critical</option>
              </select>

              <select
                value={ventilation}
                onChange={(event) =>
                  setVentilation(event.target.value)
                }
                className="mt-3 w-full cg-input"
              >
                <option>Ventilation — Not Checked</option>
                <option>Ventilation — Safe</option>
                <option>Ventilation — Warning</option>
                <option>Ventilation — Critical</option>
              </select>

              <select
                value={ppe}
                onChange={(event) =>
                  setPpe(event.target.value)
                }
                className="mt-3 w-full cg-input"
              >
                <option>PPE — Not Checked</option>
                <option>PPE — Safe</option>
                <option>PPE — Warning</option>
                <option>PPE — Critical</option>
              </select>

              <select
                value={electrical}
                onChange={(event) =>
                  setElectrical(event.target.value)
                }
                className="mt-3 w-full cg-input"
              >
                <option>Electrical Safety — Not Checked</option>
                <option>Electrical Safety — Safe</option>
                <option>Electrical Safety — Warning</option>
                <option>Electrical Safety — Critical</option>
              </select>

              <select
                value={fireSafety}
                onChange={(event) =>
                  setFireSafety(event.target.value)
                }
                className="mt-3 w-full cg-input"
              >
                <option>Fire Safety — Not Checked</option>
                <option>Fire Safety — Safe</option>
                <option>Fire Safety — Warning</option>
                <option>Fire Safety — Critical</option>
              </select>
            </div>

            <div className="mt-5">
              <h3 className="font-black cg-accent-text">
                <ToolIcon type="note" /> Observations
              </h3>

              <textarea
                value={observations}
                onChange={(event) =>
                  setObservations(event.target.value)
                }
                placeholder="Describe what was observed during the inspection..."
                className="mt-3 h-32 w-full resize-none cg-input"
              />
            </div>

            <div className="mt-5">
              <h3 className="font-black cg-accent-text">
                📌 Additional Remarks
              </h3>

              <textarea
                value={remarks}
                onChange={(event) =>
                  setRemarks(event.target.value)
                }
                placeholder="Additional remarks..."
                className="mt-3 h-24 w-full resize-none cg-input"
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">

              <div className="cg-kpi-card">
                <p className="text-xs text-slate-400">
                  Evidence Photos
                </p>

                <p className="mt-1 cg-kpi-value">
                  {getPhotoCount()}
                </p>
              </div>

              <div className="cg-kpi-card">
                <p className="text-xs text-slate-400">
                  Voice Notes
                </p>

                <p className="mt-1 cg-kpi-value">
                  {getVoiceCount()}
                </p>
              </div>

            </div>

            <button
              type="button"
              onClick={() => {
                if (!currentInspectionId) {
                  setStatusMessage(
                    "Start an inspection first."
                  );
                  return;
                }

                setShowPhoto(true);
              }}
              className="mt-4 w-full cg-button cg-button-secondary"
            >
              <ToolIcon type="photo" /> OPEN PHOTO EVIDENCE
            </button>

            <button
              type="button"
              onClick={() => {
                if (!currentInspectionId) {
                  setStatusMessage(
                    "Start an inspection first."
                  );
                  return;
                }

                setShowVoice(true);
              }}
              className="mt-3 w-full cg-button cg-button-secondary"
            >
              <ToolIcon type="voice" /> OPEN VOICE EVIDENCE
            </button>

            {statusMessage && (
              <div className="mt-4 cg-message">
                {statusMessage}
              </div>
            )}

            <button
              type="button"
              onClick={saveInspection}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 py-4 font-black text-slate-950"
            >
              💾 SAVE INSPECTION
            </button>

            <button
              type="button"
              onClick={closeInspection}
              className="mt-3 w-full cg-button cg-button-secondary"
            >
              CANCEL
            </button>

          </div>
        </div>
      )}

      {showGPS && (
        <div className="cg-modal-backdrop">
          <div className="cg-modal">

            <div className="mb-4 cg-header-inner">
              <h2 className="text-xl font-black">
                <ToolIcon type="gps" /> GPS Location
              </h2>

              <button
                type="button"
                onClick={() => setShowGPS(false)}
                className="rounded-full bg-white/10 px-4 py-2"
              >
                ✕
              </button>
            </div>

            <GPSLocator />

          </div>
        </div>
      )}

      {showPhoto && (
        <div className="cg-modal-backdrop">
          <div className="cg-modal">

            <div className="mb-4 cg-header-inner">
              <h2 className="text-xl font-black">
                <ToolIcon type="photo" /> Evidence Photo
              </h2>

              <button
                type="button"
                onClick={() => setShowPhoto(false)}
                className="rounded-full bg-white/10 px-4 py-2"
              >
                ✕
              </button>
            </div>

            <PhotoWatermark
              inspectionId={
                currentInspectionId
              }
              onPhotoSaved={
                handlePhotoSaved
              }
            />

          </div>
        </div>
      )}

      {showVoice && (
        <div className="cg-modal-backdrop">

          <div className="cg-modal">

            <div className="mb-4 cg-header-inner">

              <h2 className="text-xl font-black">
                <ToolIcon type="voice" /> Voice Note
              </h2>

              <button
                type="button"
                onClick={() => setShowVoice(false)}
                className="rounded-full bg-white/10 px-4 py-2"
              >
                ✕
              </button>

            </div>

            <VoiceRecorder
              key={
                currentInspectionId +
                "-" +
                voiceRefresh
              }
              inspectionId={
                currentInspectionId
              }
              onVoiceSaved={
                handleVoiceSaved
              }
              onTranscript={(text) => {
                setObservations((current) =>
                  current.trim() ? `${current.trim()} ${text}`.trim() : text
                );
                setStatusMessage("Whisper transcript added to the Observation field.");
              }}
            />

          </div>
        </div>
      )}

      {showNote && (
        <div className="cg-modal-backdrop">
          <div className="cg-modal">

            <div className="mb-4 cg-header-inner">
              <h2 className="text-xl font-black">
                ✍️ Manual Note
              </h2>

              <button
                type="button"
                onClick={() => setShowNote(false)}
                className="rounded-full bg-white/10 px-4 py-2"
              >
                ✕
              </button>
            </div>

            <ManualNote />

          </div>
        </div>
      )}

      {showQR && (
        <div className="cg-modal-backdrop cg-modal-top">

          <div className="cg-modal">

            <div className="mb-5 cg-header-inner">

              <div>
                <h2 className="text-xl font-black">
                  <ToolIcon type="qr" /> Scan Mine QR
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Scan the QR code attached to the mine.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowQR(false)}
                className="cg-icon-button"
              >
                ✕
              </button>
            </div>

            <QRScanner
              onScan={handleQRScan}
            />

            <button
              type="button"
              onClick={() => setShowQR(false)}
              className="mt-4 w-full cg-button cg-button-secondary text-white"
            >
              CLOSE SCANNER
            </button>

          </div>
        </div>
      )}

      {showSaved && (
        <div className="cg-modal-backdrop">

          <div className="cg-modal cg-modal-wide">

            <div className="mb-5 cg-header-inner">

              <div>
                <p className="text-xs font-bold uppercase tracking-widest cg-accent-text">
                  RECORDS
                </p>

                <h2 className="text-2xl font-black">
                  Saved Inspections
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowSaved(false)}
                className="cg-icon-button"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">

              {inspections.map(
                (inspection) => {

                  const voiceNotes =
                    getSavedVoiceNotesForInspection(
                      inspection.id
                    );

                  const photos =
                    getSavedPhotosForInspection(
                      inspection.id
                    );

                  return (
                    <div
                      key={inspection.id}
                      className="cg-subpanel"
                    >

                      <div className="flex items-start justify-between">

                        <div>
                          <p className="font-black cg-accent-text">
                            {inspection.id}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {inspection.dateTime}
                          </p>
                        </div>

                        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold cg-accent-text">
                          {inspection.safetyStatus}
                        </span>

                      </div>

                      <div className="mt-4 space-y-2 text-sm">

                        <p>
                          <span className="text-slate-500">
                            Mine:
                          </span>{" "}
                          {inspection.mineId ||
                            inspection.mineLink}
                        </p>

                        <p>
                          <span className="text-slate-500">
                            Inspector:
                          </span>{" "}
                          {inspection.inspectorName}
                        </p>

                        <p>
                          <span className="text-slate-500">
                            Type:
                          </span>{" "}
                          {inspection.inspectionType}
                        </p>

                        <p>
                          <span className="text-slate-500">
                            GPS:
                          </span>{" "}
                          {inspection.latitude &&
                          inspection.longitude
                            ? inspection.latitude +
                              ", " +
                              inspection.longitude
                            : "Not captured"}
                        </p>

                        <p>
                          <span className="text-slate-500">
                            Evidence:
                          </span>{" "}
                          {photos.length} photo(s),{" "}
                          {voiceNotes.length} voice note(s)
                        </p>

                      </div>

                      {voiceNotes.length > 0 && (
                        <div className="mt-4 rounded-xl border border-green-400/20 bg-green-400/5 p-3">

                          <p className="text-xs font-bold uppercase tracking-widest cg-success-text">
                            <ToolIcon type="voice" /> Voice Evidence
                          </p>

                          <div className="mt-3 space-y-3">

                            {voiceNotes.map(
                              (note) => (
                                <div
                                  key={note.id}
                                  className="rounded-xl bg-black/20 p-3"
                                >

                                  {note.audio ? (
                                    <audio
                                      controls
                                      src={note.audio}
                                      className="w-full"
                                    />
                                  ) : (
                                    <p className="text-sm text-slate-300">
                                      {note.text ||
                                        "Voice note has no audio data."}
                                    </p>
                                  )}

                                  <div className="mt-2 cg-header-inner gap-3">
                                    <p className="text-xs text-slate-500">
                                      {note.timestamp}
                                    </p>

                                    {note.audio && (
                                      <button
                                        type="button"
                                        onClick={() => downloadVoice(note)}
                                        className="text-xs font-bold cg-accent-text"
                                      >
                                        ⬇️ DOWNLOAD
                                      </button>
                                    )}
                                  </div>

                                </div>
                              )
                            )}

                          </div>
                        </div>
                      )}

                      {photos.length > 0 && (
                        <div className="mt-4 rounded-xl border border-orange-400/20 bg-orange-400/5 p-3">
                          <p className="text-xs font-bold uppercase tracking-widest cg-accent-text">
                            <ToolIcon type="photo" /> Photo Evidence
                          </p>

                          <div className="mt-3 space-y-4">
                            {photos.map((photo, index) => (
                              <div
                                key={photo.id}
                                className="rounded-xl bg-black/20 p-3"
                              >
                                <p className="text-sm font-bold cg-accent-text">
                                  Photo #{index + 1}
                                </p>

                                <img
                                  src={photo.image}
                                  alt="Mine safety inspection evidence"
                                  className="mt-3 w-full rounded-xl"
                                />

                                <div className="mt-3 cg-header-inner gap-3">
                                  <span className="text-xs text-slate-500">
                                    🕒 {photo.timestamp}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => downloadPhoto(photo)}
                                    className="text-xs font-bold cg-accent-text"
                                  >
                                    ⬇️ DOWNLOAD
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {inspection.observations && (
                        <div className="mt-4 rounded-xl bg-black/20 p-3">

                          <p className="text-xs font-bold text-slate-500">
                            OBSERVATIONS
                          </p>

                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                            {inspection.observations}
                          </p>

                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          deleteInspection(
                            inspection.id
                          )
                        }
                        className="mt-4 w-full rounded-xl border border-red-400/20 bg-red-400/10 py-3 text-sm font-black cg-danger-text"
                      >
                        🗑️ DELETE INSPECTION + ALL EVIDENCE
                      </button>

                    </div>
                  );
                }
              )}

            </div>

          </div>
        </div>
      )}


      {showPrivacy && (
        <div className="cg-modal-backdrop cg-modal-center">
          <div className="cg-modal cg-modal-wide">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] cg-accent-text">
                  Privacy & Data Protection
                </p>
                <h2 className="cg-section-title">
                  How CoalGuard uses device permissions
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowPrivacy(false)}
                className="cg-icon-button"
              >
                ✕
              </button>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-300">
              CoalGuard requests device permissions only when a feature needs them.
              The purpose is to support mine inspections, evidence collection,
              compliance monitoring and audit records.
            </p>

            <div className="mt-6 space-y-3">
              <div className="cg-subpanel">
                <h3 className="font-bold text-slate-100">📷 Camera</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Used when you choose to scan a QR code or capture inspection
                  photographs. CoalGuard should not require camera access when
                  those features are not being used.
                </p>
              </div>

              <div className="cg-subpanel">
                <h3 className="font-bold text-slate-100"><ToolIcon type="gps" /> Location / GPS</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Used when you choose to capture an inspection location.
                  Location coordinates can be associated with inspection records
                  to provide a geographic reference for field observations.
                </p>
              </div>

              <div className="cg-subpanel">
                <h3 className="font-bold text-slate-100"><ToolIcon type="voice" /> Microphone</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Used only when you choose to record a voice observation.
                  The recording is associated with the relevant inspection.
                </p>
              </div>

              <div className="cg-subpanel">
                <h3 className="font-bold text-slate-100">🖼️ Photos & Evidence</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Photos and audio captured through CoalGuard are intended to
                  support inspection evidence. Avoid recording unrelated private
                  information where it is not necessary for the inspection.
                </p>
              </div>

              <div className="cg-subpanel">
                <h3 className="font-bold text-slate-100">📋 Inspection Data</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Inspection details, observations, timestamps, location data and
                  evidence may be used for safety monitoring, compliance tracking,
                  reporting and audit purposes.
                </p>
              </div>

              <div className="cg-subpanel">
                <h3 className="font-bold text-slate-100">🔐 User control</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  You can manage browser permissions through your device or
                  browser settings. CoalGuard should request access only for the
                  feature that needs it. Where consent is the applicable basis for
                  processing personal data, users should be given clear information
                  about the data and purpose before consent is requested.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4">
              <p className="text-xs leading-5 text-slate-400">
                This notice is designed for the CoalGuard prototype and should be
                updated to reflect the final production architecture, storage,
                retention, sharing and security practices before real deployment.
                It is not a substitute for legal advice.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowPrivacy(false)}
              className="mt-6 w-full cg-button cg-button-primary"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default InspectorMobileView;
