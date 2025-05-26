// ui/src/components/Macro5Visualization.tsx
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  Cell, // <-- Added missing import
  // YAxis, // Removed
  // CartesianGrid, // Removed
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine, // <-- Added import
  Legend, // <-- Added Legend import
} from "recharts";

// Define structure for chart data points
interface ChartDataPoint {
  name: string; // Macro name (e.g., "Protein")
  actual: number; // Actual value in grams
  balanced: number; // Balanced value in grams
}

// Define the props the component accepts
interface Props {
  actualProtein: number;
  actualFiber: number;
  actualFat: number;
  actualSugar: number;
  actualTotalCarbs: number; // Renamed from actualNetCarbs
  balancedProtein: number;
  balancedFiber: number;
  balancedFat: number;
  balancedSugar: number;
  balancedTotalCarbs: number; // Renamed from balancedNetCarbs
  totalCalories?: number; // Optional prop for total calories
  anchorKey?: string; // Added to identify the anchor macro
  itemName?: string; // Add itemName prop
}

// Define Colors for the visualization
const ACTUAL_BAR_COLOR = "#1d4ed8"; // Strong Blue for Actual
const BALANCED_BAR_COLOR = "#d97706"; // Strong Amber/Gold for Balanced
const ANCHOR_BALANCED_COLOR = "#f97316"; // Bright Orange for Anchored Balanced bar
const GRID_COLOR = "#e5e7eb"; // Light gray for grid
const AXIS_LABEL_COLOR = "#374151"; // Dark gray for axis/labels

// REMOVED DualValueLabel component for debugging

// Custom Tick for XAxis to allow bolding the anchor label
const CustomAxisTick = (props: any) => {
  const { x, y, payload, anchorKey } = props;
  const isAnchor = payload.value === anchorKey;

  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={0} 
        y={0} 
        dy={16} // Adjust vertical position if needed
        textAnchor="middle" 
        fill={AXIS_LABEL_COLOR} 
        fontSize={12}
        fontFamily="'Your Professional Sans-Serif', sans-serif"
        fontWeight={isAnchor ? 'bold' : 'normal'} // Apply bold if anchor
      >
        {payload.value}
      </text>
    </g>
  );
};

