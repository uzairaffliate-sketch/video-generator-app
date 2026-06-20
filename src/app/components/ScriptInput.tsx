"use client";

import { useState } from "react";

interface ScriptInputProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ur", label: "Urdu (اردو)" },
  { code: "hi", label: "Hindi (हिन्दी)" },
  { code: "ar", label: "Arabic (عربي)" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
];

export default function ScriptInput({
  value,
  onChange,
  language,
  onLanguageChange,
}: ScriptInputProps) {
  const [showTips, setShowTips] = useState(false);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const estimatedDuration = Math.round(wordCount / 2.5); // ~2.5 words/sec
  const estimatedImages = Math.ceil(estimatedDuration / 5); // 1 image per 5 sec

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            📝 Step 1: Apni Script Likho
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Poori script yahan paste karo. Jitni script, utni video.
          </p>
        </div>
        <button
          onClick={() => setShowTips(!showTips)}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          💡 Tips {showTips ? "▲" : "▼"}
        </button>
      </div>

      {/* Tips */}
      {showTips && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1.5">
          <p className="font-semibold">📌 Behtar Results Ke Liye:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Script ko clear sentences mein likho</li>
            <li>Har topic/scene ke liye alag paragraph use karo</li>
            <li>
              Image filenames script ke keywords se match honge chahiye —
              e.g. &quot;mountain_snow.jpg&quot; &quot;snow&quot; keyword se
              match hoga
            </li>
            <li>Minimum 50 words recommended for a proper video</li>
          </ul>
        </div>
      )}

      {/* Language Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          🌐 Voice Language
        </label>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Script Textarea */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Script Text
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Yahan apni script paste karo...

Misal ke taur par:
Pakistan ek khoobsurat mulk hai. Yahan ke pahaad, darya aur maidan sab kuch hai. Shan-e-Pakistan mein bahut kuch hai jo duniya ko dikhana chahiye..."
          rows={12}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 
                     resize-y font-mono leading-relaxed placeholder-gray-400"
        />
      </div>

      {/* Stats Bar */}
      {wordCount > 0 && (
        <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-xs">📊 Words:</span>
            <span className="font-semibold text-gray-800 text-sm">
              {wordCount.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-xs">⏱️ Duration:</span>
            <span className="font-semibold text-gray-800 text-sm">
              ~{Math.floor(estimatedDuration / 60)}m {estimatedDuration % 60}s
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-xs">🖼️ Images needed:</span>
            <span className="font-semibold text-gray-800 text-sm">
              ~{estimatedImages}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-xs">🎬 Video length:</span>
            <span
              className={`font-semibold text-sm ${
                estimatedDuration > 1200
                  ? "text-orange-600"
                  : "text-green-600"
              }`}
            >
              {estimatedDuration > 60
                ? `~${Math.round(estimatedDuration / 60)} minutes`
                : `~${estimatedDuration} seconds`}
            </span>
          </div>
        </div>
      )}

      {/* Warning agar script bahut lambi ho */}
      {wordCount > 3000 && (
        <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
          <span>⚠️</span>
          <p>
            Script bahut lambi hai ({wordCount} words). Rendering mein{" "}
            {Math.round(estimatedDuration / 60)}+ minutes lag sakte hain.
            GitHub Actions free tier mein 2 hours ka time limit hai.
          </p>
        </div>
      )}
    </div>
  );
}
