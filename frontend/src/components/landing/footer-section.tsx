"use client";

import { CodeBracketSquareIcon } from "@heroicons/react/24/outline";

const footerLinks = {
  Product: [
    { name: "Features", href: "#features" },
    { name: "Technology", href: "#how-it-works" },
    { name: "Metrics", href: "#metrics" },
    { name: "Changelog", href: "#" },
  ],
  Developers: [
    { name: "Documentation", href: "#" },
    { name: "API Reference", href: "#" },
    { name: "SDK", href: "#developers" },
    { name: "Status", href: "#" },
  ],
};

export function FooterSection() {
  return (
    <footer className="relative border-t border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">


        {/* Bottom Bar */}
        <div className="py-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground font-mono">
            © 2026 null402 Protocol. All rights reserved.
          </p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              fhEVM Mainnet Ready
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
