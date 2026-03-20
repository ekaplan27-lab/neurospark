import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Play, RotateCcw, FileCode, FileType, File, Music, Square as MusicOff, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

type FileSlot = "html" | "css" | "js";

interface UploadedFiles {
  html?: string;
  css?: string;
  js?: string;
}

const FILE_CONFIG: Record<FileSlot, { label: string; accept: string; icon: React.ReactNode; color: string }> = {
  html: { label: "HTML", accept: ".html,.htm", icon: <File className="w-5 h-5" />, color: "bg-orange-100 text-orange-700 border-orange-200" },
  css: { label: "CSS", accept: ".css", icon: <FileType className="w-5 h-5" />, color: "bg-blue-100 text-blue-700 border-blue-200" },
  js: { label: "JavaScript", accept: ".js,.mjs,.ts", icon: <FileCode className="w-5 h-5" />, color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
};

function FileUploadCard({
  slot,
  fileName,
  onUpload,
  onClear,
}: {
  slot: FileSlot;
  fileName?: string;
  onUpload: (slot: FileSlot, content: string, name: string) => void;
  onClear: (slot: FileSlot) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const config = FILE_CONFIG[slot];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpload(slot, ev.target?.result as string, file.name);
      toast.success(`${config.label} file loaded!`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div
      className={`border-2 rounded-xl p-5 flex flex-col gap-3 transition-all ${fileName ? "border-border bg-card shadow-sm" : "border-dashed border-border bg-muted/30 hover:bg-muted/50"}`}
    >
      <div className="flex items-center gap-2">
        <span className={`p-2 rounded-lg border ${config.color}`}>{config.icon}</span>
        <span className="font-semibold text-foreground">{config.label}</span>
        {fileName && <Badge variant="secondary" className="ml-auto text-xs truncate max-w-[140px]">{fileName}</Badge>}
      </div>
      {fileName ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => inputRef.current?.click()}>
            Replace
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onClear(slot)}>
            Remove
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" /> Upload {config.label}
        </Button>
      )}
      <input ref={inputRef} type="file" accept={config.accept} className="hidden" onChange={handleFile} />
    </div>
  );
}

