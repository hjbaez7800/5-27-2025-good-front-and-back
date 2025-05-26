import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Sparkles } from 'lucide-react'; // Import Sparkles icon

// Interface for form data
interface NutritionData {
  itemName: string;
  protein: number | string;
  fat: number | string;
  sugar: number | string;
  totalCarbs: number | string;
  fiber: number | string;
}

// Interface for component props
interface Props {
  onSubmit: (data: NutritionData) => void;
  onAutoFill: (itemName: string) => void; // <-- Add new prop for AI autofill
  buttonLabel?: string;
  initialData?: Partial<NutritionData>;
  isSubmitting?: boolean; // Prop to disable form/button during submission
  isLookingUp?: boolean; // Prop to disable autofill button during lookup
}

export function NutritionForm({
  onSubmit,
  onAutoFill, // <-- Destructure new prop
  buttonLabel,
  initialData,
  isSubmitting, // Destructure isSubmitting
  isLookingUp, // Destructure isLookingUp
}: Props) {
  const [formData, setFormData] = useState<NutritionData>({
    itemName: initialData?.itemName || '',
    protein: initialData?.protein ?? '',
    fat: initialData?.fat ?? '',
    sugar: initialData?.sugar ?? '',
    totalCarbs: initialData?.totalCarbs ?? '',
    fiber: initialData?.fiber ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof NutritionData, string>>>({});

  // Effect to update form state when initialData prop changes
  useEffect(() => {
    console.log("NutritionForm useEffect triggered by initialData change:", initialData);
    setFormData({
      itemName: initialData?.itemName || '',
      protein: String(initialData?.protein ?? ''),
      fat: String(initialData?.fat ?? ''),
      sugar: String(initialData?.sugar ?? ''),
      totalCarbs: String(initialData?.totalCarbs ?? ''),
      fiber: String(initialData?.fiber ?? ''),
    });
    setErrors({});
    console.log("NutritionForm formData updated from initialData");
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    console.log(`handleChange called: name='${name}', value='${value}'`); // Added log
    if (name === 'itemName') {
      console.log('Before setFormData for itemName:', formData.itemName);
      setFormData(prev => {
        const newState = { ...prev, [name]: value };
        console.log('After setFormData for itemName (within callback):', newState.itemName);
        return newState;
      });
      if (errors.itemName) {
        setErrors(prev => ({ ...prev, itemName: undefined }));
      }
    } else if (/^\d*\.?\d*$/.test(value) || value === '') {
       setFormData(prev => ({ ...prev, [name]: value }));
       if (errors[name as keyof NutritionData]) {
         setErrors(prev => ({ ...prev, [name]: undefined }));
       }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof NutritionData, string>> = {};
    let isValid = true;
    (Object.keys(formData) as Array<keyof NutritionData>).forEach(key => {
      const value = formData[key];
      if (key !== 'itemName' && (value === '' || value === null || value === undefined)) {
        newErrors[key] = 'This field is required.';
        isValid = false;
      } else if (key !== 'itemName' && (isNaN(Number(value)) || Number(value) < 0)) {
        newErrors[key] = 'Must be a non-negative number.';
        isValid = false;
      }
    });
    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const submittedData = {
          itemName: formData.itemName || 'Unnamed Item',
          protein: Number(formData.protein),
          fat: Number(formData.fat),
          sugar: Number(formData.sugar),
          totalCarbs: Number(formData.totalCarbs),
          fiber: Number(formData.fiber),
      };
      console.log('Form Submitted (Numeric & Name):', submittedData);
      onSubmit(submittedData);
    } else {
       console.log('Form validation failed', errors);
    }
  };

  const handleAutoFillClick = () => {
      // Only trigger if not already looking up and item name is present
      if (!isLookingUp && formData.itemName.trim()) {
          onAutoFill(formData.itemName);
      } else if (!formData.itemName.trim()) {
          // Optionally set an error or show a toast if item name is empty
          setErrors(prev => ({ ...prev, itemName: 'Please enter an item name first.' }));
      }
  };


  const renderInputField = (
    name: keyof NutritionData,
    label: string,
    tooltipText: string,
    placeholder: string = "e.g., 10",
    inputType: string = "number",
    isRequired: boolean = true
  ) => (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
         <Label htmlFor={name} className="font-medium">{label}</Label>
         <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                 <Info size={14} className="text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{tooltipText}</p>
              </TooltipContent>
            </Tooltip>
         </TooltipProvider>
      </div>
      <Input
        id={name}
        name={name}
        type={inputType}
        min={inputType === 'number' ? "0" : undefined}
        step={inputType === 'number' ? "any" : undefined}
        placeholder={placeholder}
        value={formData[name]}
        onChange={handleChange}
        className={errors[name] ? "border-red-500" : ""}
        required={isRequired}
        disabled={isSubmitting} // Disable input during main form submission
      />
      {errors[name] && <p className="text-sm text-red-600">{errors[name]}</p>}
    </div>
  );


  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card text-card-foreground shadow">
       <h3 className="text-lg font-semibold mb-4">Enter Nutrition Facts (per serving)</h3>

       {/* Item Name Input with Auto Fill Button */}
       <div className="space-y-2">
         <Label htmlFor="itemName" className="font-medium">Item Name</Label>
         <div className="flex items-center space-x-2">
           <Input
             id="itemName"
             name="itemName"
             type="text"
             placeholder="e.g., Apple slices with peanut butter"
             value={formData.itemName}
             onChange={handleChange}
             className={`flex-grow ${errors.itemName ? "border-red-500" : ""}`}
             required={false} // Make itemName optional for manual entry, but required for autofill trigger
             disabled={isSubmitting || isLookingUp} // Disable input during submissions or lookup
           />
           <Button
             type="button" // Prevent form submission
             variant="outline"
             size="sm"
             onClick={handleAutoFillClick}
             disabled={isSubmitting || isLookingUp || !formData.itemName.trim()} // Disable if submitting, looking up, or no name entered
             title="Auto Fill with AI"
           >
             <Sparkles className="h-4 w-4 mr-1" /> {/* Add icon */}
             AI Fill
           </Button>
         </div>
         {errors.itemName && <p className="text-sm text-red-600">{errors.itemName}</p>}
       </div>


      {renderInputField("protein", "Protein (g)", "Amount of protein in grams.", "e.g., 20", "number", true)}
      {renderInputField("fat", "Total Fat (g)", "Amount of total fat in grams.", "e.g., 8", "number", true)}
      {renderInputField("totalCarbs", "Total Carbohydrates (g)", "Amount of total carbohydrates in grams.", "e.g., 30", "number", true)}
      {renderInputField("fiber", "Dietary Fiber (g)", "Amount of dietary fiber in grams. Included within Total Carbohydrates.", "e.g., 5", "number", true)}
      {renderInputField("sugar", "Total Sugars (g)", "Amount of total sugars in grams. Included within Total Carbohydrates.", "e.g., 10", "number", true)}

      <Button type="submit" className="w-full" disabled={isSubmitting || isLookingUp}>
          {isSubmitting ? 'Adding...' : buttonLabel || 'Analyze & Add to Cart'}
      </Button>
    </form>
  );
}
