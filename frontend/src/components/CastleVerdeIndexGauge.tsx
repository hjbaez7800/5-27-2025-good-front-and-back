import React, { useEffect, useState, useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  score: number | null; // The predicted spike score (0-50)
  isLoading?: boolean; // Optional loading state
}

// NOTE: Zones based on the old 0-50 mg/dL scale. Keep for visual gradient, but labels/logic removed.
const zones_DEPRECATED = [
  { label: "Low", range: [0, 14.9], color: "#28a745" },
  { label: "Caution", range: [15, 24.9], color: "#d3a00f" },
  { label: "Dangerous", range: [25, 34.9], color: "#d98c00" },
  { label: "Red Zone", range: [35, 50], color: "#c0392b" },
];

// For the label decoration
const leafPath = "M0,0 C5,10 10,-5 0,-15 C-10,-5 -5,10 0,0 Z";

const MAX_SCORE = 50;
const MIN_SCORE = 0;
const GAUGE_START_ANGLE = -90;
const GAUGE_END_ANGLE = 90;
const GAUGE_RANGE = GAUGE_END_ANGLE - GAUGE_START_ANGLE;

// Extended range for the decorative full circle
const DECORATIVE_START_ANGLE = -150;
const DECORATIVE_END_ANGLE = 150;

// Helper function to convert score to angle (degrees)
const scoreToAngle = (score: number, minScore: number, maxScore: number, startAngle: number, range: number): number => {
  const scoreRatio = (Math.min(maxScore, Math.max(minScore, score)) - minScore) / (maxScore - minScore);
  return startAngle + scoreRatio * range;
};

// Helper function to convert angle (degrees) to coordinates on a circle/arc
const angleToCoords = (angle: number, radius: number, centerX: number, centerY: number): { x: number; y: number } => {
  const angleRad = ((angle - 90) * Math.PI) / 180; // Adjust angle for SVG coord system (0 deg is right)
  return {
    x: centerX + radius * Math.cos(angleRad),
    y: centerY + radius * Math.sin(angleRad),
  };
};

// Helper function to get points for decorative leaves
const getLeafPoints = (angle: number, size: number, centerX: number, centerY: number, distance: number): string => {
  const basePoint = angleToCoords(angle, distance, centerX, centerY);
  // Rotate the leaf based on the angle
  const rotationAngle = angle - 90; // Adjust so leaf points outward
  return `translate(${basePoint.x}, ${basePoint.y}) rotate(${rotationAngle}) scale(${size})`;
};

