import React from "react";
import { useNavigate } from "react-router-dom";
// import { Button } from "@/components/ui/button"; // Keep if needed elsewhere, remove if not
// No longer need Auth import: import { Auth } from 'components/Auth';

// URL for the new logo image
const logoUrl = "https://static.databutton.com/public/8a0cb878-09d3-43d6-b867-01376728a41c/CV V.2.jpg";

// Define the props interface (if needed)
interface Props {}

export function Header({}: Props) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        {/* Left/Center section */}
        <div className="mr-4 flex">
          <a className="mr-6 flex items-center space-x-2 cursor-pointer" onClick={() => navigate("/")}>
            <img
              src={logoUrl}
              alt="Castle Verde Logo"
              className="h-6 w-auto"
            />
            <span className="hidden font-bold sm:inline-block text-primary" style={{ fontFamily: "\'Your Organic Sans-Serif\', sans-serif" }}>
              MetaBalance
            </span>
          </a>
          {/* Optional navigation links */}
        </div>

        {/* Right section (Now empty or for other future elements) */}
        <div className="flex flex-1 items-center justify-end space-x-2">
           {/* Auth component removed */}
        </div>
      </div>
    </header>
  );
}
