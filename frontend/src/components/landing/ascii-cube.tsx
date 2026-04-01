"use client";

import { useEffect, useRef } from "react";

export function AsciiCube({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let angle = 0;

    const chars = "10{}[_*^~. ";

    const vertices = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
    ];

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const rotateX = (point: number[], a: number): number[] => {
      const [x, y, z] = point;
      return [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
    };

    const rotateY = (point: number[], a: number): number[] => {
      const [x, y, z] = point;
      return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
    };

    const rotateZ = (point: number[], a: number): number[] => {
      const [x, y, z] = point;
      return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
    };

    const project = (point: number[]): [number, number, number] => {
      const scale = 2 / (4 + point[2]);
      return [point[0] * scale, point[1] * scale, point[2]];
    };

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // We determine how many ASCII characters fit across the screen
      const charW = 6;
      const charH = 10;
      const cols = Math.floor(width / charW);
      const rows = Math.floor(height / charH);

      const buffer: string[][] = Array(rows).fill(null).map(() => Array(cols).fill(" "));
      const zBuffer: number[][] = Array(rows).fill(null).map(() => Array(cols).fill(-Infinity));

      const rotatedVertices = vertices.map((v) => {
        let point = rotateX(v, angle * 0.7);
        point = rotateY(point, angle);
        point = rotateZ(point, angle * 0.5);
        return project(point);
      });

      edges.forEach(([start, end]) => {
        const [x1, y1] = rotatedVertices[start];
        const [x2, y2] = rotatedVertices[end];
        const z1 = rotatedVertices[start][2];
        const z2 = rotatedVertices[end][2];

        // Draw more steps for a higher res ASCII map
        const steps = 150;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = x1 + (x2 - x1) * t;
          const y = y1 + (y2 - y1) * t;
          const z = z1 + (z2 - z1) * t;

          // Scale isotropically in physical pixel space
          const minDim = Math.min(width, height);
          const sizePx = minDim * 0.35;
          
          const pixelX = width / 2 + x * sizePx;
          const pixelY = height / 2 + y * sizePx;
          
          const px = Math.floor(pixelX / charW);
          const py = Math.floor(pixelY / charH);

          if (px >= 0 && px < cols && py >= 0 && py < rows) {
            if (z > zBuffer[py][px]) {
              zBuffer[py][px] = z;
              const charIndex = Math.floor((z + 1) * (chars.length - 1) / 2);
              buffer[py][px] = chars[Math.max(0, Math.min(chars.length - 1, charIndex))];
            }
          }
        }
      });

      ctx.font = "10px JetBrains Mono, monospace";
      ctx.textBaseline = "top";

      buffer.forEach((row, r) => {
        row.forEach((char, c) => {
          if (char !== " ") {
            const z = zBuffer[r][c];
            const alpha = (z + 1) / 2 * 0.8 + 0.2;
            ctx.fillStyle = `oklch(0.9 0.2 95 / ${alpha})`;
            ctx.fillText(char, c * charW, r * charH);
          }
        });
      });

      angle += 0.015;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className={className} />
  );
}
