import React, { type ReactNode } from "react";
import { Outlet } from "react-router-dom"; // Keep Outlet for routing

// Removed unused imports: Link, useNavigate, Button, AuthProvider, useAuth

interface Props {
  children: ReactNode; // Although children might not be used directly if Outlet is primary
}

/**
 * A provider wrapping the whole app. Simplified to remove auth.
 */
export const AppProvider = ({ children }: Props) => {
  // Removed AuthProvider wrapper and AppContent component

  return (
    <>
      {/* Header might be added back here or managed within individual pages/layouts */}
      {/* For now, just rendering the main content area */}

      {/* Render the actual page content using Outlet */}
      <main className="flex-1">
        <Outlet /> {/* Renders the matched route component */}
      </main>

      {/* Optional Footer */}
      <footer className="py-6 md:py-8 w-full border-t bg-background">
         <div className="container flex flex-col items-center justify-between gap-4 px-4 md:px-6 md:flex-row">
            <div className="flex items-center space-x-3">
                {/* <LogoPlaceholder /> */}
                <span className="text-sm text-muted-foreground" style={{ fontFamily: "'Your Professional Sans-Serif', sans-serif" }}>&copy; {new Date().getFullYear()} Castle Verde. All Rights Reserved.</span>
            </div>
            <nav className="flex gap-4 sm:gap-6">
                {/* Removed Auth Integrated text */}
                {/* Add relevant footer links if needed */}
            </nav>
          </div>
      </footer>
    </>
  );
};
