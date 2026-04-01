"use client";

import { useEffect, useState, useRef } from "react";
import { AsciiCube } from "./ascii-cube";

const integrations = [
  { 
    name: "Zama", 
    category: "FHE Library",
    ascii: `  ┌─┐
  │Z│
  └─┘`
  },
  { 
    name: "Ethereum", 
    category: "L1 Network",
    ascii: `  ╔═╗
  │Ξ│
  ╚═╝`
  },
  { 
    name: "Chainlink", 
    category: "Oracles",
    ascii: `  ┌C┐
  └─┘`
  },
  { 
    name: "Metamask", 
    category: "Wallet",
    ascii: `  [M]
  [W]`
  },
  { 
    name: "Sepolia", 
    category: "Testnet",
    ascii: `  ◈◈
  ◈◈`
  },
  { 
    name: "fhEVM", 
    category: "Runtime",
    ascii: `  ≋≋
  ≋≋`
  },
  { 
    name: "Solidity", 
    category: "Smart Contracts",
    ascii: `  {S}
  ---`
  },
  { 
    name: "Wagmi", 
    category: "React Hooks",
    ascii: `  ▲
  ─`
  },
];

export function IntegrationsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="integrations" ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* ASCII Cube Background */}
      <div className="absolute left-10 top-1/3 opacity-5 pointer-events-none hidden xl:block">
        <AsciiCube className="w-[400px] h-[350px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="text-sm font-mono text-primary mb-4">// PROTOCOL ECOSYSTEM</p>
          <h2 className="text-4xl lg:text-5xl font-semibold tracking-tight mb-6 text-balance">
            Native FHE Integration.<br />Built on Ethereum.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            null402 leverages Zama's fhEVM and Chainlink Price Feeds to deliver 
            confidential lending with decentralized price stability.
          </p>
        </div>

        {/* Integrations Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {integrations.map((integration, index) => (
            <div
              key={integration.name}
              className={`group relative bg-card rounded-xl p-6 border border-border card-shadow hover:border-primary/50 transition-all duration-500 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              {/* ASCII Icon */}
              <pre className="font-mono text-lg text-primary mb-4 leading-tight h-12 flex items-center justify-center">
                {integration.ascii}
              </pre>
              
              <div className="text-center">
                <h3 className="font-semibold mb-1">{integration.name}</h3>
                <p className="text-xs text-muted-foreground">{integration.category}</p>
              </div>

              {/* Hover indicator */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-primary font-mono text-xs">→</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
