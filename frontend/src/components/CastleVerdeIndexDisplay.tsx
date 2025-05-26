import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";

// Define the color zones (matches gauge)
const zones = [
  { label: "Low", range: [0, 14.9], color: "#28a745", bgColor: "bg-[#f5fef6]" },
  { label: "Caution", range: [15, 24.9], color: "#d3a00f", bgColor: "bg-[#fffdf5]" },
  { label: "Dangerous", range: [25, 34.9], color: "#d98c00", bgColor: "bg-[#fff5f5]" }, // Adjusted color slightly
  { label: "Red Zone", range: [35, 50], color: "#c0392b", bgColor: "bg-[#fff5f5]" },
];

interface Props {
  score: number | null;
  isLoading: boolean;
  error?: string | null;
}

// Helper function to find the zone based on the score
const getZone = (score: number | null) => {
  if (score === null || score < 0) return null;
  return zones.find(({ range }) => score >= range[0] && score <= range[1]) || null;
};

export const CastleVerdeIndexDisplay: React.FC<Props> = ({ score, isLoading, error }) => {

  const zone = getZone(score);

  return (
    <Card className={`w-full max-w-sm mx-auto shadow-md ${zone?.bgColor ?? 'bg-white'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-center text-red-600">Powered by the Castle Verde Index</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-4">
        {isLoading ? (
          <Skeleton className="h-12 w-24 my-2" /> // Placeholder for score
        ) : error ? (
          <div className="flex items-center text-destructive">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Error</span>
          </div>
        ) : score !== null ? (
          <div className="text-center">
            <span className="text-4xl font-bold" style={{ color: zone?.color ?? '#000' }}>
              {score.toFixed(1)} mg/dL
            </span>
            {zone && (
                <p className="text-sm font-medium mt-1" style={{ color: zone?.color ?? '#6b7280' }}>
                    ({zone.label} Risk)
                </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
                <p className="text-xs text-muted-foreground text-center mt-3 px-2">
          This is the Prediction of the Total Cart
        </p>
         {/* Display error message if present and not loading */}
         {!isLoading && error && (
            <p className="text-xs text-red-600 text-center mt-2 px-2">
                Error: {error}
            </p>
        )}
      </CardContent>
    </Card>
  );
};