export const Macro5Visualization: React.FC<Props> = ({
  actualProtein,
  actualFiber,
  actualFat,
  actualSugar,
  actualTotalCarbs, // Renamed from actualNetCarbs
  balancedProtein,
  balancedFiber,
  balancedFat,
  balancedSugar,
  balancedTotalCarbs, // Renamed from balancedNetCarbs
  totalCalories,
  anchorKey, // Destructure the new prop
  itemName // Destructure itemName
}) => {
  const data: ChartDataPoint[] = [
    { name: "Protein", actual: actualProtein, balanced: balancedProtein },
    { name: "Fiber", actual: actualFiber, balanced: balancedFiber },
    { name: "Fat", actual: actualFat, balanced: balancedFat },
    { name: "Total Carbs", actual: actualTotalCarbs, balanced: balancedTotalCarbs }, 
    { name: "Sugar", actual: actualSugar, balanced: balancedSugar },
    // Use Total Carbs data and update the name
    // { name: "Total Carbs", actual: actualTotalCarbs, balanced: balancedTotalCarbs }, // Original position, moved up
  ].map(item => ({ 
    ...item,
    // Ensure values are numbers and non-negative, default to 0 if undefined/null/NaN
    actual: Math.max(0, Number(item.actual) || 0),
    balanced: Math.max(0, Number(item.balanced) || 0),
  }));

  // console.log("Macro5Visualization data (all macros, non-negative):", data);

  const maxValue = Math.max(
    ...data.map(item => Math.max(item.actual, item.balanced)),
    1 // Ensure max value is at least 1
  ) * 1.15;

  let tickIncrement = 50;
  if (maxValue <= 50) tickIncrement = 10;
  else if (maxValue <= 100) tickIncrement = 20;
  else if (maxValue <= 200) tickIncrement = 25;

  const niceMax = Math.ceil(maxValue / tickIncrement) * tickIncrement;
  const ticks = Array.from(
    { length: Math.floor(niceMax / tickIncrement) + 1 },
    (_, i) => i * tickIncrement
  );

  console.log("Macro5Visualization final data for chart:", JSON.stringify(data)); // Log data being passed
  console.log("Macro5Visualization anchorKey prop:", anchorKey); // Log anchorKey prop

  // Add pre-render log for all props
  console.log("Rendering Macro5Visualization with props:", {
    actualProtein, actualFiber, actualFat, actualSugar, actualTotalCarbs,
    balancedProtein, balancedFiber, balancedFat, balancedSugar, balancedTotalCarbs,
    totalCalories, anchorKey,
    calculatedData: data, // Log the processed data as well
    itemName, // Log itemName prop
  });

  return (
    <div className="w-full p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold text-center mb-2 text-gray-700 font-sans">
         {/* Use itemName prop, fallback to "Item" */}
        Macro5<sup>™</sup> bar graph - {itemName || "Item"}
      </h3>
      {/* Calorie paragraph removed as API doesn't provide this data */}
      <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={data}
        margin={{ top: 30, right: 30, left: 5, bottom: 20 }} // Adjusted bottom margin
        barCategoryGap="20%"
      >
        {/* <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} /> */}

        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          // Use the custom tick component, passing the anchorKey
          tick={<CustomAxisTick anchorKey={anchorKey} />}
          interval={0}
        />
        {/* YAxis removed */}
        <Tooltip
          cursor={{ fill: 'rgba(200, 200, 200, 0.1)' }}
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '8px',
            border: `1px solid ${GRID_COLOR}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            padding: '8px 12px',
            fontFamily:"'Your Professional Sans-Serif', sans-serif"
          }}
          labelStyle={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}
          itemStyle={{ fontSize: '12px' }}
          formatter={(value: number, name: string, props: any) => {
              // Ensure payload exists before accessing balanced and actual
              const actual = props.payload?.actual;
              const balanced = props.payload?.balanced;

              // Add checks for valid numbers
              if (typeof actual !== 'number' || isNaN(actual) || typeof balanced !== 'number' || isNaN(balanced)) {
                // console.warn("Tooltip formatter received invalid data:", { actual, balanced });
                return ["Data unavailable", props.payload?.name || ""];
              }

              // Only format once when hovering over the category, not per bar key
              if (props.tooltipPayload && props.tooltipPayload.length > 1 && name !== props.tooltipPayload[0].name) {
                return null; // Avoid duplicating tooltip content for the second bar
              }

              const actualFormatted = `Actual: ${(Number(actual) || 0).toFixed(0)}g`;
              const balancedFormatted = `Balanced: ${(Number(balanced) || 0).toFixed(0)}g`;

              // Return an array [value, name] - here we combine both values
              return [`${actualFormatted}\n${balancedFormatted}`, props.payload?.name || ""]; // Use category name as the 'name' for the combined value
          }}
          labelFormatter={(label) => `${label}`}
        />

        <Bar
          name="Actual" // Add name for Legend
          dataKey="actual"
          fill={ACTUAL_BAR_COLOR}
          barSize={35}
          radius={[4, 4, 0, 0]} // Rounded top corners
        >
          {/* Conditional outline for anchor */}
          {data.map((entry, index) => (
            <Cell 
              key={`cell-actual-${index}`} 
              fill={ACTUAL_BAR_COLOR} 
              stroke={entry.name === anchorKey ? 'black' : 'none'}
              strokeWidth={entry.name === anchorKey ? 2 : 0}
            />
          ))}
           <LabelList
             // Removed content prop
             position="top"
             dataKey="actual" // Target the actual value
             fill={AXIS_LABEL_COLOR} // Set text color
             fontSize={10} // Set font size
             offset={8} // Consistent offset from bar top
             formatter={(value: number) => {
                // Add check for valid number
                if (typeof value !== 'number' || isNaN(value)) return '0g'; 
                return `${value.toFixed(0)}g`
            }} // Simple formatter
           />
        </Bar>

        {/* Add second bar for Balanced values */}
        <Bar
          name="Balanced" // Add name for Legend
          dataKey="balanced"
          // fill={BALANCED_BAR_COLOR} // Replaced by Cell
          barSize={35}
          fillOpacity={0.7} // Make it slightly transparent to overlay
          radius={[4, 4, 0, 0]} // Rounded top corners
        >
          {/* Conditional coloring for anchor */}
          {data.map((entry, index) => (
            <Cell 
              key={`cell-balanced-${index}`} 
              fill={entry.name === anchorKey ? ANCHOR_BALANCED_COLOR : BALANCED_BAR_COLOR} 
              stroke={entry.name === anchorKey ? 'black' : 'none'} // Add outline for anchor
              strokeWidth={entry.name === anchorKey ? 2 : 0} // Set outline width for anchor
            />
          ))}
          {/* Add LabelList for Balanced value */}
          <LabelList
             position="top"
             dataKey="balanced" // Target the balanced value
             fill={AXIS_LABEL_COLOR} // Set text color (black)
             fontSize={10} // Set font size
             offset={8} // Consistent offset from bar top
             formatter={(value: number) => {
                 // Add check for valid number
                if (typeof value !== 'number' || isNaN(value)) return '0g';
                return `${value.toFixed(0)}g`
            }} // Simple formatter with 'g'
           />
        </Bar>
        {/* REMOVED second LabelList - now handled by DualValueLabel */}
        {/* <LabelList 
            dataKey="balanced"
            position="top" // Ensure position is top
            content={<BalancedValueLabel />} 
         /> */}

        
        <Legend 
          verticalAlign="bottom" 
          height={36} 
          iconType="circle" 
          iconSize={10} 
          // Reverted wrapperStyle change
          formatter={(value, entry) => {
            const { color } = entry;
            // Apply color to the legend text based on the series name
            if (value === 'Actual') {
              return <span style={{ color: ACTUAL_BAR_COLOR }}>{value}</span>;
            } else if (value === 'Balanced') {
              // Use the standard balanced color, not the anchor color for the legend
              return <span style={{ color: BALANCED_BAR_COLOR }}>{value}</span>;
            }
            return value; // Return default for any other items
          }}
        />

      </BarChart>
    </ResponsiveContainer>
    </div>
  );
};
