"use client";

import { useEffect, useState, useRef } from "react";
import { AsciiWave } from "./ascii-wave";

function AnimatedCounter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const start = 0;
          const duration = 2000;
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  return (
    <div ref={ref} className="font-mono text-4xl lg:text-6xl font-semibold tracking-tight">
      {prefix}{count.toLocaleString()}{suffix}
    </div>
  );
}

const metrics = [
  { 
    value: 100, 
    suffix: "%", 
    label: "MEV Resistance",
    sublabel: "FHE guaranteed"
  },
  { 
    value: 12, 
    suffix: "s", 
    label: "Avg Block Time",
    sublabel: "Ethereum Sepolia"
  },
  { 
    value: 842, 
    suffix: "", 
    label: "Protected Positions",
    sublabel: "Null state entropy"
  },
];

export function MetricsSection() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="metrics" className="relative py-32 overflow-hidden">
      {/* ASCII Wave Background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <AsciiWave className="w-full h-full object-cover" />
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-16">
          <div>
            <p className="text-sm font-mono text-primary mb-3">// LIVE PROTOCOL STATE</p>
            <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight text-balance">
              Real-time protocol<br />confidentiality.
            </h2>
          </div>
          <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>FHE Gateway Active</span>
            <span className="text-border">|</span>
            <span>{mounted ? time.toLocaleTimeString() : "--:--:--"}</span>
          </div>
        </div>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden card-shadow">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="bg-card p-8 flex flex-col gap-4"
            >
              <div className="text-primary">
                <AnimatedCounter 
                  end={typeof metric.value === 'number' ? metric.value : 0} 
                  suffix={metric.suffix} 
                />
              </div>
              <div>
                <div className="text-foreground font-medium">{metric.label}</div>
                <div className="text-sm text-muted-foreground">{metric.sublabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
