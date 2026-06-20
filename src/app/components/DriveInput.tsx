"use client";

import { useState } from "react";

interface DriveInputProps {
  value: string;
  onChange: (value: string) => void;
  onFolderIdExtracted: (folderId: string | null) => void;
}

export default function DriveInput({
  value,
  onChange,
  onFolderIdExtracted,
}: DriveInputProps) {
  const [showGuide, setShowGuide] = useState(false);

  function extractFolderId(url: string): string | null {
    if (!url) return null;

    const patterns = [
      /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
      /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
      /id=([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) {
      return url.trim();
    }

    return null;
  }

  function handleChange(newValue: string) {
    onChange(newValue);
    const folderId = extractFolderId(newValue);
    onFolderIdExtracted(folderId);
  }

  const folderId = extractFolderId(value);
  const isValid = folderId !== null;
  const hasValue = value.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            📁 Step 2: Google Drive Folder Link
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Apni images ka public Drive folder link paste karo
          </p>
        </div>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          📖 Guide {showGuide ? "▲" : "▼"}
        </button>
      </div>

      {/* Guide */}
      {showGuide && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 space-y-3">
          <p className="font-semibold">
            🔧 Google Drive Folder Public Karne Ka Tarika:
          </p>
          <ol className="space-y-2 ml-4 list-decimal">
            <li>Google Drive kholein</li>
            <li>
              Images wala folder right-click karein → &quot;Share&quot; → &quot;Share&quot;
            </li>
            <li>
              &quot;General access&quot; mein{" "}
              <strong>&quot;Anyone with the link&quot;</strong> select karein
            </li>
            <li>Permission: &quot;Viewer&quot; rakhen (default)</li>
            <li>&quot;Copy link&quot; karein aur yahan paste karein</li>
          </ol>
          <div className="mt-2 p-2 bg-green-100 rounded text-xs font-mono break-all">
            Example:{" "}
            https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
          </div>
          <p className="text-xs text-green-600 mt-1">
            💡 Image filenames aise rakhen jo script ke keywords se match hon:
            <br />
            mountain_snow.jpg, river_sunset.jpg, forest_rain.jpg
          </p>
        </div>
      )}

      {/* Input Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Drive Folder URL ya Folder ID
        </label>
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/YOUR_FOLDER_ID"
            className={`w-full px-4 py-3 pr-12 border rounded-lg text-sm
                       focus:outline-none focus:ring-2 transition-colors
                       ${
                         hasValue && isValid
                           ? "border-green-400 focus:ring-green-400 bg-green-50"
                           : hasValue && !isValid
                           ? "border-red-400 focus:ring-red-400 bg-red-50"
                           : "border-gray-300 focus:ring-blue-500"
                       }`}
          />
          {hasValue && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">
              {isValid ? "✅" : "❌"}
            </div>
          )}
        </div>
      </div>

      {/* Extracted Folder ID Display */}
      {folderId && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <span className="text-gray-500 text-xs">📂 Folder ID:</span>
          <code className="text-xs font-mono text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200 break-all">
            {folderId}
          </code>
          <span className="text-green-600 text-xs font-medium ml-auto shrink-0">
            ✓ Valid
          </span>
        </div>
      )}

      {hasValue && !isValid && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ❌ Invalid Drive URL. Puri URL paste karein jaise:{" "}
          <code className="text-xs bg-red-100 px-1 rounded">
            https://drive.google.com/drive/folders/FOLDER_ID
          </code>
        </div>
      )}

      {/* Naming Tips */}
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <p className="font-semibold mb-1">⚡ Smart Image Naming Tips:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <p className="font-medium text-yellow-900">Good Names ✅</p>
            <ul className="mt-1 space-y-0.5 font-mono">
              <li>mountain_snow_peak.jpg</li>
              <li>river_flowing_valley.jpg</li>
              <li>pakistan_flag_ceremony.jpg</li>
              <li>city_night_lights.jpg</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-yellow-900">Bad Names ❌</p>
            <ul className="mt-1 space-y-0.5 font-mono text-yellow-700">
              <li>IMG_20230815_123456.jpg</li>
              <li>DSC_0042.jpg</li>
              <li>photo1.jpg</li>
              <li>untitled.png</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