function MusicUploadCard({
  musicEnabled,
  onToggle,
  musicFileName,
  onMusicUpload,
  onMusicClear,
}: {
  musicEnabled: boolean;
  onToggle: () => void;
  musicFileName?: string;
  onMusicUpload: (dataUrl: string, name: string) => void;
  onMusicClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onMusicUpload(ev.target?.result as string, file.name);
      toast.success("Music file loaded!");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div
      className={`border-2 rounded-xl p-5 flex flex-col gap-3 transition-all ${musicEnabled ? "border-primary bg-primary/5" : "border-dashed border-border bg-muted/30"}`}
    >
      <div className="flex items-center gap-2">
        <span className={`p-2 rounded-lg border ${musicEnabled ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}`}>
          {musicEnabled ? <Music className="w-5 h-5" /> : <MusicOff className="w-5 h-5" />}
        </span>
        <span className="font-semibold text-foreground">Background Music</span>
        <button
          onClick={onToggle}
          className={`ml-auto relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${musicEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
          aria-label="Toggle music"
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${musicEnabled ? "translate-x-4" : "translate-x-1"}`} />
        </button>
      </div>

      {musicEnabled && (
        <>
          {musicFileName ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <Volume2 className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs text-foreground truncate">{musicFileName}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => inputRef.current?.click()}>
                  Replace
                </Button>
                <Button size="sm" variant="ghost" onClick={onMusicClear}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Upload Music File
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Supports MP3, OGG, WAV. Music will loop while the game runs.</p>
        </>
      )}

      <input ref={inputRef} type="file" accept=".mp3,.ogg,.wav,.m4a,.aac" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function App() {
  const [files, setFiles] = useState<UploadedFiles>({});
  const [fileNames, setFileNames] = useState<Partial<Record<FileSlot, string>>>({});
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicDataUrl, setMusicDataUrl] = useState<string | undefined>();
  const [musicFileName, setMusicFileName] = useState<string | undefined>();

  const handleUpload = useCallback((slot: FileSlot, content: string, name: string) => {
    setFiles((prev) => ({ ...prev, [slot]: content }));
    setFileNames((prev) => ({ ...prev, [slot]: name }));
    setPreviewSrc(null);
  }, []);

  const handleClear = useCallback((slot: FileSlot) => {
    setFiles((prev) => { const n = { ...prev }; delete n[slot]; return n; });
    setFileNames((prev) => { const n = { ...prev }; delete n[slot]; return n; });
    setPreviewSrc(null);
  }, []);

  const handleMusicUpload = (dataUrl: string, name: string) => {
    setMusicDataUrl(dataUrl);
    setMusicFileName(name);
    setPreviewSrc(null);
  };

  const handleMusicClear = () => {
    setMusicDataUrl(undefined);
    setMusicFileName(undefined);
    setPreviewSrc(null);
  };

  const handleRun = () => {
    if (!files.html && !files.js) {
      toast.error("Please upload at least an HTML or JS file.");
      return;
    }
    const html = buildHtml(files, musicEnabled ? musicDataUrl : undefined);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setPreviewSrc(url);
  };

  const handleReset = () => {
    setFiles({});
    setFileNames({});
    setPreviewSrc(null);
    setMusicDataUrl(undefined);
    setMusicFileName(undefined);
    setMusicEnabled(false);
  };

  const hasFiles = Object.keys(files).length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster />
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <FileCode className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Code Runner</h1>
        <span className="text-muted-foreground text-sm ml-1">Upload your files and run them instantly</span>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 gap-0 overflow-hidden">
        {/* Sidebar */}
        <aside className="lg:w-80 w-full border-b lg:border-b-0 lg:border-r border-border bg-card p-6 flex flex-col gap-5 overflow-y-auto">
          <div>
            <h2 className="font-semibold text-foreground mb-1">Upload Files</h2>
            <p className="text-sm text-muted-foreground">Upload your HTML, CSS, and JS files to preview them together.</p>
          </div>

          <div className="flex flex-col gap-3">
            {(["html", "css", "js"] as FileSlot[]).map((slot) => (
              <FileUploadCard
                key={slot}
                slot={slot}
                fileName={fileNames[slot]}
                onUpload={handleUpload}
                onClear={handleClear}
              />
            ))}
          </div>

          {/* Music Section */}
          <div>
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Music className="w-4 h-4" /> Music
            </h2>
            <MusicUploadCard
              musicEnabled={musicEnabled}
              onToggle={() => setMusicEnabled((v) => !v)}
              musicFileName={musicFileName}
              onMusicUpload={handleMusicUpload}
              onMusicClear={handleMusicClear}
            />
          </div>

          <div className="flex flex-col gap-2 mt-auto pt-2">
            <Button className="w-full" onClick={handleRun} disabled={!hasFiles}>
              <Play className="w-4 h-4 mr-2" /> Run Code
            </Button>
            {hasFiles && (
              <Button variant="outline" className="w-full" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" /> Reset
              </Button>
            )}
          </div>
        </aside>

        {/* Preview */}
        <main className="flex-1 flex flex-col bg-muted/20">
          {previewSrc ? (
            <iframe
              src={previewSrc}
              title="Code Preview"
              className="flex-1 w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Play className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">No preview yet</h3>
                <p className="text-muted-foreground text-sm mt-1">Upload your files and click <strong>Run Code</strong> to see the result here.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function buildHtml(files: UploadedFiles, musicDataUrl?: string): string {
  const audioTag = musicDataUrl
    ? `<audio id="bg-music" src="${musicDataUrl}" autoplay loop style="display:none"></audio>`
    : "";

  if (files.html) {
    let html = files.html;
    if (files.css) {
      const styleTag = `<style>\n${files.css}\n</style>`;
      html = html.includes("</head>")
        ? html.replace("</head>", `${styleTag}\n</head>`)
        : styleTag + html;
    }
    if (audioTag) {
      html = html.includes("</body>")
        ? html.replace("</body>", `${audioTag}\n</body>`)
        : html + audioTag;
    }
    if (files.js) {
      const scriptTag = `<script>\n${files.js}\n</script>`;
      html = html.includes("</body>")
        ? html.replace("</body>", `${scriptTag}\n</body>`)
        : html + scriptTag;
    }
    return html;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  ${files.css ? `<style>
${files.css}
</style>` : ""}
</head>
<body>
  ${audioTag}
  ${files.js ? `<script>
${files.js}
</script>` : ""}
</body>
</html>`;
}