// Helper function to describe an SVG arc path with organic roundness
const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number, rounded: boolean = false): string => {
  const start = angleToCoords(endAngle, radius, x, y); // SVG arcs go clockwise
  const end = angleToCoords(startAngle, radius, x, y);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  
  // Prevent drawing arc if start and end angles are the same
  if (Math.abs(startAngle - endAngle) < 0.01) {
      // Create a tiny arc path string which is visually invisible but valid SVG
      const tinyOffset = 0.001;
      const endSlightlyMoved = angleToCoords(startAngle + tinyOffset, radius, x, y);
      return [
        "M", start.x, start.y,
        "A", radius, radius, 0, 0, 0, endSlightlyMoved.x, endSlightlyMoved.y
      ].join(" ");
  }
  
  // For more organic shapes, we can add subtle variations to the path
  const d = [
    "M", start.x, start.y,
    "A", radius, rounded ? radius * 0.98 : radius, rounded ? 0.05 : 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
  
  return d;
};

// Use a consistent color for the score display instead of zone-based color


// Zone definitions (consistent with CastleVerdeIndexDisplay)
const zones = [
  { label: "Low", range: [0, 14.9], color: "#2ECC71" }, // Emerald 500
  { label: "Caution", range: [15, 24.9], color: "#F4D03F" }, // Amber 500
  { label: "Dangerous", range: [25, 34.9], color: "#F5B041" }, // Orange 500
  { label: "Red Zone", range: [35, 50], color: "#E74C3C" }, // Red 500
];

// Helper function to get zone based on score
const getZone = (score: number | null) => {
  if (score === null) {
    return { label: 'N/A', color: '#6b7280' }; // Default slate color
  }
  for (const zone of zones) {
    if (score >= zone.range[0] && score <= zone.range[1]) {
      return zone;
    }
  }
  // Return Red Zone if score is above max range, or default if below min
  return score > zones[zones.length - 1].range[1]
    ? zones[zones.length - 1]
    : { label: 'N/A', color: '#6b7280' };
};


// --- Main Component ---
export function CastleVerdeIndexGauge({ score, isLoading = false }: Props) {
  // State for needle animation
  const [animatedScore, setAnimatedScore] = useState<number | null>(null);
  const [isInitialRender, setIsInitialRender] = useState(true);

  // Animate the needle when score changes
  useEffect(() => {
    if (score === null) {
      setAnimatedScore(null);
      return;
    }

    // Skip animation on first render
    if (isInitialRender) {
      setAnimatedScore(score);
      setIsInitialRender(false);
      return;
    }

    // Start from current position or min
    const startValue = animatedScore ?? MIN_SCORE;
    const targetValue = Math.max(MIN_SCORE, Math.min(score, MAX_SCORE));
    const diff = targetValue - startValue;
    
    // Animation duration proportional to the distance
    const duration = Math.min(Math.abs(diff) * 40, 800); // Max 800ms
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      if (elapsed >= duration) {
        setAnimatedScore(targetValue);
        return;
      }
      
      // Easing function for smooth motion
      const progress = elapsed / duration;
      const easeOutQuad = 1 - (1 - progress) * (1 - progress);
      const newValue = startValue + diff * easeOutQuad;
      
      setAnimatedScore(newValue);
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  }, [score]);

  // --- Calculations ---
  const clampedScore = animatedScore === null ? MIN_SCORE : Math.max(MIN_SCORE, Math.min(animatedScore, MAX_SCORE));
  const acvScore = clampedScore * 0.75; // 25% reduction

  // --- SVG Coordinates & Angles ---
  const svgWidth = 240; // Wider to accommodate decorative elements
  const svgHeight = 150; // Taller for leaf decorations and text
  const centerX = svgWidth / 2;
  const centerY = svgHeight - 20;
  const gaugeRadius = 90;
  const decorativeRadius = gaugeRadius + 8;
  const needleLength = gaugeRadius - 4; // Adjust to reach center of arc stroke
  const labelOffset = 30; // Reduced slightly to prevent edge cutoff

  const needleAngle = scoreToAngle(clampedScore, MIN_SCORE, MAX_SCORE, GAUGE_START_ANGLE, GAUGE_RANGE);
  const acvScoreAngle = scoreToAngle(acvScore, MIN_SCORE, MAX_SCORE, GAUGE_START_ANGLE, GAUGE_RANGE);
  const acvNeedleLength = needleLength * 0.8; // Shorter needle for ACV
  const acvNeedleEndCoords = angleToCoords(acvScoreAngle, acvNeedleLength, centerX, centerY);
  const needleEndCoords = angleToCoords(needleAngle, needleLength, centerX, centerY);
  const labelCoords = angleToCoords(needleAngle, gaugeRadius + labelOffset, centerX, centerY);

  // --- ACV Label Positioning (Below Needle Tip) ---
  const verticalOffset = -10; // Offset -10 relative to needle tip (moves up)
  const perpendicularAngle = acvScoreAngle + 90; // Angle perpendicular to ACV needle
  const offsetVector = angleToCoords(perpendicularAngle, verticalOffset, 0, 0); // Get dx, dy offset
  const finalAcvLabelX = acvNeedleEndCoords.x + offsetVector.x;
  const finalAcvLabelY = acvNeedleEndCoords.y + offsetVector.y;
  // --- END ---
  
  // Coordinates for decorative elements
  const leafAngles = [-120, -60, 0, 60, 120];
  const leafScale = 0.35;
  const leafDistance = decorativeRadius + 5;

  // --- Text Rendering ---
  const predictedText = score === null ? '--.-' : `${score.toFixed(1)}`; // Display GSP score without prefix/units
  const acvText = score === null ? '~--.-' : `~${(score * 0.75).toFixed(1)}`; // Display ACV estimate without units

  // Get the current zone based on the *actual* score prop for coloring
  const currentZone = useMemo(() => getZone(score), [score]);


  if (isLoading) {
    return (
      <div className="text-center py-10 w-full max-w-xs">
        <div className="relative mx-auto w-16 h-16">
          {/* Botanical loading spinner */}
          <div className="absolute inset-0 opacity-20">
            <svg viewBox="0 0 32 32" className="w-full h-full text-emerald-700">
              <path 
                d="M16,0 C20,8 28,12 32,16 C28,20 20,24 16,32 C12,24 4,20 0,16 C4,12 12,8 16,0 Z" 
                fill="currentColor"
              />
            </svg>
          </div>
          <div className="absolute inset-0 animate-spin duration-1000">
            <svg viewBox="0 0 32 32" className="w-full h-full text-emerald-600">
              <path 
                d="M16,0 C20,8 28,12 32,16 C28,20 20,24 16,32 C12,24 4,20 0,16 C4,12 12,8 16,0 Z" 
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="80"
                strokeDashoffset="60"
              />
            </svg>
          </div>
        </div>
        <p className="text-muted-foreground font-medium mt-3">Calculating Index...</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center w-full max-w-[90%] sm:max-w-sm mx-auto">
        {/* SVG Gauge with Medical-Botanical Design */}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height="auto"
          className="mb-2"
        >
          {/* Enhanced Gradients */}
          <defs>
            {/* Subtle texture pattern */}
            <pattern id="subtlePattern" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
              <rect width="10" height="10" fill="rgba(249, 250, 251, 0.5)" />
              <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(229, 231, 235, 0.5)" strokeWidth="0.5" />
            </pattern>
            
            {/* Main gradient with softer transitions */}
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              {/* Aligned 4-color gradient stops */}
              <stop offset="0%" stopColor="#2ECC71" />   {/* Start Green */}
              <stop offset="30%" stopColor="#2ECC71" /> {/* End Green at 15 (30%) */}
              <stop offset="30%" stopColor="#F4D03F" />  {/* Start Yellow at 15 (30%) */}
              <stop offset="50%" stopColor="#F4D03F" /> {/* End Yellow at 25 (50%) */}
              <stop offset="50%" stopColor="#F5B041" />  {/* Start Orange at 25 (50%) */}
              <stop offset="70%" stopColor="#F5B041" /> {/* End Orange at 35 (70%) */}
              <stop offset="70%" stopColor="#E74C3C" />  {/* Start Red at 35 (70%) */}
              <stop offset="100%" stopColor="#E74C3C" /> {/* End Red */}
            </linearGradient>
            
            {/* Soft shadow effect */}
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
              <feOffset in="blur" dx="1" dy="1" result="offsetBlur" />
              <feFlood floodColor="#000000" floodOpacity="0.15" result="offsetColor"/>
              <feComposite in="offsetColor" in2="offsetBlur" operator="in" result="blurryEdge"/>
              <feMerge>
                <feMergeNode in="blurryEdge"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Decorative background circle with organic pattern */}
          <circle 
            cx={centerX} 
            cy={centerY} 
            r={decorativeRadius + 2} 
            fill="url(#subtlePattern)" 
            opacity="0.4"
          />
          
          {/* Decorative outer arc */}
          <path
            d={describeArc(centerX, centerY, decorativeRadius, DECORATIVE_START_ANGLE, DECORATIVE_END_ANGLE, true)}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1.5"
            strokeDasharray="2 3"
            strokeLinecap="round"
            opacity="0.6"
          />
          
          {/* Decorative leaf accents */}
          {leafAngles.map((angle, i) => (
            <g key={i} transform={getLeafPoints(angle, leafScale, centerX, centerY, leafDistance)}>
              <path d={leafPath} fill={zones[i % zones.length]?.color || '#e5e7eb'} opacity="0.2" />
            </g>
          ))}
          
          {/* Main Scale Background with softer edges */}
          <path
            d={describeArc(centerX, centerY, gaugeRadius, GAUGE_START_ANGLE, GAUGE_END_ANGLE, true)}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
            strokeLinecap="round"
            filter="url(#softShadow)"
          />

          {/* Main Gradient Arc with organic styling */}
          {score !== null && score > MIN_SCORE && (
            <path
              d={describeArc(centerX, centerY, gaugeRadius, GAUGE_START_ANGLE, GAUGE_END_ANGLE, true)} // Extend to full range
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              filter="url(#softShadow)"
              shape-rendering="geometricPrecision" // Add shape-rendering attribute
            />
          )}
          
          {/* Scale Marks */}
          {[0, 10, 20, 30, 40, 50].map((mark) => {
            const markAngle = scoreToAngle(mark, MIN_SCORE, MAX_SCORE, GAUGE_START_ANGLE, GAUGE_RANGE);
            const outerMark = angleToCoords(markAngle, gaugeRadius + 4, centerX, centerY);
            const innerMark = angleToCoords(markAngle, gaugeRadius - 4, centerX, centerY);
            const textPos = angleToCoords(markAngle, gaugeRadius + 15, centerX, centerY);
            
            return (
              <g key={`${mark} mg/dL`}>
                <line 
                  x1={outerMark.x} y1={outerMark.y} 
                  x2={innerMark.x} y2={innerMark.y}
                  stroke="#9ca3af" 
                  strokeWidth="1" 
                  opacity="0.6"
                />
                <text 
                  x={textPos.x} 
                  y={textPos.y} 
                  fontSize="9" 
                  fill="#4b5563" 
                  textAnchor={needleAngle < 0 ? "end" : "start"} // Adjust anchor based on side 
                  dominantBaseline="middle"
                  style={{ fontFamily: "'system-ui', sans-serif" }} // Professional sans-serif
                >
                  {mark}
                </text>
              </g>
            );
          })}

          {/* ACV Needle (Secondary) */}
          {score !== null && score > MIN_SCORE && clampedScore > acvScore && (
            <line
              x1={centerX}
              y1={centerY}
              x2={acvNeedleEndCoords.x}
              y2={acvNeedleEndCoords.y}
              stroke="#94a3b8" // Lighter gray color (slate-400)
              strokeWidth="1.5" // Thinner
              strokeLinecap="round"
              opacity="0.8"
            />
          )}

          {/* Enhanced Needle with organic design (Main Score) */}
          <g filter="url(#softShadow)">
            {/* Subtle shadow line */}
            <line
              x1={centerX}
              y1={centerY}
              x2={needleEndCoords.x}
              y2={needleEndCoords.y}
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Main needle with organic shape */}
            <line
              x1={centerX}
              y1={centerY}
              x2={needleEndCoords.x}
              y2={needleEndCoords.y}
              stroke="#475569"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
          
          {/* Needle base with organic accent */}
          <circle cx={centerX} cy={centerY} r="6" fill="#475569" />
          <circle cx={centerX} cy={centerY} r="2" fill="#94a3b8" />

          {/* --- ACV Score Label (Inner) --- */}
          {score !== null && clampedScore > acvScore && (
            <text
              x={finalAcvLabelX} // Use new X coordinate
              y={finalAcvLabelY} // Use new Y coordinate
              textAnchor="middle"
              dominantBaseline="hanging" // Anchor top of text at offset point (below)
              fontSize="10" // Increased size
              fontWeight="semibold" // Increased weight
              fill="#334155" // Darker Slate 700
              style={{ fontFamily: "'system-ui', sans-serif" }}
            >
              {acvScore.toFixed(1)}
            </text>
          )}
          {/* --- End ACV Score Label (Inner) --- */}

null        </svg>

        {/* Supporting Text with Dual Typography */}
        <div className="text-center mt-[-5px] px-4">
          
          
          
          <p className="text-2xl mb-3"
             style={{ fontFamily: "'system-ui', sans-serif", color: currentZone.color }}> {/* Professional sans-serif & Dynamic Color */}
            <span className="font-semibold">GSP Score:</span> {predictedText} mg/dL
          </p>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center gap-1 text-xs text-emerald-700 cursor-help">
                <span className="inline-block h-0.5 w-4 bg-emerald-200 rounded-full"></span>
                <p className="italic">
                  With ACV: {acvText}
                </p>
                <span className="inline-block h-0.5 w-4 bg-emerald-200 rounded-full"></span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[250px] text-sm">
              <p>Apple Cider Vinegar may help reduce post-meal glucose spikes by approximately 25%. This estimate illustrates potential benefits.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
