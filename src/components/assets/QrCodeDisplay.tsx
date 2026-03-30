"use client";

import { useRef, useCallback } from "react";
import QRCode from "react-qr-code";
import { Download, Printer } from "lucide-react";

interface QrCodeDisplayProps {
  assetTag: string;
  assetName: string;
  size?: number;
}

export function QrCodeDisplay({ assetTag, assetName, size = 160 }: QrCodeDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const downloadPng = useCallback(() => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const padding = 24;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2 + 40; // extra space for label
    const ctx = canvas.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);
      // Label
      ctx.fillStyle = "#111827";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText(assetTag, canvas.width / 2, size + padding + 20);
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(assetName.slice(0, 30), canvas.width / 2, size + padding + 36);

      const link = document.createElement("a");
      link.download = `qr-${assetTag}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  }, [assetTag, assetName, size]);

  const printQr = useCallback(() => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const svgHtml = svg.outerHTML;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>QR — ${assetTag}</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: monospace; }
        svg { width: ${size}px; height: ${size}px; }
        .tag { font-size: 14px; font-weight: bold; margin-top: 8px; }
        .name { font-size: 11px; color: #666; margin-top: 2px; }
        @media print { @page { margin: 0; } }
      </style></head>
      <body>
        ${svgHtml}
        <div class="tag">${assetTag}</div>
        <div class="name">${assetName}</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body></html>
    `);
    win.document.close();
  }, [assetTag, assetName, size]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={containerRef} className="p-4 bg-white rounded-xl border shadow-sm">
        <QRCode value={assetTag} size={size} level="M" />
      </div>
      <p className="text-sm font-mono font-semibold">{assetTag}</p>
      <p className="text-xs text-muted-foreground text-center max-w-[180px] truncate">{assetName}</p>
      <div className="flex gap-2">
        <button onClick={downloadPng} className="btn-outline text-xs gap-1.5">
          <Download className="h-3.5 w-3.5" /> PNG
        </button>
        <button onClick={printQr} className="btn-outline text-xs gap-1.5">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
    </div>
  );
}
