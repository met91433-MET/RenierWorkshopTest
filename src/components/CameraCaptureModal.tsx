import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, Check, X, Trash2, SwitchCamera, AlertCircle, Upload } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotosCaptured: (files: File[]) => void;
  title?: string;
  categoryName?: string;
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onPhotosCaptured,
  title = "Take Photos",
  categoryName
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedPhotos, setCapturedPhotos] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [flashActive, setFlashActive] = useState(false);

  // Initialize camera stream when modal opens or facingMode changes
  useEffect(() => {

    if (!isOpen) {
      stopCamera();
      setCapturedPhotos([]);
      setCameraError(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setIsInitializing(true);
    setCameraError(null);
    stopCamera();

    try {
      const mediaConstraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn("Camera stream initialization error:", err);
      let msg = "Could not access camera on this device.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Camera permission was denied. Please allow camera access in your browser settings or use native file upload.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = "No camera hardware detected on this device.";
      }
      setCameraError(msg);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const takeSnap = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flash effect
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `photo_${timestamp}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);

      setCapturedPhotos(prev => [
        ...prev,
        { id: Math.random().toString(36).substring(2, 9), file, previewUrl }
      ]);
    }, 'image/jpeg', 0.9);
  };

  const handleRemovePhoto = (id: string) => {
    setCapturedPhotos(prev => {
      const target = prev.find(p => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const handleConfirmUpload = () => {
    if (capturedPhotos.length === 0) return;
    const files = capturedPhotos.map(p => p.file);
    onPhotosCaptured(files);
    onClose();
  };

  const handleNativeCameraSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);
    
    // Add natively captured files to queue
    const newItems = filesArray.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      previewUrl: URL.createObjectURL(file as Blob)
    }));

    setCapturedPhotos(prev => [...prev, ...newItems]);
    // Reset file input value
    if (nativeFileInputRef.current) {
      nativeFileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                {title}
                {categoryName && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded-full uppercase border border-slate-700">
                    {categoryName}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">Point device camera & snap photos directly</p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewfinder Area */}
        <div className="relative bg-black flex-1 min-h-[300px] max-h-[480px] flex items-center justify-center overflow-hidden">
          {/* Flash Effect */}
          {flashActive && <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-150" />}

          {/* Video Stream */}
          {!cameraError ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-6 text-center max-w-md space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-300 leading-relaxed">{cameraError}</p>
              
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => nativeFileInputRef.current?.click()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Use Device Native Camera App
                </button>
              </div>
            </div>
          )}

          {/* Viewfinder Controls Overlay */}
          {!cameraError && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFacingMode}
                className="p-2.5 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full backdrop-blur-md border border-white/10 transition-all cursor-pointer"
                title="Switch Camera (Front/Back)"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Shutter Bar Overlay */}
          {!cameraError && (
            <div className="absolute bottom-4 inset-x-0 z-20 flex items-center justify-center gap-4 px-4">
              {/* Native Mobile Camera Trigger Backup */}
              <button
                type="button"
                onClick={() => nativeFileInputRef.current?.click()}
                className="p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-full border border-slate-700/80 text-xs font-medium backdrop-blur-md flex items-center gap-1.5 cursor-pointer shadow-lg"
                title="Open Camera App"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Camera App</span>
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={takeSnap}
                disabled={isInitializing}
                className="w-16 h-16 rounded-full border-4 border-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center shadow-2xl cursor-pointer"
                title="Take Photo"
              >
                <div className="w-12 h-12 rounded-full border-2 border-slate-900/30 bg-red-500" />
              </button>

              {/* Retry stream if needed */}
              <button
                type="button"
                onClick={startCamera}
                className="p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-full border border-slate-700/80 text-xs font-medium backdrop-blur-md flex items-center gap-1.5 cursor-pointer shadow-lg"
                title="Restart Stream"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Hidden File Input with native capture attribute */}
          <input
            ref={nativeFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleNativeCameraSelect}
            className="hidden"
          />
        </div>

        {/* Captured Photos Queue Bar */}
        {capturedPhotos.length > 0 && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Captured Photos ({capturedPhotos.length})</span>
              <button
                type="button"
                onClick={() => setCapturedPhotos([])}
                className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer"
              >
                Clear All
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {capturedPhotos.map((photo, idx) => (
                <div key={photo.id} className="relative group flex-shrink-0 w-16 h-16 rounded-xl border border-slate-700 overflow-hidden bg-slate-900">
                  <img src={photo.previewUrl} alt={`Captured ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(photo.id)}
                    className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-md hover:bg-red-600 opacity-90 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmUpload}
            disabled={capturedPhotos.length === 0}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
              capturedPhotos.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Use {capturedPhotos.length} Photo{capturedPhotos.length === 1 ? '' : 's'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
